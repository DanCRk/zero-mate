#!/usr/bin/env node
'use strict';

// ZeroMate — Claude Code Passive Hook Forwarder
// Reads Claude Code hook JSON from stdin and posts to http://127.0.0.1:47823/event (fallback 47824).

const http = require('node:http');

const PRIMARY_PORT = Number(process.env.ZEROMATE_PORT || process.env.YORHA_PORT) || 47823;

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
    sendToPort(PRIMARY_PORT + 1, () => process.exit(0));
  });
});

setTimeout(() => process.exit(0), 1500).unref();
