#!/usr/bin/env node
'use strict';

// ZeroMate — Antigravity (AGY) Passive Hook Forwarder
// Reads Antigravity hook JSON from stdin and posts to http://127.0.0.1:47823/event (fallback 47824).
// Never blocks or crashes the IDE/CLI if the desktop agent is closed.

const http = require('node:http');

const PRIMARY_PORT = Number(process.env.ZEROMATE_PORT || process.env.YORHA_PORT) || 47823;

const EVENT_MAP = {
  SessionStart: 'SessionStart',
  SessionEnd: 'Stop',
  BeforeAgent: 'UserPromptSubmit',
  BeforeModel: null,
  AfterModel: null,
  BeforeToolSelection: null,
  BeforeTool: 'PreToolUse',
  AfterTool: 'PostToolUse',
  PreCompress: 'PreCompact',
  Notification: 'Notification',
  AfterAgent: 'Stop',
};

const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return process.exit(0);

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return process.exit(0);
  }

  const agyEvent = payload.hook_event_name;
  let mapped = EVENT_MAP[agyEvent];

  if (agyEvent === 'AfterTool' && payload.tool_response && typeof payload.tool_response === 'string' && payload.tool_response.startsWith('Error')) {
    mapped = 'PostToolUseFailure';
  }

  if (mapped === undefined) mapped = agyEvent;
  if (mapped === null) return process.exit(0);

  const normalized = {
    ...payload,
    source: 'antigravity',
    hook_event_name: mapped,
    original_event: agyEvent,
  };

  const body = Buffer.from(JSON.stringify(normalized), 'utf8');

  function sendToPort(port, onDone) {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
        timeout: 800,
      },
      (res) => {
        res.resume();
        res.on('end', () => onDone(true));
      },
    );
    req.on('error', () => onDone(false));
    req.on('timeout', () => { req.destroy(); onDone(false); });
    req.end(body);
  }

  sendToPort(PRIMARY_PORT, (ok) => {
    if (ok) return process.exit(0);
    sendToPort(PRIMARY_PORT + 1, () => process.exit(0));
  });
});

setTimeout(() => process.exit(0), 1500).unref();
