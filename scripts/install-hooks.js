#!/usr/bin/env node
'use strict';

// ZeroMate — Claude Code Hook Installer / Uninstaller
// Configures ~/.claude/settings.json to forward events to hooks/zeromate-claude-hook.js.
// Keeps existing hooks (including Capri) intact.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOOK_SCRIPT = path.resolve(__dirname, '..', 'hooks', 'zeromate-claude-hook.js').replace(/\\/g, '/');
const NODE_EXE = process.execPath && !process.execPath.toLowerCase().includes('electron') ? process.execPath : 'node';
const COMMAND = `"${NODE_EXE}" "${HOOK_SCRIPT}"`;
const MARKER = 'zeromate-claude-hook.js';

const EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest', // Native Claude Code permission request event
  'Notification',
  'Stop',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'SessionEnd',
];

function settingsPath() {
  const base = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(base, 'settings.json');
}

function readSettings(file) {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${file} is not valid JSON (${err.message}). Fix it first, nothing was changed.`);
  }
}

function writeSettings(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(file, `${file}.zeromate-backup-${stamp}`);
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function isOurs(entry) {
  if (!entry) return false;
  if (typeof entry.command === 'string' && (entry.command.includes(MARKER) || entry.command.includes('yorha-claude-hook.js'))) return true;
  if (Array.isArray(entry.hooks)) {
    return entry.hooks.some((h) => typeof h?.command === 'string' && (h.command.includes(MARKER) || h.command.includes('yorha-claude-hook.js')));
  }
  return false;
}

function install(file = settingsPath()) {
  const settings = readSettings(file);
  const before = JSON.stringify(settings);
  settings.hooks = settings.hooks && typeof settings.hooks === 'object' ? settings.hooks : {};

  for (const event of EVENTS) {
    const list = Array.isArray(settings.hooks[event]) ? settings.hooks[event] : [];
    const filtered = list.filter((e) => !isOurs(e));
    filtered.push({ hooks: [{ type: 'command', command: COMMAND, async: true, timeout: 10 }] });
    settings.hooks[event] = filtered;
  }

  if (JSON.stringify(settings) !== before) {
    writeSettings(file, settings);
  }
  return file;
}

function uninstall(file = settingsPath()) {
  if (!fs.existsSync(file)) return file;
  const settings = readSettings(file);
  if (!settings.hooks || typeof settings.hooks !== 'object') return file;

  const before = JSON.stringify(settings);
  for (const event of Object.keys(settings.hooks)) {
    if (!Array.isArray(settings.hooks[event])) continue;
    settings.hooks[event] = settings.hooks[event].filter((e) => !isOurs(e));
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  if (JSON.stringify(settings) !== before) {
    writeSettings(file, settings);
  }
  return file;
}

function status(file = settingsPath()) {
  if (!fs.existsSync(file)) return false;
  try {
    const settings = readSettings(file);
    if (!settings.hooks) return false;
    return EVENTS.some((ev) => (settings.hooks[ev] || []).some(isOurs));
  } catch {
    return false;
  }
}

if (require.main === module) {
  const remove = process.argv.includes('--uninstall') || process.argv.includes('-u');
  const file = remove ? uninstall() : install();
  console.log(`[zeromate-hooks-claude] ${remove ? 'desinstalado de' : 'instalado en'} ${file}`);
}

module.exports = { install, uninstall, status, settingsPath, EVENTS };
