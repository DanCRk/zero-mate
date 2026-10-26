'use strict';

// Feeds the overlay with the position of visible desktop windows (Windows only),
// so 2B can walk along and sit on their top ledges.

const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
const { screen } = require('electron');

const SCRIPT = path.join(__dirname, 'windows.ps1').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);

function startWindowWatch({ overlay, onUpdate }) {
  if (process.platform !== 'win32') return { stop() {} };

  let child = null;
  let stopped = false;
  let restarts = 0;
  let lastFg = { fgTitle: '', fgApp: '' };

  const handle = overlay.getNativeWindowHandle();
  const self = handle.length >= 8 ? handle.readBigUInt64LE(0) : BigInt(handle.readUInt32LE(0));

  const toOverlay = (win, bounds) => {
    const dip = screen.screenToDipRect(null, { x: win.x, y: win.y, width: win.w, height: win.h });
    return { id: win.id, x: dip.x - bounds.x, y: dip.y - bounds.y, w: dip.width, h: dip.height, max: win.max };
  };

  const start = () => {
    child = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', SCRIPT, String(self), String(process.pid),
    ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });

    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      let snap;
      try {
        snap = JSON.parse(line);
      } catch {
        return;
      }
      if (overlay.isDestroyed()) return;
      lastFg = { fgTitle: snap.fgTitle || '', fgApp: snap.fgApp || '' };
      const bounds = overlay.getBounds();
      const wins = snap.wins
        .map((w) => toOverlay(w, bounds))
        .filter((w) => w.x < bounds.width && w.x + w.w > 0 && w.y < bounds.height && w.y + w.h > 0);
      onUpdate({ fg: snap.fg, fgTitle: snap.fgTitle || '', fgApp: snap.fgApp || '', wins });
    });
    child.stderr.on('data', (d) => console.error('[zeromate] window watch:', String(d).trim()));
    child.on('exit', () => {
      child = null;
      if (!stopped && restarts++ < 3) setTimeout(start, 3000);
    });
  };

  start();
  return {
    getForeground() {
      return lastFg;
    },
    stop() {
      stopped = true;
      child?.kill();
    },
  };
}

module.exports = { startWindowWatch };
