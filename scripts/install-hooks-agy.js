#!/usr/bin/env node
'use strict';

// ZeroMate — Antigravity (AGY) Lifecycle Hook Installer / Uninstaller
// Configures ~/.gemini/config/hooks.json for Antigravity.
// Format compliant with Antigravity official specification:
// Top-level key is the hook name ("zeromate-agy").
//
// Usage:
//   node scripts/install-hooks-agy.js            install
//   node scripts/install-hooks-agy.js --uninstall
//   node scripts/install-hooks-agy.js --status

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const EVENTS = [
  'SessionStart',
  'PreInvocation',
  'PreToolUse',
  'PostToolUse',
  'Stop',
];

const HOOK_KEY = 'zeromate-agy';
const MARKS = ['zeromate-agy-hook.js', 'yorha-agy-hook.js'];

function settingsPath() {
  const base = process.env.AGY_CONFIG_DIR || path.join(os.homedir(), '.gemini', 'config');
  return path.join(base, 'hooks.json');
}

function quoteIfNeeded(p) {
  return /\s/.test(p) ? `"${p}"` : p;
}

function hasNode() {
  try {
    return spawnSync('node', ['-v'], { windowsHide: true, timeout: 3000 }).status === 0;
  } catch {
    return false;
  }
}

function hookCommand(eventType) {
  const script = path.resolve(__dirname, '..', 'hooks', 'zeromate-agy-hook.js')
    .replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
  if (!process.versions.electron) {
    return `${quoteIfNeeded(process.execPath)} ${quoteIfNeeded(script)} ${eventType}`;
  }
  if (hasNode()) {
    return `node ${quoteIfNeeded(script)} ${eventType}`;
  }
  return `ELECTRON_RUN_AS_NODE=1 ${quoteIfNeeded(process.execPath)} ${quoteIfNeeded(script)} ${eventType}`;
}

function readSettings(file) {
  if (!fs.existsSync(file)) return {};
  let text = fs.readFileSync(file, 'utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${file} is not valid JSON (${err.message}). Fix it first, nothing was changed.`);
  }
}

function strip(settings) {
  delete settings[HOOK_KEY];

  // Clean legacy "hooks" container if it contained our old hook entries
  if (settings.hooks && typeof settings.hooks === 'object') {
    for (const event of Object.keys(settings.hooks)) {
      if (Array.isArray(settings.hooks[event])) {
        settings.hooks[event] = settings.hooks[event].filter((item) => {
          const str = JSON.stringify(item);
          return !MARKS.some((m) => str.includes(m));
        });
        if (settings.hooks[event].length === 0) delete settings.hooks[event];
      }
    }
    if (Object.keys(settings.hooks).length === 0) {
      delete settings.hooks;
    }
  }

  // Clean any legacy top-level keys that referenced our scripts
  for (const [key, val] of Object.entries(settings)) {
    if (val && typeof val === 'object' && MARKS.some((m) => JSON.stringify(val).includes(m))) {
      delete settings[key];
    }
  }

  return settings;
}

function write(file, settings) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(file, `${file}.zeromate-backup-${stamp}`);
  }
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

function install() {
  const file = settingsPath();
  const original = readSettings(file);
  const before = JSON.stringify(original);
  const settings = strip(original);

  settings[HOOK_KEY] = {
    enabled: true,
    SessionStart: [
      { type: 'command', command: hookCommand('SessionStart'), timeout: 5 },
    ],
    PreInvocation: [
      { type: 'command', command: hookCommand('PreInvocation'), timeout: 5 },
    ],
    PreToolUse: [
      {
        matcher: '*',
        hooks: [{ type: 'command', command: hookCommand('PreToolUse'), timeout: 5 }],
      },
    ],
    PostToolUse: [
      {
        matcher: '*',
        hooks: [{ type: 'command', command: hookCommand('PostToolUse'), timeout: 5 }],
      },
    ],
    Stop: [
      { type: 'command', command: hookCommand('Stop'), timeout: 5 },
    ],
  };

  if (JSON.stringify(settings) !== before) write(file, settings);
  return { file, command: hookCommand('<Event>'), events: EVENTS.length };
}

function uninstall() {
  const file = settingsPath();
  if (!fs.existsSync(file)) return { file, removed: false };
  const settings = readSettings(file);
  const before = JSON.stringify(settings);
  strip(settings);
  const removed = JSON.stringify(settings) !== before;
  if (removed) write(file, settings);
  return { file, removed };
}

function status() {
  const file = settingsPath();
  try {
    const settings = readSettings(file);
    const entry = settings[HOOK_KEY];
    const installed = Boolean(
      entry &&
      entry.enabled !== false &&
      MARKS.some((m) => JSON.stringify(entry).includes(m))
    );
    const events = installed ? EVENTS.filter((e) => Boolean(entry[e])) : [];
    return { file, installed, events };
  } catch (err) {
    return { file, installed: false, events: [], error: err.message };
  }
}

module.exports = { install, uninstall, status, settingsPath, EVENTS };

if (require.main === module) {
  const arg = process.argv[2];
  try {
    if (arg === '--status' || arg === '-s') {
      const st = status();
      console.log(JSON.stringify(st, null, 2));
    } else if (arg === '--uninstall' || arg === '-u') {
      const res = uninstall();
      console.log(`[zeromate-hooks-agy] ${res.removed ? 'desinstalado de' : 'no estaba en'} ${res.file}`);
    } else {
      const res = install();
      console.log(`[zeromate-hooks-agy] instalado en ${res.file} (${res.events} eventos)`);
    }
  } catch (err) {
    console.error(`[zeromate-hooks-agy] Error: ${err.message}`);
    process.exit(1);
  }
}
