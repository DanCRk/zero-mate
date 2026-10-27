'use strict';

// Local HTTP bridge on 127.0.0.1:47824 for Antigravity / Claude Code hooks and --dev automation.

const http = require('node:http');

const MAX_BODY = 512 * 1024;

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(json) });
  res.end(json);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

function createBridge({ port, onEvent, onSlot, onDebug }) {
  const server = http.createServer(async (req, res) => {
    if (req.headers.origin) return send(res, 403, { ok: false });

    const url = new URL(req.url, 'http://127.0.0.1');

    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, name: 'zero-mate', pid: process.pid });
    }

    if (req.method === 'POST' && (url.pathname === '/slot' || url.pathname === '/action')) {
      try {
        const body = await readJson(req);
        const slot = body?.slot || body?.action;
        if (!slot || typeof slot !== 'string') {
          return send(res, 400, { ok: false, error: 'missing slot or action name' });
        }
        if (onSlot) onSlot(slot, body);
        return send(res, 200, { ok: true, slot });
      } catch (err) {
        return send(res, 400, { ok: false, error: err.message });
      }
    }

    if (req.method === 'POST' && url.pathname === '/event') {
      try {
        const evt = await readJson(req);
        if (!evt || typeof evt !== 'object') {
          return send(res, 400, { ok: false, error: 'invalid payload' });
        }
        if (evt.slot || evt.action) {
          const slot = evt.slot || evt.action;
          if (onSlot) onSlot(slot, evt);
          if (typeof evt.hook_event_name === 'string' && onEvent) onEvent(evt);
          return send(res, 200, { ok: true, slot });
        }
        if (typeof evt.hook_event_name !== 'string') {
          return send(res, 400, { ok: false, error: 'missing hook_event_name or slot' });
        }
        if (onEvent) onEvent(evt);
        return send(res, 200, { ok: true });
      } catch (err) {
        return send(res, 400, { ok: false, error: err.message });
      }
    }

    if (onDebug && url.pathname.startsWith('/debug/')) {
      try {
        const body = req.method === 'POST' ? await readJson(req).catch(() => ({})) : {};
        return send(res, 200, await onDebug(url.pathname.slice(7), body));
      } catch (err) {
        return send(res, 500, { ok: false, error: err.message });
      }
    }

    send(res, 404, { ok: false });
  });

  let currentPort = port;
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && currentPort === port) {
      currentPort = port + 1;
      console.warn(`[zeromate] port ${port} in use, binding to 127.0.0.1:${currentPort}`);
      server.listen(currentPort, '127.0.0.1');
    } else {
      console.error('[zeromate] bridge error:', err.message);
    }
  });

  server.listen(currentPort, '127.0.0.1', () => console.log(`[zeromate] listening on 127.0.0.1:${currentPort}`));
  return server;
}

module.exports = { createBridge };
