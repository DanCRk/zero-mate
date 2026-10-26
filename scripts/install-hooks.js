#!/usr/bin/env node
'use strict';

// ZeroMate — Claude Code Hook Installer / Uninstaller
// Configures ~/.claude/settings.json to forward events to hooks/zeromate-claude-hook.js.

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
  'PermissionRequest',
  'Notification',
  'Stop',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'SessionEnd',
];

function settingsPath() {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

function readSettings(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
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
  settings.hooks = settings.hooks && typeof settings.hooks === 'object' ? settings.hooks : {};

  for (const event of EVENTS) {
    const list = Array.isArray(settings.hooks[event]) ? settings.hooks[event] : [];
    const filtered = list.filter((e) => !isOurs(e));
    filtered.push({ hooks: [{ type: 'command', command: COMMAND }] });
    settings.hooks[event] = filtered;
  }

  writeSettings(file, settings);
  return file;
}

function uninstall(file = settingsPath()) {
  if (!fs.existsSync(file)) return file;
  const settings = readSettings(file);
  if (!settings.hooks || typeof settings.hooks !== 'object') return file;

  for (const event of Object.keys(settings.hooks)) {
    if (!Array.isArray(settings.hooks[event])) continue;
    settings.hooks[event] = settings.hooks[event].filter((e) => !isOurs(e));
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }
  writeSettings(file, settings);
  return file;
}

function status(file = settingsPath()) {
  if (!fs.existsSync(file)) return false;
  const settings = readSettings(file);
  if (!settings.hooks) return false;
  return EVENTS.some((ev) => (settings.hooks[ev] || []).some(isOurs));
}

if (require.main === module) {
  const remove = process.argv.includes('--uninstall') || process.argv.includes('-u');
  const file = remove ? uninstall() : install();
  console.log(`[zeromate-hooks-claude] ${remove ? 'desinstalado de' : 'instalado en'} ${file}`);
}

module.exports = { install, uninstall, status, settingsPath };
