'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const {
  app, BrowserWindow, Tray, Menu, ipcMain, screen, protocol, net, shell, globalShortcut, nativeImage,
} = require('electron');

const config = require('./config');
const { listThemes, loadThemePackage } = require('./themes');
const { createBridge } = require('./bridge');
const { startWindowWatch } = require('./windows');
const { transcribePcm16k } = require('./stt');
const { BrainRouter, PROVIDERS } = require('../brains');
const { ToolEngine } = require('../tools');
const agyHooks = require('../../scripts/install-hooks-agy');
const claudeHooks = require('../../scripts/install-hooks');

const pendingPermissionMap = new Map();
let permCounter = 0;

const toolEngine = new ToolEngine({
  getConfig: () => config.load(),
  setConfig: (patch) => updateConfig(patch),
  getActiveWindow: () => windowWatch?.getForeground?.() || { fgTitle: '', fgApp: '' },
  requestPermission: ({ tool, command, line }) => {
    return new Promise((resolve) => {
      const id = `perm_${++permCounter}`;
      pendingPermissionMap.set(id, resolve);
      overlay?.webContents.send('tool:request-permission', { id, tool, command, line });
    });
  },
});

const brainRouter = new BrainRouter({ getConfig: () => config.load(), toolEngine });

const ROOT = path.resolve(__dirname, '..', '..');
const DEV = process.argv.includes('--dev');
const PORT = Number(process.env.ZEROMATE_PORT || process.env.YORHA_PORT) || 47823;

protocol.registerSchemesAsPrivileged([
  { scheme: 'zeromate', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
  { scheme: 'yorha', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

let overlay = null;
let tray = null;
let windowWatch = null;

function serveProtocol() {
  const handler = (request) => {
    const url = new URL(request.url);
    const base = ROOT;
    const target = path.resolve(base, '.' + decodeURIComponent(url.pathname));
    if (target !== base && !target.startsWith(base + path.sep)) {
      return new Response('forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(target).toString());
  };
  protocol.handle('zeromate', handler);
  protocol.handle('yorha', handler);
}

function targetDisplay() {
  const { displayId } = config.load();
  return screen.getAllDisplays().find((d) => d.id === displayId) || screen.getPrimaryDisplay();
}

function fitOverlay() {
  if (!overlay) return;
  const { workArea } = targetDisplay();
  overlay.setBounds(workArea);
  overlay.webContents.send('overlay:resize', { width: workArea.width, height: workArea.height });
}

function createOverlay() {
  const { workArea } = targetDisplay();
  overlay = new BrowserWindow({
    ...workArea,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    alwaysOnTop: true,
    type: process.platform === 'win32' ? 'toolbar' : undefined,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.loadURL('zeromate://app/src/renderer/index.html');
  overlay.once('ready-to-show', () => overlay.showInactive());

  overlay.webContents.on('render-process-gone', (_e, details) => {
    console.error('[zeromate] renderer gone:', details.reason);
  });

  if (DEV) {
    overlay.webContents.on('console-message', (e) => {
      const { level, message, lineNumber, sourceId } = e;
      console.log(`[renderer:${level}] ${message} (${String(sourceId).split('/').pop()}:${lineNumber})`);
    });
    if (process.env.ZEROMATE_DEVTOOLS || process.env.YORHA_DEVTOOLS) overlay.webContents.openDevTools({ mode: 'detach' });
  }
}

function sendCommand(name, payload = {}) {
  overlay?.webContents.send('yorha:command', { name, ...payload });
}

function toggleVisible(force) {
  const visible = typeof force === 'boolean' ? force : !config.load().visible;
  config.save({ visible });
  sendCommand('slot', { slot: 'stow', on: !visible });
  rebuildTray();
}

function rendererConfig() {
  const cfg = config.load();
  return { ...cfg, lang: cfg.lang === 'auto' ? 'en' : (cfg.lang || 'en') };
}

function updateConfig(patch) {
  const prev = config.load();
  config.save(patch);
  const cfg = rendererConfig();
  overlay?.webContents.send('yorha:config', cfg);
  if (patch.theme && patch.theme !== prev.theme) {
    overlay?.webContents.send('yorha:theme', loadThemePackage(patch.theme));
  }
  rebuildTray();
  return cfg;
}

function rebuildTray() {
  if (!tray) return;
  const cfg = config.load();
  const lang = cfg.lang || 'en';
  const isEs = lang === 'es';
  const themes = listThemes();
  const activeTheme = loadThemePackage(cfg.theme);
  const displays = screen.getAllDisplays();
  const currentDisplay = targetDisplay().id;

  const charName = activeTheme.character?.name || (isEs ? 'Personaje' : 'Character');
  const compName = activeTheme.companion?.name || (isEs ? 'Acompañante' : 'Companion');
  const themeName = activeTheme.name || 'ZeroMate';

  const menu = Menu.buildFromTemplate([
    { label: `ZeroMate [${themeName}] — ${isEs ? 'Puerto' : 'Port'} ${PORT}`, enabled: false },
    { type: 'separator' },
    { label: isEs ? `Estado Táctico (${compName})` : `Tactical Status (${compName})`, click: () => sendCommand('status') },
    { label: isEs ? `Abrir Barra de Chat (${themeName})` : `Open Chat HUD (${themeName})`, accelerator: 'Alt+Space', click: () => sendCommand('chat:toggle') },
    { label: isEs ? 'Voz Local Push-to-Talk (Whisper STT)' : 'Local Push-to-Talk Voice (Whisper STT)', accelerator: 'Ctrl+Space', click: () => sendCommand('ptt:toggle') },
    { label: isEs ? `Planear con ${compName} (Slot: traverse)` : `Glide with ${compName} (Slot: traverse)`, click: () => sendCommand('slot', { slot: 'traverse' }) },
    { label: isEs ? 'Sentarse en Ventana (Slot: sit_window)' : 'Sit on Window (Slot: sit_window)', click: () => sendCommand('slot', { slot: 'sit_window' }) },
    { label: isEs ? 'Gesto en Reposo (Slot: idle_quirk)' : 'Idle Quirk (Slot: idle_quirk)', click: () => sendCommand('slot', { slot: 'idle_quirk' }) },
    { label: isEs ? `Interactuar con ${compName} (Slot: companion_interact)` : `Interact with ${compName} (Slot: companion_interact)`, click: () => sendCommand('slot', { slot: 'companion_interact' }) },
    { label: isEs ? 'Reacción al Molestar (Slot: poke_annoyed)' : 'Poke Reaction (Slot: poke_annoyed)', click: () => sendCommand('slot', { slot: 'poke_annoyed' }) },
    { label: isEs ? 'Acción de Apoyo / Escáner (Slot: tool_work)' : 'Assist Tool / Scan (Slot: tool_work)', click: () => sendCommand('slot', { slot: 'tool_work' }) },
    { label: isEs ? 'Alerta de Autorización (Slot: alert_confirm)' : 'Authorization Alert (Slot: alert_confirm)', click: () => sendCommand('slot', { slot: 'alert_confirm' }) },
    { label: isEs ? 'Celebración (Slot: victory)' : 'Victory Flourish (Slot: victory)', click: () => sendCommand('slot', { slot: 'victory' }) },
    {
      label: cfg.visible
        ? (isEs ? `Guardar ${charName} (Dejar ${compName})` : `Stow ${charName} (Keep ${compName})`)
        : (isEs ? `Desplegar ${charName}` : `Deploy ${charName}`),
      accelerator: 'Ctrl+Alt+C',
      click: () => toggleVisible(),
    },
    { type: 'separator' },
    {
      label: isEs ? 'Idioma (Language)' : 'Language (Idioma)',
      submenu: [
        { label: 'English (Default)', type: 'radio', checked: (cfg.lang || 'en') === 'en', click: () => updateConfig({ lang: 'en' }) },
        { label: 'Español', type: 'radio', checked: cfg.lang === 'es', click: () => updateConfig({ lang: 'es' }) },
      ],
    },
    {
      label: isEs ? 'Cerebro IA (Multi-Brain Router)' : 'AI Brain (Multi-Brain Router)',
      submenu: [
        ...PROVIDERS.map((p) => ({
          label: p.label,
          type: 'radio',
          checked: (cfg.brainProvider || 'agy') === p.id,
          click: () => updateConfig({ brainProvider: p.id }),
        })),
        { type: 'separator' },
        {
          label: isEs ? 'Configurar API Keys / Modelo...' : 'Configure API Keys / Model...',
          click: () => sendCommand('brain:config'),
        },
      ],
    },
    {
      label: isEs ? 'Temática (Multi-Theme)' : 'Theme (Multi-Theme)',
      submenu: themes.map((th) => ({
        label: th.name,
        type: 'radio',
        checked: cfg.theme === th.id,
        click: () => updateConfig({ theme: th.id }),
      })),
    },
    {
      label: isEs ? 'Tamaño de Sprite' : 'Sprite Scale',
      submenu: (isEs ? [['Pequeño', 0.48], ['Medio', 0.62], ['Grande', 0.78]] : [['Small', 0.48], ['Medium', 0.62], ['Large', 0.78]]).map(([label, scale]) => ({
        label,
        type: 'radio',
        checked: Math.abs(cfg.scale - scale) < 0.02,
        click: () => updateConfig({ scale }),
      })),
    },
    {
      label: isEs ? `Audio (${themeName})` : `Audio (${themeName})`,
      submenu: [
        { label: isEs ? 'Silenciar' : 'Mute', type: 'checkbox', checked: cfg.muted, click: (item) => updateConfig({ muted: item.checked }) },
        { type: 'separator' },
        {
          label: isEs ? 'Abrir carpeta de sonidos del tema' : 'Open theme sounds directory',
          click: () => shell.openPath(path.join(ROOT, 'themes', cfg.theme, 'sounds')),
        },
      ],
    },
    {
      label: isEs ? 'Iniciativa Proactiva' : 'Proactive Initiative',
      submenu: [
        { label: isEs ? 'Hablar ahora (Probar iniciativa)' : 'Trigger now (Test initiative)', click: () => sendCommand('proactive:now') },
        { type: 'separator' },
        ...(isEs
          ? [['Cada 10 min', 10], ['Cada 25 min (Default)', 25], ['Cada 45 min', 45], ['Cada 1 hora', 60], ['Desactivado', 0]]
          : [['Every 10 min', 10], ['Every 25 min (Default)', 25], ['Every 45 min', 45], ['Every 1 hour', 60], ['Disabled', 0]]
        ).map(([label, mins]) => ({
          label,
          type: 'radio',
          checked: cfg.proactiveMinutes === mins,
          click: () => updateConfig({ proactiveMinutes: mins }),
        })),
      ],
    },
    {
      label: isEs ? 'Puente de Hooks Pasivos (IDE / CLI)' : 'Passive Hook Bridge (IDE / CLI)',
      submenu: [
        {
          label: agyHooks.status()
            ? (isEs ? '✓ Hooks de Antigravity (AGY) Instalados — Desinstalar' : '✓ Antigravity (AGY) Hooks Installed — Uninstall')
            : (isEs ? 'Instalar Hooks en Antigravity (AGY)' : 'Install Hooks into Antigravity (AGY)'),
          click: () => {
            if (agyHooks.status()) agyHooks.uninstall();
            else agyHooks.install();
            rebuildTray();
            sendCommand('hooks:notify', { target: 'Antigravity', installed: agyHooks.status() });
          },
        },
        {
          label: claudeHooks.status()
            ? (isEs ? '✓ Hooks de Claude Code Instalados — Desinstalar' : '✓ Claude Code Hooks Installed — Uninstall')
            : (isEs ? 'Instalar Hooks en Claude Code' : 'Install Hooks into Claude Code'),
          click: () => {
            if (claudeHooks.status()) claudeHooks.uninstall();
            else claudeHooks.install();
            rebuildTray();
            sendCommand('hooks:notify', { target: 'Claude Code', installed: claudeHooks.status() });
          },
        },
      ],
    },
    {
      label: isEs ? 'Pantalla' : 'Display',
      enabled: displays.length > 1,
      submenu: displays.map((d, i) => ({
        label: `${i + 1} — ${d.size.width}×${d.size.height}`,
        type: 'radio',
        checked: d.id === currentDisplay,
        click: () => { config.save({ displayId: d.id }); fitOverlay(); rebuildTray(); },
      })),
    },
    { label: isEs ? 'Deambular y sentarse en ventanas' : 'Autonomous window wandering & perching', type: 'checkbox', checked: cfg.wander, click: (item) => updateConfig({ wander: item.checked }) },
    { type: 'separator' },
    { label: isEs ? 'Salir de ZeroMate' : 'Quit ZeroMate', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(`ZeroMate — ${themeName}`);
}

function createTray() {
  const cfg = config.load();
  const activeTheme = loadThemePackage(cfg.theme);
  const iconPath = path.join(ROOT, 'themes', cfg.theme, 'assets', 'tray.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip(`ZeroMate — ${activeTheme.name || 'Desktop Agent'}`);
  tray.on('click', () => sendCommand('status'));
  rebuildTray();
}

function registerIpc() {
  ipcMain.on('overlay:interactive', (_e, on) => {
    overlay?.setIgnoreMouseEvents(!on, { forward: true });
  });
  ipcMain.on('overlay:focusable', (_e, on) => {
    if (!overlay || overlay.isDestroyed()) return;
    overlay.setFocusable(Boolean(on));
    if (on) {
      overlay.setIgnoreMouseEvents(false);
      overlay.focus();
    } else {
      overlay.blur();
    }
  });
  ipcMain.handle('overlay:cursor', () => {
    const p = screen.getCursorScreenPoint();
    const b = overlay.getBounds();
    return { x: p.x - b.x, y: p.y - b.y, inside: p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height };
  });
  ipcMain.handle('config:get', () => rendererConfig());
  ipcMain.handle('config:set', (_e, patch) => updateConfig(patch));
  ipcMain.handle('theme:get', () => loadThemePackage(config.load().theme));
  ipcMain.handle('theme:list', () => listThemes());
  ipcMain.handle('stt:transcribe', async (_e, pcm16k) => {
    const lang = config.load().lang === 'en' ? 'en' : 'es';
    return transcribePcm16k(pcm16k, { lang });
  });
  ipcMain.handle('brain:ask', async (_e, prompt, opts = {}) => brainRouter.ask(prompt, opts));
  ipcMain.handle('brain:providers', () => brainRouter.listProviders());
  ipcMain.handle('tool:run', async (_e, name, params) => toolEngine.execute(name, params));
  ipcMain.on('tool:decision', (_e, { id, decision }) => {
    const cb = pendingPermissionMap.get(id);
    if (cb) {
      pendingPermissionMap.delete(id);
      cb(decision);
    }
  });
}

const testWins = new Map();

async function debugHandler(route, body) {
  if (!DEV) throw new Error('debug routes need --dev');
  if (route === 'command') {
    sendCommand(body.name, body);
    return { ok: true };
  }
  if (route === 'slot') {
    sendCommand('slot', body);
    return { ok: true };
  }
  if (route === 'testwin') {
    const id = body.id ?? 'main';
    if (!body.open && body.id === undefined) {
      for (const win of testWins.values()) win.destroy();
      testWins.clear();
      return { ok: true };
    }
    testWins.get(id)?.destroy();
    testWins.delete(id);
    if (body.open) {
      const b = overlay.getBounds();
      const win = new BrowserWindow({
        x: b.x + (body.x ?? 300), y: b.y + (body.y ?? 360), width: body.w ?? 720, height: body.h ?? 380,
        show: false, alwaysOnTop: true, title: `ZeroMate Test Terminal ${id}`, backgroundColor: '#1a1917',
      });
      win.loadURL('data:text/html,<body style="background:%231a1917;color:%23dad4bb;font-family:Consolas,monospace;padding:16px">[ZeroMate Test Window]</body>');
      win.showInactive();
      testWins.set(id, win);
    }
    return { ok: true };
  }
  if (route === 'capture') {
    const image = await overlay.webContents.capturePage();
    const dir = path.join(ROOT, 'captures');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${(body.name || 'frame').replace(/[^\w-]/g, '')}.png`);
    fs.writeFileSync(file, image.toPNG());
    return { ok: true, file };
  }
  throw new Error('unknown debug route');
}

function bootstrapUserMemory() {
  const mem = path.join(ROOT, 'skills', 'user-memory.ctx');
  const example = path.join(ROOT, 'skills', 'user-memory.example.ctx');
  if (!fs.existsSync(mem) && fs.existsSync(example)) {
    try {
      fs.copyFileSync(example, mem);
    } catch {}
  }
}

function main() {
  bootstrapUserMemory();
  app.commandLine.appendSwitch('disable-http-cache');
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on('second-instance', () => sendCommand('status'));
  if (process.platform === 'win32') app.setAppUserModelId('zeromate.desktop.agent');

  app.whenReady().then(() => {
    serveProtocol();
    registerIpc();
    createOverlay();
    createTray();
    windowWatch = startWindowWatch({
      overlay,
      onUpdate: (data) => overlay?.webContents.send('windows:update', data),
    });
    createBridge({
      port: PORT,
      onEvent: (evt) => overlay?.webContents.send('hook:event', evt),
      onDebug: DEV ? debugHandler : null,
    });
    globalShortcut.register('Control+Alt+C', () => toggleVisible());
    globalShortcut.register('Alt+Space', () => sendCommand('chat:toggle'));
    globalShortcut.register('Control+Space', () => sendCommand('ptt:toggle'));
    screen.on('display-metrics-changed', fitOverlay);
    screen.on('display-added', () => { fitOverlay(); rebuildTray(); });
    screen.on('display-removed', () => { fitOverlay(); rebuildTray(); });
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    windowWatch?.stop();
  });
  app.on('window-all-closed', (e) => e.preventDefault());
}

main();
