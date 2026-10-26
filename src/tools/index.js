'use strict';

// ZeroMate PC Control Tool Engine (src/tools/index.js)
// Implements 2-Tier PC control tools with holographic confirmation for Tier 2:
//   Tier 1 (Safe, auto-approved):
//     - open_app_or_url
//     - media_and_volume
//     - search_files
//     - read_clipboard
//     - write_clipboard
//     - capture_active_window
//     - web_search
//     - load_skill (Phase 6)
//     - save_skill (Phase 6)
//     - update_user_memory (Phase 6)
//   Tier 2 (Critical, requires Holographic YoRHa confirmation):
//     - run_shell_command (PowerShell/CMD windowsHide: true)
//     - write_or_edit_file
//     - kill_process

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

let electron = null;
try {
  electron = require('electron');
} catch {}

const ROOT = path.resolve(__dirname, '..', '..');


function resolveTarget(rawTarget) {
  let t = String(rawTarget || '').trim();
  t = t.replace(/^["']|["']$/g, '').trim();

  const lower = t.toLowerCase();
  const stripped = lower.replace(/^(?:el|la|los|las|un|una|mi|mis|the|a|an)\s+/i, '').trim();

  // 1. Browsers & Internet (Open default browser with Google or web)
  const BROWSER_KEYS = [
    'navegador', 'el navegador', 'navegador web', 'browser', 'web browser',
    'internet', 'la web', 'el internet', 'web'
  ];
  if (BROWSER_KEYS.includes(lower) || BROWSER_KEYS.includes(stripped)) {
    return { type: 'url', target: 'https://www.google.com' };
  }

  // 2. Known popular websites / web services
  const SITES = {
    'youtube': 'https://www.youtube.com',
    'google': 'https://www.google.com',
    'github': 'https://github.com',
    'gmail': 'https://mail.google.com',
    'correo': 'https://mail.google.com',
    'email': 'https://mail.google.com',
    'mail': 'https://mail.google.com',
    'twitter': 'https://twitter.com',
    'x': 'https://x.com',
    'reddit': 'https://www.reddit.com',
    'chatgpt': 'https://chatgpt.com',
    'claude': 'https://claude.ai',
    'gemini': 'https://gemini.google.com',
    'discord': 'https://discord.com/app',
    'discord web': 'https://discord.com/app',
    'netflix': 'https://www.netflix.com',
    'spotify web': 'https://open.spotify.com',
    'twitch': 'https://www.twitch.tv',
    'whatsapp': 'https://web.whatsapp.com',
    'whatsapp web': 'https://web.whatsapp.com',
    'facebook': 'https://www.facebook.com',
    'instagram': 'https://www.instagram.com',
    'drive': 'https://drive.google.com',
    'google drive': 'https://drive.google.com',
    'maps': 'https://maps.google.com',
    'google maps': 'https://maps.google.com',
    'traductor': 'https://translate.google.com',
    'google translate': 'https://translate.google.com',
    'notion': 'https://www.notion.so',
    'linkedin': 'https://www.linkedin.com',
    'amazon': 'https://www.amazon.com',
    'mercadolibre': 'https://www.mercadolibre.com',
    'mercado libre': 'https://www.mercadolibre.com',
  };

  if (SITES[lower] || SITES[stripped]) {
    return { type: 'url', target: SITES[lower] || SITES[stripped] };
  }

  // 3. User standard Windows folders
  const FOLDERS = {
    'descargas': path.join(os.homedir(), 'Downloads'),
    'downloads': path.join(os.homedir(), 'Downloads'),
    'carpeta descargas': path.join(os.homedir(), 'Downloads'),
    'carpeta de descargas': path.join(os.homedir(), 'Downloads'),
    'documentos': path.join(os.homedir(), 'Documents'),
    'documents': path.join(os.homedir(), 'Documents'),
    'carpeta documentos': path.join(os.homedir(), 'Documents'),
    'carpeta de documentos': path.join(os.homedir(), 'Documents'),
    'escritorio': path.join(os.homedir(), 'Desktop'),
    'desktop': path.join(os.homedir(), 'Desktop'),
    'imagenes': path.join(os.homedir(), 'Pictures'),
    'imágenes': path.join(os.homedir(), 'Pictures'),
    'fotos': path.join(os.homedir(), 'Pictures'),
    'pictures': path.join(os.homedir(), 'Pictures'),
    'musica': path.join(os.homedir(), 'Music'),
    'música': path.join(os.homedir(), 'Music'),
    'music': path.join(os.homedir(), 'Music'),
    'videos': path.join(os.homedir(), 'Videos'),
    'vídeos': path.join(os.homedir(), 'Videos'),
    'papelera': 'shell:RecycleBinFolder',
    'papelera de reciclaje': 'shell:RecycleBinFolder',
    'recycle bin': 'shell:RecycleBinFolder',
  };

  if (FOLDERS[lower] || FOLDERS[stripped]) {
    return { type: 'path', target: FOLDERS[lower] || FOLDERS[stripped] };
  }

  // 4. URL detection
  if (/^https?:\/\//i.test(t)) {
    return { type: 'url', target: t };
  }
  if (/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/?.*$/i.test(t) && !t.endsWith('.exe') && !t.endsWith('.bat') && !t.endsWith('.cmd')) {
    return { type: 'url', target: `https://${t}` };
  }

  // 5. Windows Apps
  const APPS = {
    'chrome': 'chrome',
    'google chrome': 'chrome',
    'navegador chrome': 'chrome',
    'edge': 'msedge',
    'microsoft edge': 'msedge',
    'msedge': 'msedge',
    'navegador edge': 'msedge',
    'firefox': 'firefox',
    'mozilla firefox': 'firefox',
    'navegador firefox': 'firefox',
    'brave': 'brave',
    'navegador brave': 'brave',
    'opera': 'opera',
    'notepad': 'notepad.exe',
    'bloc de notas': 'notepad.exe',
    'bloc notas': 'notepad.exe',
    'libreta de notas': 'notepad.exe',
    'notas': 'notepad.exe',
    'calc': 'calc.exe',
    'calculadora': 'calc.exe',
    'calculator': 'calc.exe',
    'explorer': 'explorer.exe',
    'explorador': 'explorer.exe',
    'explorador de archivos': 'explorer.exe',
    'file explorer': 'explorer.exe',
    'archivos': 'explorer.exe',
    'mis archivos': 'explorer.exe',
    'carpetas': 'explorer.exe',
    'carpeta': 'explorer.exe',
    'vscode': 'code',
    'code': 'code',
    'visual studio code': 'code',
    'terminal': 'wt.exe',
    'windows terminal': 'wt.exe',
    'powershell': 'powershell.exe',
    'cmd': 'cmd.exe',
    'consola': 'cmd.exe',
    'simbolo del sistema': 'cmd.exe',
    'símbolo del sistema': 'cmd.exe',
    'settings': 'ms-settings:',
    'configuracion': 'ms-settings:',
    'configuración': 'ms-settings:',
    'configuracion de windows': 'ms-settings:',
    'configuración de windows': 'ms-settings:',
    'windows settings': 'ms-settings:',
    'ajustes': 'ms-settings:',
    'taskmgr': 'taskmgr.exe',
    'task manager': 'taskmgr.exe',
    'administrador de tareas': 'taskmgr.exe',
    'admin de tareas': 'taskmgr.exe',
    'spotify': 'spotify',
    'paint': 'mspaint.exe',
    'control': 'control.exe',
    'panel de control': 'control.exe',
    'reloj': 'ms-clock:',
    'alarma': 'ms-clock:',
    'alarmas': 'ms-clock:',
    'clima': 'bingweather:',
    'camara': 'microsoft.windows.camera:',
    'cámara': 'microsoft.windows.camera:',
    'word': 'winword.exe',
    'excel': 'excel.exe',
    'powerpoint': 'powerpnt.exe',
    'steam': 'steam',
    'discord app': 'discord',
  };

  if (APPS[lower] || APPS[stripped]) {
    const resolved = APPS[lower] || APPS[stripped];
    if (resolved.startsWith('ms-') || resolved.startsWith('microsoft.') || resolved.startsWith('bing')) {
      return { type: 'uri', target: resolved };
    }
    return { type: 'app', target: resolved };
  }

  return { type: 'raw', target: t };
}

class ToolEngine {
  constructor({ getConfig, setConfig, getActiveWindow, requestPermission }) {
    this.getConfig = getConfig;
    this.setConfig = setConfig;
    this.getActiveWindow = getActiveWindow;
    this.requestPermission = requestPermission;
    this.pendingDecisions = new Map();
  }

  isTier2(toolName) {
    return ['run_shell_command', 'write_or_edit_file', 'kill_process'].includes(toolName);
  }

  isPreApproved(toolName, params) {
    const cfg = this.getConfig?.() || {};
    const prefixes = cfg.allowedPrefixes || [];
    if (!prefixes.length) return false;

    if (toolName === 'run_shell_command') {
      const cmd = String(params.command || '').trim().toLowerCase();
      return prefixes.some((p) => cmd.startsWith(p.toLowerCase()));
    }
    if (toolName === 'write_or_edit_file') {
      const file = String(params.filePath || '').trim().toLowerCase();
      return prefixes.some((p) => file.startsWith(p.toLowerCase()));
    }
    if (toolName === 'kill_process') {
      const proc = String(params.processName || params.pid || '').trim().toLowerCase();
      return prefixes.some((p) => proc === p.toLowerCase());
    }
    return false;
  }

  async checkPermission(toolName, params) {
    if (!this.isTier2(toolName)) return true;
    if (this.isPreApproved(toolName, params)) return true;

    let commandDisplay = '';
    if (toolName === 'run_shell_command') {
      commandDisplay = params.command;
    } else if (toolName === 'write_or_edit_file') {
      commandDisplay = `${params.append ? '>>' : '>'} ${params.filePath} (${params.content?.length || 0} bytes)`;
    } else if (toolName === 'kill_process') {
      commandDisplay = `taskkill /F /IM ${params.processName || params.pid}`;
    }

    if (!this.requestPermission) {
      throw new Error(`Permiso requerido para acción de Nivel 2: ${commandDisplay}`);
    }

    const decision = await this.requestPermission({
      tool: toolName.toUpperCase(),
      command: commandDisplay,
      line: 'Autorización táctica requerida para ejecutar acción crítica en el sistema.',
    });

    if (decision === 'deny') {
      throw new Error('Acción de Nivel 2 denegada por el operador táctico.');
    }

    if (decision === 'always') {
      let prefix = commandDisplay.trim();
      if (toolName === 'run_shell_command') {
        const parts = prefix.split(/\s+/);
        prefix = parts.slice(0, 2).join(' '); // e.g. "git status" or "npm test"
      } else if (toolName === 'kill_process') {
        prefix = String(params.processName || params.pid).trim();
      }
      const cfg = this.getConfig?.() || {};
      const prefixes = Array.from(new Set([...(cfg.allowedPrefixes || []), prefix]));
      this.setConfig?.({ allowedPrefixes: prefixes });
    }

    return true;
  }

  // ---------- Tier 1 Tools ----------

  async open_app_or_url({ target }) {
    if (!target) throw new Error('Parámetro "target" requerido.');
    const resolved = resolveTarget(target);
    const isWin = process.platform === 'win32';

    if (resolved.type === 'url') {
      const url = resolved.target;
      if (electron?.shell?.openExternal) {
        await electron.shell.openExternal(url);
      } else if (isWin) {
        spawn('cmd.exe', ['/c', 'start', '', url], { windowsHide: true, detached: true, stdio: 'ignore' });
      } else {
        spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
      }
      return { ok: true, action: 'open_url', target: url, resolvedFrom: target };
    }

    if (resolved.type === 'uri') {
      const uri = resolved.target;
      if (isWin) {
        spawn('cmd.exe', ['/c', 'start', '', uri], { windowsHide: true, detached: true, stdio: 'ignore' });
      }
      return { ok: true, action: 'open_uri', target: uri, resolvedFrom: target };
    }

    const localPath = resolved.target;
    if (fs.existsSync(localPath)) {
      if (electron?.shell?.openPath) {
        const res = await electron.shell.openPath(localPath);
        if (res) throw new Error(`No se pudo abrir la ruta: ${res}`);
      } else if (isWin) {
        spawn('explorer.exe', [localPath], { detached: true, stdio: 'ignore' });
      } else {
        spawn('xdg-open', [localPath], { detached: true, stdio: 'ignore' });
      }
      return { ok: true, action: 'open_path', target: localPath, resolvedFrom: target };
    }

    const appTarget = resolved.target;
    if (isWin) {
      const child = spawn('cmd.exe', ['/c', 'start', '', appTarget], {
        detached: true,
        windowsHide: true,
        stdio: 'ignore',
      });
      child.unref();
    } else {
      const child = spawn(appTarget, [], {
        detached: true,
        shell: true,
        stdio: 'ignore',
      });
      child.unref();
    }

    return { ok: true, action: 'launch_app', target: appTarget, resolvedFrom: target };
  }

  async media_and_volume({ action = 'up', value = null }) {
    // Actions: 'up', 'down', 'mute', 'unmute', 'play_pause', 'next', 'prev', 'notify'
    const act = action.toLowerCase();
    if (act === 'notify') {
      const msg = String(value || 'Notificación táctica ZeroMate');
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $notify = New-Object System.Windows.Forms.NotifyIcon
        $notify.Icon = [System.Drawing.SystemIcons]::Information
        $notify.Visible = $true
        $notify.ShowBalloonTip(4000, "ZeroMate", "${msg.replace(/"/g, '`"')}", [System.Windows.Forms.ToolTipIcon]::Info)
      `;
      await this.runPsScript(psScript);
      return { ok: true, action: 'notify', message: msg };
    }

    // VK codes for user32 keybd_event
    const VK_MAP = {
      up: 0xAF,
      down: 0xAE,
      mute: 0xAD,
      unmute: 0xAD,
      play_pause: 0xB3,
      next: 0xB0,
      prev: 0xB1,
    };

    const vk = VK_MAP[act];
    if (!vk) throw new Error(`Acción de medios no soportada: ${action}`);

    // If repeat count for volume up/down
    const repeat = act === 'up' || act === 'down' ? (typeof value === 'number' && value > 0 ? Math.min(value, 20) : 3) : 1;
    const psScript = `
      Add-Type -TypeDefinition @"
      using System;
      using System.Runtime.InteropServices;
      public class MediaKey {
        [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
        public static void Press(byte vk, int count) {
          for (int i = 0; i < count; i++) {
            keybd_event(vk, 0, 0, UIntPtr.Zero);
            keybd_event(vk, 0, 2, UIntPtr.Zero);
          }
        }
      }
"@
      [MediaKey]::Press(${vk}, ${repeat})
    `;
    await this.runPsScript(psScript);
    return { ok: true, action: act, repeat };
  }

  async search_files({ query, baseDir = os.homedir(), maxResults = 15 }) {
    if (!query) throw new Error('Parámetro "query" requerido.');
    const q = String(query).toLowerCase();
    const startDir = fs.existsSync(baseDir) ? baseDir : os.homedir();
    const results = [];

    function walk(currentDir, depth = 0) {
      if (depth > 4 || results.length >= maxResults) return;
      let entries = [];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const ent of entries) {
        if (ent.name.startsWith('.') || ent.name === 'node_modules' || ent.name === 'dist') continue;
        const full = path.join(currentDir, ent.name);
        if (ent.name.toLowerCase().includes(q)) {
          results.push({ name: ent.name, path: full, isDir: ent.isDirectory() });
          if (results.length >= maxResults) return;
        }
        if (ent.isDirectory()) {
          walk(full, depth + 1);
        }
      }
    }

    walk(startDir, 0);
    return { ok: true, count: results.length, baseDir: startDir, results };
  }

  async read_clipboard() {
    if (electron?.clipboard?.readText) {
      const text = electron.clipboard.readText();
      return { ok: true, text: text || '', length: (text || '').length };
    }
    return new Promise((resolve) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-Command', 'Get-Clipboard'], { windowsHide: true });
      let text = '';
      child.stdout.on('data', (d) => { text += d.toString('utf8'); });
      child.on('close', () => {
        const trimmed = text.trim();
        resolve({ ok: true, text: trimmed, length: trimmed.length });
      });
      child.on('error', () => resolve({ ok: true, text: '', length: 0 }));
    });
  }

  async write_clipboard({ text }) {
    const val = String(text || '');
    if (electron?.clipboard?.writeText) {
      electron.clipboard.writeText(val);
      return { ok: true, length: val.length };
    }
    return new Promise((resolve) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-Command', `$input | Set-Clipboard`], { windowsHide: true });
      child.stdin.write(val);
      child.stdin.end();
      child.on('close', () => resolve({ ok: true, length: val.length }));
      child.on('error', () => resolve({ ok: true, length: val.length }));
    });
  }

  async capture_active_window() {
    const winInfo = this.getActiveWindow?.() || { fgTitle: 'Escritorio', fgApp: 'Explorer' };
    return {
      ok: true,
      title: winInfo.fgTitle || 'Ventana Activa',
      app: winInfo.fgApp || 'Sistema',
      scanned: true,
    };
  }

  async web_search({ query }) {
    if (!query) throw new Error('Parámetro "query" requerido.');
    const q = String(query).trim();
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'ZeroMate/1.0' } });
      const data = await res.json();
      const abstract = data.AbstractText || data.Answer || '';
      const related = (data.RelatedTopics || [])
        .slice(0, 3)
        .map((r) => r.Text)
        .filter(Boolean);

      return {
        ok: true,
        query: q,
        summary: abstract || (related.length ? related.join(' | ') : `Búsqueda ejecutada para: ${q}`),
        heading: data.Heading || q,
        sourceUrl: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
      };
    } catch {
      return {
        ok: true,
        query: q,
        summary: `Resultados disponibles en la web para "${q}".`,
        sourceUrl: `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
      };
    }
  }

  // ---------- Progressive Skills & Compressed User Memory (Tier 1) ----------

  async load_skill({ filename }) {
    if (!filename) throw new Error('Parámetro "filename" requerido.');
    const cleanName = filename.endsWith('.ctx') ? filename : `${filename}.ctx`;
    const targetFile = path.join(ROOT, 'skills', cleanName);
    if (!fs.existsSync(targetFile)) {
      throw new Error(`La skill "${cleanName}" no existe en skills/.`);
    }
    const content = fs.readFileSync(targetFile, 'utf8').trim();
    return { ok: true, filename: cleanName, content };
  }

  async save_skill({ filename, dsl, summary = 'Rutina táctica de ZeroMate' }) {
    if (!filename || !dsl) throw new Error('Parámetros "filename" y "dsl" requeridos.');
    const cleanName = filename.endsWith('.ctx') ? filename : `${filename}.ctx`;
    const targetFile = path.join(ROOT, 'skills', cleanName);
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, String(dsl).trim() + '\n', 'utf8');

    // Update skills/INDEX.ctx
    const indexFile = path.join(ROOT, 'skills', 'INDEX.ctx');
    let indexContent = fs.existsSync(indexFile) ? fs.readFileSync(indexFile, 'utf8').trim() : '#SKILLS_INDEX:ZeroMate_Skills|VERSION:1.0';
    if (!indexContent.includes(cleanName)) {
      indexContent += `\n${cleanName}|DESC:${summary.replace(/[\r\n|]/g, ' ')}`;
      fs.writeFileSync(indexFile, indexContent + '\n', 'utf8');
    }
    return { ok: true, filename: cleanName, summary };
  }

  async update_user_memory({ key, fact }) {
    if (!key || !fact) throw new Error('Parámetros "key" y "fact" requeridos.');
    const memFile = path.join(ROOT, 'skills', 'user-memory.ctx');
    const exampleFile = path.join(ROOT, 'skills', 'user-memory.example.ctx');
    let content = '';
    if (fs.existsSync(memFile)) {
      content = fs.readFileSync(memFile, 'utf8');
    } else if (fs.existsSync(exampleFile)) {
      content = fs.readFileSync(exampleFile, 'utf8');
    } else {
      content = 'ID:Unknown|OS:auto|LANG:auto|PATHS:{}|PREFS:[]|NOTES:[]\n';
    }
    const cleanKey = String(key).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const cleanFact = String(fact).trim().replace(/[\r\n]/g, ' ');

    const lineRegex = new RegExp(`^${cleanKey}:.*$`, 'm');
    if (lineRegex.test(content)) {
      content = content.replace(lineRegex, `${cleanKey}:${cleanFact}`);
    } else {
      content = content.trim() + `\n${cleanKey}:${cleanFact}\n`;
    }
    fs.writeFileSync(memFile, content, 'utf8');
    return { ok: true, key: cleanKey, fact: cleanFact };
  }

  // ---------- Tier 2 Tools (Critical Actions) ----------

  async run_shell_command({ command, cwd = ROOT }) {
    if (!command) throw new Error('Parámetro "command" requerido.');
    await this.checkPermission('run_shell_command', { command });

    return new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
        cwd: fs.existsSync(cwd) ? cwd : ROOT,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
      child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });

      child.on('close', (code) => {
        resolve({
          ok: code === 0,
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      });

      child.on('error', (err) => reject(err));
    });
  }

  async write_or_edit_file({ filePath, content, append = false }) {
    if (!filePath) throw new Error('Parámetro "filePath" requerido.');
    await this.checkPermission('write_or_edit_file', { filePath, content, append });

    const fullPath = path.resolve(ROOT, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    if (append) {
      fs.appendFileSync(fullPath, String(content || ''), 'utf8');
    } else {
      fs.writeFileSync(fullPath, String(content || ''), 'utf8');
    }
    return { ok: true, path: fullPath, append, bytes: Buffer.byteLength(content || '', 'utf8') };
  }

  async kill_process({ processName, pid }) {
    if (!processName && !pid) throw new Error('Debe especificar "processName" o "pid".');
    await this.checkPermission('kill_process', { processName, pid });

    const args = ['/F'];
    if (processName) args.push('/IM', processName);
    if (pid) args.push('/PID', String(pid));

    return new Promise((resolve, reject) => {
      const child = spawn('taskkill', args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      child.stdout.on('data', (d) => { out += d.toString('utf8'); });
      child.stderr.on('data', (d) => { out += d.toString('utf8'); });
      child.on('close', (code) => {
        resolve({ ok: code === 0, code, output: out.trim() });
      });
      child.on('error', (err) => reject(err));
    });
  }

  // Helper for running internal background PowerShell without popups
  runPsScript(script) {
    return new Promise((resolve) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      child.on('close', () => resolve());
      child.on('error', () => resolve());
    });
  }

  // Execute tool by name
  async execute(name, params = {}) {
    if (typeof this[name] !== 'function') {
      throw new Error(`Herramienta "${name}" no reconocida por ToolEngine.`);
    }
    return this[name](params);
  }
}

module.exports = { ToolEngine };
