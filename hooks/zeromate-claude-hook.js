#!/usr/bin/env node
'use strict';

// ZeroMate — Claude Code Passive Hook Forwarder
// Reads Claude Code hook JSON from stdin and posts to http://127.0.0.1:47824/event (fallback 47823).

const http = require('node:http');

const PRIMARY_PORT = Number(process.env.ZEROMATE_PORT || process.env.YORHA_PORT) || 47824;

if (process.env.ZEROMATE_INTERNAL === '1') {
  process.exit(0);
}

const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return process.exit(0);

  let payload;
  try {
    payload = JSON.parse(raw);
    payload.source = payload.source || 'claude-code';
  } catch {
    return process.exit(0);
  }

  // Normalize hook event name and fields
  payload.hook_event_name = payload.hook_event_name || payload.event || payload.type;
  if (payload.hook_event_name === 'PermissionRequest' || payload.type === 'PermissionRequest') {
    payload.hook_event_name = 'PermissionRequest';
    payload.tool_name = payload.tool_name || payload.tool || (payload.tool_input && payload.tool_input.name) || 'Herramienta';
    if (!payload.command) {
      if (typeof payload.tool_input === 'string') {
        payload.command = payload.tool_input;
      } else if (payload.tool_input?.command) {
        payload.command = payload.tool_input.command;
      } else if (payload.tool_input?.cmd) {
        payload.command = payload.tool_input.cmd;
      } else if (payload.tool_input?.question) {
        payload.command = payload.tool_input.question;
      } else if (payload.tool_input && typeof payload.tool_input === 'object') {
        payload.command = JSON.stringify(payload.tool_input);
      }
    }
  }

  const body = Buffer.from(JSON.stringify(payload), 'utf8');

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
    sendToPort(47823, () => process.exit(0));
  });
});

setTimeout(() => process.exit(0), 1500).unref();
