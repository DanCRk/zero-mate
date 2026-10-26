'use strict';

/**
 * tools/generate-release-notes.js
 * Generates ready-to-publish release notes with dynamic installer hashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const PKG = require(path.join(ROOT, 'package.json'));
const VERSION = PKG.version;

function computeHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function main() {
  const distDir = path.join(ROOT, 'dist');
  let installerName = `ZeroMate-Setup-${VERSION}.exe`;
  let installerHash = 'pending build (run npm run dist)';
  let sizeMb = '~115 MB';

  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    const exe = files.find((f) => f.endsWith('.exe') && !f.includes('blockmap'));
    if (exe) {
      installerName = exe;
      const fullPath = path.join(distDir, exe);
      installerHash = computeHash(fullPath);
      const stat = fs.statSync(fullPath);
      sizeMb = `${(stat.size / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  const templatePath = path.join(ROOT, 'docs', 'releases', `v${VERSION}.md`);
  let content = fs.existsSync(templatePath)
    ? fs.readFileSync(templatePath, 'utf8')
    : fs.readFileSync(path.join(ROOT, 'docs', 'releases', 'v0.3.1-alpha.1.md'), 'utf8');

  console.log('=====================================================');
  console.log(`RELEASE NOTES FOR GITHUB: ZeroMate v${VERSION}`);
  console.log('=====================================================\n');
  console.log(content);
  console.log(`\nArtifacts detail:`);
  console.log(`- File: ${installerName}`);
  console.log(`- SHA256: ${installerHash}`);
  console.log(`- Size: ${sizeMb}`);
}

main();
