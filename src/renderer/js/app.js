// Renderer Bootstrap (src/renderer/js/app.js)
// Initializes the Multi-Theme Semantic Action Slots Engine (ThemeEngine),
// SoundBank (.wav files from themes/<id>/sounds/), FxLayer, ChatBar, ProactiveScheduler,
// and Click-Through hit-testing.

import { ThemeEngine, NIER_DIALOGUES } from './theme-engine.js';
import { FxLayer } from './fx.js';
import { Panel } from './panel.js';
import { ChatBar } from './chat-bar.js';
import { ProactiveScheduler } from './proactive.js';
import { VoicePTT } from './voice-stt.js';
import { SoundBank } from './sound-bank.js';
import { SettingsModal } from './settings-modal.js';
import { pick } from './util.js';

const host = window.host;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function boot() {
  const [config, theme] = await Promise.all([
    host.getConfig(),
    host.getTheme(),
    document.fonts.load('600 16px "Chakra Petch"').catch(() => {}),
    document.fonts.load('400 11px "JetBrains Mono"').catch(() => {}),
  ]);

  const [charImg, sitImg, peekImg, sleepImg, spinImg, satelliteImg, podImg, katanaImg, cutinSlash, cutinEyes] = await Promise.all([
    loadImage(theme.character.spriteUrl),
    theme.character.sitSpriteUrl ? loadImage(theme.character.sitSpriteUrl).catch(() => null) : Promise.resolve(null),
    theme.character.peekSpriteUrl ? loadImage(theme.character.peekSpriteUrl).catch(() => null) : Promise.resolve(null),
    theme.character.sleepSpriteUrl ? loadImage(theme.character.sleepSpriteUrl).catch(() => null) : Promise.resolve(null),
    theme.character.spinSpriteUrl ? loadImage(theme.character.spinSpriteUrl).catch(() => null) : Promise.resolve(null),
    theme.satelliteUrl ? loadImage(theme.satelliteUrl).catch(() => null) : Promise.resolve(null),
    loadImage(theme.companion.spriteUrl),
    loadImage(theme.character.weaponUrl),
    loadImage(theme.character.cutinUrls.slash),
    loadImage(theme.character.cutinUrls.eyes),
  ]);

  const soundBank = new SoundBank();
  soundBank.configure(config);
  await soundBank.loadThemeSounds(theme.sounds);

  const fx = new FxLayer(document.getElementById('fx'), {
    cutins: { slash: cutinSlash, eyes: cutinEyes },
  });
  fx.resize(innerWidth, innerHeight);

  const panel = new Panel({
    panel: document.getElementById('panel'),
    ticker: document.getElementById('ticker'),
    theme,
  });

  const engine = new ThemeEngine({
    charRoot: document.getElementById('character'),
    spriteCanvas: document.getElementById('sprite'),
    weaponCanvas: document.getElementById('weapon-back'),
    podRoot: document.getElementById('pod'),
    podCanvas: document.getElementById('pod-canvas'),
    images: { charImg, sitImg, peekImg, sleepImg, spinImg, satelliteImg, podImg, katanaImg },
    fx,
    soundBank,
    panel,
    theme,
  });

  engine.wander = config.wander;
  engine.setScale(config.scale);

  const handleUserCommand = async (text) => {
    engine.triggerSlot('tool_work', {
      tag: 'ENLACE IA',
      line: `Reporte: Procesando transmisión — "${text}"`,
    });
    const res = await host.askBrain(text);
    if (!res) return;
    if (res.slot && res.slot !== 'tool_work') {
      engine.triggerSlot(res.slot);
    }
    soundBank.play(res.speaker === 'pod' ? 'pod-ack' : 'ui-confirm');
    panel.say({
      kind: 'info',
      speaker: res.speaker || '2b',
      tag: (res.provider || 'ZEROMATE').toUpperCase(),
      line: res.line,
      hold: 7000,
    });
  };

  // YoRHa Multi-Brain Config Modal wiring
  const brainModal = document.getElementById('brain-modal');
  const brainForm = document.getElementById('brain-form');
  const brainProviderEl = document.getElementById('brain-provider');
  const brainModelEl = document.getElementById('brain-model');
  const brainOllamaEl = document.getElementById('brain-ollama-url');
  const keyGeminiEl = document.getElementById('brain-key-gemini');
  const keyOpenaiEl = document.getElementById('brain-key-openai');
  const keyClaudeEl = document.getElementById('brain-key-claude');

  const openBrainModal = async () => {
    const cfg = await host.getConfig();
    brainProviderEl.value = cfg.brainProvider || 'agy';
    brainModelEl.value = cfg.brainModel || '';
    brainOllamaEl.value = cfg.ollamaUrl || 'http://127.0.0.1:11434';
    keyGeminiEl.value = cfg.brainKeys?.gemini || '';
    keyOpenaiEl.value = cfg.brainKeys?.openai || '';
    keyClaudeEl.value = cfg.brainKeys?.claude || '';
    brainModal.hidden = false;
    soundBank.play('ui-open');
    host.setFocusable(true);
  };

  const closeBrainModal = () => {
    if (brainModal.hidden) return;
    brainModal.hidden = true;
    soundBank.play('ui-cancel');
    if (!chatBar.visible) host.setFocusable(false);
  };

  document.getElementById('brain-close-btn')?.addEventListener('click', closeBrainModal);
  document.getElementById('brain-cancel-btn')?.addEventListener('click', closeBrainModal);
  brainForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    soundBank.play('ui-confirm');
    const patch = {
      brainProvider: brainProviderEl.value,
      brainModel: brainModelEl.value.trim(),
      ollamaUrl: brainOllamaEl.value.trim() || 'http://127.0.0.1:11434',
      brainKeys: {
        gemini: keyGeminiEl.value.trim(),
        openai: keyOpenaiEl.value.trim(),
        claude: keyClaudeEl.value.trim(),
      },
    };
    await host.setConfig(patch);
    brainModal.hidden = true;
    if (!chatBar.visible) host.setFocusable(false);
    panel.say({
      kind: 'info',
      speaker: 'pod',
      tag: 'CEREBRO IA',
      line: `Reporte: Enrutador vinculado a [${patch.brainProvider.toUpperCase()}].`,
      hold: 4200,
    });
  });

  const brainPingBtn = document.getElementById('brain-ping-btn');
  const brainPingStatusEl = document.getElementById('brain-ping-status');

  brainPingBtn?.addEventListener('click', async () => {
    if (brainPingStatusEl) {
      brainPingStatusEl.style.display = 'block';
      brainPingStatusEl.textContent = 'Enviando pulso de diagnóstico al agente de IA activo...';
      brainPingStatusEl.style.color = '#d8b868';
    }
    soundBank.play('pod-scan');
    try {
      const start = performance.now();
      const res = await host.askBrain('Diagnóstico táctico: Confirma el estado operativo del enlace de comunicación en una sola frase breve.');
      const ms = Math.round(performance.now() - start);
      soundBank.play(res.offlineFallback ? 'alert-permission' : 'ui-confirm');
      const statusText = res.offlineFallback
        ? `[CONTINGENCIA LOCAL / OFFLINE (${ms}ms)]: ${res.line}`
        : `[EN LÍNEA / ${(res.provider || 'AI').toUpperCase()} (${ms}ms)]: "${res.line}"`;
      if (brainPingStatusEl) {
        brainPingStatusEl.textContent = statusText;
        brainPingStatusEl.style.color = res.offlineFallback ? '#d88848' : '#68d888';
      }
      panel.say({
        kind: res.offlineFallback ? 'alert' : 'info',
        speaker: res.speaker || 'pod',
        tag: (res.provider || 'AI').toUpperCase(),
        line: res.line,
        hold: 6000,
      });
    } catch (err) {
      soundBank.play('ui-cancel');
      if (brainPingStatusEl) {
        brainPingStatusEl.textContent = `[ERROR DE ENLACE]: ${err.message}`;
        brainPingStatusEl.style.color = '#e05858';
      }
    }
  });

  let voicePtt = null;
  let settingsModal = null;

  const chatBar = new ChatBar({
    el: document.getElementById('chat-bar'),
    host,
    soundBank,
    onSubmit: handleUserCommand,
    onMicToggle: () => voicePtt?.toggle(),
    onOpenSettings: openBrainModal,
    onOpenSystemSettings: () => {
      settingsModal?.toggle();
      refreshHit();
    },
  });

  voicePtt = new VoicePTT({
    host,
    soundBank,
    chatBar,
    panel,
    onTranscribed: async (text) => {
      if (chatBar.visible) {
        chatBar.input.value = text;
        await chatBar.submit();
      } else {
        await handleUserCommand(text);
      }
    },
  });

  engine.onPodClick = (anchor) => chatBar.toggle(anchor);
  engine.onChatAnchor = (anchor, view) => chatBar.setAnchor(anchor, view);

  const proactive = new ProactiveScheduler({
    engine,
    soundBank,
    panel,
    onProactivePrompt: async ({ elapsedMins, fgApp, fgTitle }) => {
      const charName = theme.character?.name || 'Personaje';
      const compName = theme.companion?.name || 'Acompañante';
      const prompt = `[INICIATIVA PROACTIVA] El operador lleva ${elapsedMins} minutos trabajando frente a la ventana "${fgTitle}" (${fgApp}). Haz un comentario espontáneo breve (1-2 oraciones) en personaje (${charName} o ${compName}) sobre lo que está haciendo o recordándole descansar.`;
      return host.askBrain(prompt);
    },
  });
  proactive.configure(config.proactiveMinutes ?? 25);

  settingsModal = new SettingsModal({
    el: document.getElementById('yorha-settings'),
    host,
    soundBank,
    engine,
    proactive,
    openBrainModal,
  });
  settingsModal.syncState(config);

  panel.onChar = () => soundBank.play('talk-blip', { gain: 0.45 });
  panel.onTalk = (talking) => talking && engine.perform('talk');

  // Pixel-accurate Click-Through hit-testing over 2B, Pod 042, YoRHa Panel, Chat Bar, and Settings Modal
  let interactive = false;
  let mouse = null;
  const setInteractive = (on) => {
    if (on === interactive) return;
    interactive = on;
    host.setInteractive(on);
  };

  const refreshHit = () => {
    if (engine.dragging || chatBar.visible || !brainModal.hidden || settingsModal?.visible) return setInteractive(true);
    if (!mouse) return setInteractive(false);
    const r = panel.rect();
    const onPanel = r && mouse.x >= r.left && mouse.x <= r.right && mouse.y >= r.top && mouse.y <= r.bottom;
    const c = chatBar.rect();
    const onChat = c && mouse.x >= c.left && mouse.x <= c.right && mouse.y >= c.top && mouse.y <= c.bottom;
    const b = !brainModal.hidden ? brainModal.getBoundingClientRect() : null;
    const onBrain = b && mouse.x >= b.left && mouse.x <= b.right && mouse.y >= b.top && mouse.y <= b.bottom;
    const s = settingsModal?.rect();
    const onSettings = s && mouse.x >= s.left && mouse.x <= s.right && mouse.y >= s.top && mouse.y <= s.bottom;
    const onPod = engine.hitPod(mouse.x, mouse.y);
    const onChar = engine.hitCharacter(mouse.x, mouse.y);
    document.body.style.cursor = (onPod || onChar) ? 'pointer' : '';
    return setInteractive(Boolean(onPanel || onChat || onBrain || onSettings || onPod || onChar));
  };

  window.addEventListener('mousemove', (e) => {
    mouse = { x: e.clientX, y: e.clientY };
    refreshHit();
  });

  document.addEventListener('mouseleave', () => {
    mouse = null;
    refreshHit();
  });

  // Live window tracking updates from windows.ps1
  host.onWindows((data) => {
    engine.setWindows(data);
    proactive.updateWindows(data);
    refreshHit();
  });

  host.onResize(({ width, height }) => {
    fx.resize(width, height);
    engine.setView(width, height);
  });

  window.addEventListener('resize', () => {
    fx.resize(innerWidth, innerHeight);
    engine.setView(innerWidth, innerHeight);
  });

  host.onConfig((cfg) => {
    soundBank.configure(cfg);
    engine.wander = cfg.wander;
    if (cfg.scale !== engine.scale) engine.setScale(cfg.scale);
    if (cfg.proactiveMinutes !== undefined) proactive.configure(cfg.proactiveMinutes);
    if (cfg.idleQuirkIntervalSec !== undefined) engine.idleQuirkIntervalSec = cfg.idleQuirkIntervalSec;
    settingsModal?.syncState(cfg);
  });

  // Local keyboard shortcuts (F2 / Ctrl+Alt+S / Escape)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2' || (e.ctrlKey && e.altKey && (e.key === 's' || e.key === 'S'))) {
      e.preventDefault();
      settingsModal?.toggle();
      refreshHit();
    } else if (e.key === 'Escape' && settingsModal?.visible) {
      e.preventDefault();
      settingsModal?.close();
      refreshHit();
    }
  });

  // Command & Semantic Slot listener
  host.onCommand(async (cmd) => {
    switch (cmd.name) {
      case 'settings:toggle':
        settingsModal?.toggle();
        refreshHit();
        break;
      case 'settings:open':
        settingsModal?.open();
        refreshHit();
        break;
      case 'settings:close':
        settingsModal?.close();
        refreshHit();
        break;
      case 'status':
        soundBank.play('ui-open');
        engine.statusReport();
        break;
      case 'chat:toggle':
        chatBar.toggle({ x: engine.pod.pos.x, y: engine.pod.pos.y - 45 });
        refreshHit();
        break;
      case 'brain:config':
        await openBrainModal();
        refreshHit();
        break;
      case 'ptt:toggle':
        voicePtt.toggle();
        break;
      case 'hooks:notify':
        soundBank.play('pod-ack');
        panel.say({
          kind: 'info',
          speaker: 'pod',
          line: cmd.installed
            ? `Reporte: Puente de hooks pasivos vinculado a ${cmd.target}.`
            : `Reporte: Puente de hooks pasivos desvinculado de ${cmd.target}.`,
          hold: 4200,
        });
        break;
      case 'proactive:now':
        proactive.triggerInitiative();
        break;
      case 'slot':
        await engine.triggerSlot(cmd.slot, cmd);
        break;
      default:
        break;
    }
  });

  // Passive IDE Hook events (Antigravity / Claude Code) mapped to Semantic Slots
  host.onHookEvent((evt) => {
    const type = evt.hook_event_name;
    const srcTag = evt.source === 'antigravity' ? 'AGY' : 'CLAUDE';
    const allowHookAudio = Boolean(currentConfig.hookAudio);

    if (type === 'SessionStart') {
      if (allowHookAudio) soundBank.play('pod-ack');
      panel.say({
        kind: 'info',
        speaker: 'pod',
        line: `Reporte: Enlace táctico con [${srcTag}] establecido en puerto local.`,
        hold: 3600,
      });
    } else if (type === 'UserPromptSubmit') {
      if (allowHookAudio) soundBank.play('ui-click');
      panel.tick(srcTag, 'Analizando directiva del operador...');
    } else if (type === 'PreToolUse' || type === 'SubagentStart') {
      engine.triggerSlot('tool_work', {
        tag: evt.tool_name || srcTag,
        line: `Reporte: Ejecutando herramienta táctica [${evt.tool_name || 'sistema'}].`,
        silent: !allowHookAudio,
      });
    } else if (type === 'PostToolUseFailure') {
      if (allowHookAudio) soundBank.play('alert');
      panel.say({
        kind: 'error',
        speaker: '2b',
        line: `Anomalía detectada en [${evt.tool_name || 'herramienta'}]. Revisando registros.`,
        hold: 4500,
      });
    } else if (type === 'PermissionRequest') {
      // Permission request requires human action: retains alert sound
      engine.triggerSlot('alert_confirm', {
        tool: evt.tool_name || 'PERMISO',
        command: evt.command || JSON.stringify(evt.tool_input || {}),
      });
    } else if (type === 'Notification' && evt.message) {
      if (allowHookAudio) soundBank.play('pod-ack');
      panel.say({
        kind: 'info',
        speaker: 'pod',
        line: `Reporte [${srcTag}]: ${String(evt.message).slice(0, 140)}`,
        hold: 4500,
      });
    } else if (type === 'Stop' || type === 'SessionEnd') {
      engine.triggerSlot('victory', { silent: !allowHookAudio });
    }
  });

  // Holographic YoRHa Permission Requests for Tier 2 Actions (Critical PC Tools)
  host.onRequestPermission?.(async ({ id, tool, command, line }) => {
    soundBank.play('alert-permission');
    await engine.triggerSlot('alert_confirm', {
      tool,
      command,
      line,
      onDecision: (decision) => {
        host.sendToolDecision(id, decision);
      },
    });
  });

  // Initial Bunker arrival sequence
  if (config.visible === false) {
    await engine.slotStow({ on: true });
  } else {
    soundBank.play('ui-open');
    fx.bunkerBeam(engine.pos.x, engine.pos.y, { life: 520, width: 58 });
    panel.say({
      kind: 'info',
      speaker: '2b',
      line: pick(NIER_DIALOGUES.boot_2b),
      hold: 4500,
    });
  }
}

boot().catch((err) => {
  console.error('[zeromate] boot failed:', err);
});
