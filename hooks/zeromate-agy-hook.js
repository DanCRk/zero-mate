#!/usr/bin/env node
'use strict';

// ZeroMate — Antigravity (AGY) Lifecycle Hook Forwarder
// Reads the Antigravity hook payload on stdin, translates it to ZeroMate's event format,
// forwards it to ZeroMate over HTTP bridge, and prints valid JSON response on stdout.
// Rule #1: Never block Antigravity. Always output valid JSON and exit 0 fast.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.ZEROMATE_PORT || process.env.YORHA_PORT) || 47824;
const HOOK_TYPE = process.argv[2] || 'PreToolUse';
const REPLY_MAX = 4000;

// Ignore internal queries spawned by ZeroMate brain router to avoid recursion
if (process.env.ZEROMATE_INTERNAL === '1') {
  if (HOOK_TYPE === 'PreToolUse') {
    process.stdout.write(JSON.stringify({ decision: 'allow' }) + '\n');
  } else if (HOOK_TYPE === 'Stop') {
    process.stdout.write(JSON.stringify({ decision: 'stop' }) + '\n');
  } else {
    process.stdout.write('{}\n');
  }
  process.exit(0);
}

function respondAndExit() {
  if (HOOK_TYPE === 'PreToolUse') {
    process.stdout.write(JSON.stringify({ decision: 'allow' }) + '\n');
  } else if (HOOK_TYPE === 'Stop') {
    process.stdout.write(JSON.stringify({ decision: 'stop' }) + '\n');
  } else {
    process.stdout.write('{}\n');
  }
  process.exit(0);
}

// Emergency safety timeout: never let hook hang longer than 1500ms
setTimeout(respondAndExit, 1500).unref();

function cleanUserPrompt(text) {
  if (!text) return '';
  const match = String(text).match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
  const raw = match ? match[1] : String(text);
  return raw.replace(/\s+/g, ' ').trim().slice(0, 280);
}

function getLastAssistantMessage(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return '';
  try {
    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const step = JSON.parse(lines[i]);
        if (step.type === 'PLANNER_RESPONSE' && step.content && String(step.content).trim()) {
          const reply = String(step.content).trim();
          return reply.length > REPLY_MAX ? reply.slice(0, REPLY_MAX) + '…' : reply;
        }
      } catch {}
    }
  } catch {}
  return '';
}

function mapTool(toolCall) {
  const name = toolCall?.name || '';
  const args = toolCall?.args || {};

  switch (name) {
    case 'read_file':
    case 'view_file':
    case 'view_file_outline':
    case 'view_code_item':
      return {
        tool_name: 'Read',
        tool_input: { file_path: args.Path || args.AbsolutePath || args.File || '' },
      };
    case 'write_file':
    case 'write_to_file':
      return {
        tool_name: 'Write',
        tool_input: {
          file_path: args.Path || args.TargetFile || '',
          content_len: typeof args.Content === 'string' ? args.Content.length : 0,
        },
      };
    case 'edit_file':
    case 'replace_file_content':
    case 'multi_replace_file_content':
      return {
        tool_name: 'Edit',
        tool_input: {
          file_path: args.Path || args.TargetFile || '',
          old_string_len: typeof args.Target === 'string' ? args.Target.length : 0,
          new_string_len: typeof args.Replacement === 'string' ? args.Replacement.length : 0,
        },
      };
    case 'run_command':
      return {
        tool_name: 'PowerShell',
        tool_input: {
          command: String(args.CommandLine || '').slice(0, 280),
          description: String(args.toolSummary || args.CommandLine || '').slice(0, 280),
        },
      };
    case 'grep_search':
      return {
        tool_name: 'Grep',
        tool_input: { pattern: String(args.Query || '').slice(0, 280) },
      };
    case 'find_by_name':
    case 'list_dir':
      return {
        tool_name: 'Glob',
        tool_input: { pattern: String(args.Pattern || args.DirectoryPath || '*').slice(0, 280) },
      };
    case 'search_web':
      return {
        tool_name: 'WebSearch',
        tool_input: { query: String(args.query || '').slice(0, 280) },
      };
    case 'read_url_content':
      return {
        tool_name: 'WebFetch',
        tool_input: { url: String(args.Url || '').slice(0, 280) },
      };
    case 'invoke_subagent':
      return {
        tool_name: 'Agent',
        tool_input: {
          description: String(args.Role || args.TypeName || 'subagent').slice(0, 280),
          subagent_type: String(args.TypeName || 'agent').slice(0, 100),
        },
      };
    case 'ask_question':
      return {
        tool_name: 'AskUserQuestion',
        tool_input: {
          question: String(args.questions?.[0]?.question || '').slice(0, 280),
        },
      };
    default:
      return {
        tool_name: name || 'Tool',
        tool_input: args,
      };
  }
}

function buildEvents(payload) {
  const base = {
    session_id: payload.conversationId || 'agy-session',
    cwd: (Array.isArray(payload.workspacePaths) && payload.workspacePaths[0]) || process.cwd(),
    source: 'antigravity',
  };

  if (HOOK_TYPE === 'SessionStart') {
    return [{ evt: { ...base, hook_event_name: 'SessionStart', source_tag: 'startup' } }];
  }

  if (HOOK_TYPE === 'PreInvocation') {
    if (payload.invocationNum && payload.invocationNum > 1) return [];
    const prompt = cleanUserPrompt(payload.lastUserInput);
    if (!prompt) return [];
    return [{ evt: { ...base, hook_event_name: 'UserPromptSubmit', prompt } }];
  }

  if (HOOK_TYPE === 'PreToolUse') {
    const mapped = mapTool(payload.toolCall);
    const events = [{ evt: { ...base, hook_event_name: 'PreToolUse', ...mapped } }];
    const toolName = payload.toolCall?.name || '';

    if (toolName === 'run_command') {
      const cmd = mapped.tool_input.command || mapped.tool_input.description || 'PowerShell';
      const isSensitive = /git\s+push|rm\s+-|Remove-Item|drop|delete|destroy|npm\s+publish|curl\s+-X\s+DELETE/i.test(cmd);
      events.push({
        evt: {
          ...base,
          hook_event_name: 'PermissionRequest',
          notification_type: 'permission_prompt',
          tool_name: 'PowerShell',
          command: cmd,
          title: isSensitive ? 'Comando sensible detectado' : 'Permiso requerido',
          message: cmd,
        },
      });
    } else if (toolName === 'ask_question') {
      events.push({
        evt: {
          ...base,
          hook_event_name: 'PermissionRequest',
          notification_type: 'question',
          tool_name: 'Pregunta del Operador',
          command: mapped.tool_input.question || 'Antigravity ha solicitado confirmación',
          title: 'Confirmación requerida',
          message: mapped.tool_input.question,
        },
      });
    } else if (toolName === 'invoke_subagent') {
      events.push({
        evt: {
          ...base,
          hook_event_name: 'SubagentStart',
          agent_type: mapped.tool_input.subagent_type,
        },
      });
    }
    return events;
  }

  if (HOOK_TYPE === 'PostToolUse') {
    const mapped = mapTool(payload.toolCall);
    const events = [];
    if (payload.error) {
      events.push({
        evt: {
          ...base,
          hook_event_name: 'PostToolUseFailure',
          ...mapped,
          error: String(payload.error).slice(0, 280),
        },
      });
    } else {
      events.push({
        evt: {
          ...base,
          hook_event_name: 'PostToolUse',
          ...mapped,
        },
      });
    }
    if (payload.toolCall?.name === 'invoke_subagent') {
      events.push({
        evt: {
          ...base,
          hook_event_name: 'SubagentStop',
          agent_type: mapped.tool_input.subagent_type,
        },
      });
    }
    return events;
  }

  if (HOOK_TYPE === 'Stop') {
    if (payload.terminationReason === 'ERROR' || payload.error) {
      return [
        {
          evt: {
            ...base,
            hook_event_name: 'PostToolUseFailure',
            error: String(payload.error || payload.terminationReason || 'Error').slice(0, 280),
          },
        },
      ];
    }
    const last_assistant_message = getLastAssistantMessage(payload.transcriptPath);
    return [{ evt: { ...base, hook_event_name: 'Stop', last_assistant_message } }];
  }

  return [];
}

function postEvent(evt, port = PORT) {
  return new Promise((resolve) => {
    const body = Buffer.from(JSON.stringify(evt), 'utf8');
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/event',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length,
        },
        timeout: 500,
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve(true));
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end(body);
  });
}

async function main() {
  const chunks = [];
  process.stdin.on('data', (c) => chunks.push(c));
  process.stdin.on('end', async () => {
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    let payload = {};
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {}
    }

    const items = buildEvents(payload);
    for (const item of items) {
      const ok = await postEvent(item.evt, PORT);
      if (!ok && PORT !== 47823) {
        // Fallback port in case ZeroMate was started on 47823
        await postEvent(item.evt, 47823);
      }
    }

    respondAndExit();
  });
}

main().catch(() => respondAndExit());
