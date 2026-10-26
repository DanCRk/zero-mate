'use strict';

/**
 * Multi-Theme Package Loader (themes/<id>/).
 * Reads theme.json, personality.ctx (AI-DSL), assets, and sounds/ directory.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const THEMES_DIR = path.join(ROOT, 'themes');
const SOUND_EXT = /\.(wav|mp3|ogg|m4a)$/i;

function listThemes() {
  try {
    return fs.readdirSync(THEMES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(THEMES_DIR, d.name, 'theme.json')))
      .map((d) => {
        const manifest = JSON.parse(fs.readFileSync(path.join(THEMES_DIR, d.name, 'theme.json'), 'utf8'));
        return { id: d.name, name: manifest.name || d.name };
      });
  } catch {
    return [{ id: 'nier-2b', name: 'NieR: Automata — 2B & Pod 042' }];
  }
}

function loadThemePackage(themeId = 'nier-2b') {
  const dir = path.join(THEMES_DIR, themeId);
  const manifestPath = path.join(dir, 'theme.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  let personalityCtx = '';
  const ctxPath = path.join(dir, 'personality.ctx');
  if (fs.existsSync(ctxPath)) {
    personalityCtx = fs.readFileSync(ctxPath, 'utf8');
  }

  const soundsDir = path.join(dir, 'sounds');
  const soundFiles = {};
  if (fs.existsSync(soundsDir)) {
    for (const f of fs.readdirSync(soundsDir)) {
      if (SOUND_EXT.test(f)) {
        const key = f.replace(SOUND_EXT, '').toLowerCase();
        soundFiles[key] = `zeromate://app/themes/${encodeURIComponent(themeId)}/sounds/${encodeURIComponent(f)}`;
      }
    }
  }

  const assetUrl = (rel) => `zeromate://app/themes/${encodeURIComponent(themeId)}/${rel.replace(/^\/+/, '')}`;

  return {
    id: themeId,
    name: manifest.name,
    character: {
      ...manifest.character,
      spriteUrl: assetUrl(manifest.character.sprite),
      sitSpriteUrl: manifest.character.sitSprite ? assetUrl(manifest.character.sitSprite) : null,
      peekSpriteUrl: manifest.character.peekSprite ? assetUrl(manifest.character.peekSprite) : null,
      sleepSpriteUrl: manifest.character.sleepSprite ? assetUrl(manifest.character.sleepSprite) : null,
      spinSpriteUrl: manifest.character.spinSprite ? assetUrl(manifest.character.spinSprite) : null,
      wallAnchorSpriteUrl: manifest.character.wallAnchorSprite ? assetUrl(manifest.character.wallAnchorSprite) : null,
      weaponUrl: manifest.character.weapon ? assetUrl(manifest.character.weapon) : null,
      portraitUrl: assetUrl(manifest.character.portrait),
      cutinUrls: Object.fromEntries(
        Object.entries(manifest.character.cutins || {}).map(([k, v]) => [k, assetUrl(v)])
      ),
    },
    companion: {
      ...manifest.companion,
      spriteUrl: assetUrl(manifest.companion.sprite),
      portraitUrl: assetUrl(manifest.companion.portrait),
    },
    palette: manifest.palette || {},
    satelliteUrl: manifest.satellite ? assetUrl(manifest.satellite) : null,
    slots: manifest.slots || {},
    sounds: soundFiles,
    personalityCtx,
  };
}

module.exports = { listThemes, loadThemePackage, THEMES_DIR };
