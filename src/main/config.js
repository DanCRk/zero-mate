'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const DEFAULTS = {
  theme: 'nier-2b',
  scale: 0.62,          // 0.62 ≈ ~270px tall on desktop
  muted: false,
  volume: 0.75,
  lang: 'en',           // 'en' | 'es' | 'auto' (English default)
  displayId: null,      // null = primary display
  wander: true,         // autonomous window walking & Pod glide
  proactiveMinutes: 25, // default 25m proactive initiative (0 = disabled)
  visible: true,        // false = 2B stowed in Bunker, only Pod 042 floating in corner
  idleQuirkIntervalSec: 45, // frequency of autonomous idle quirk animations (seconds)
  brainProvider: 'agy', // 'agy' | 'claude-cli' | 'ollama' | 'gemini' | 'openai' | 'claude-api'
  brainModel: '',       // optional override model name
  ollamaUrl: 'http://127.0.0.1:11434',
  brainKeys: {
    gemini: '',
    openai: '',
    claude: '',
  },
};

let cache = null;

function file() {
  return path.join(app.getPath('userData'), 'config.json');
}

function load() {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8')) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

function save(patch) {
  cache = { ...load(), ...patch };
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error('[zeromate] could not save config:', err.message);
  }
  return cache;
}

module.exports = { load, save, DEFAULTS };
