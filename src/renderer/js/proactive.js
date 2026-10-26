// Proactive Periodic Initiative Timer (src/renderer/js/proactive.js)
// Default: every 25 minutes (configurable in system tray: 10m, 25m, 45m, 1h, Desactivado).
// 2B and Pod 042 spontaneously animate, play YoRHa sound cues, and speak in character
// about the user's active window/program or session duration.

import { pick } from './util.js';

export class ProactiveScheduler {
  constructor({ engine, soundBank, panel, onProactivePrompt }) {
    this.engine = engine;
    this.sound = soundBank;
    this.panel = panel;
    this.onProactivePrompt = onProactivePrompt;

    this.intervalMinutes = 25;
    this.timer = null;
    this.sessionStart = Date.now();
    this.lastActiveWindow = { fgApp: '', fgTitle: '' };
  }

  configure(minutes) {
    const mins = Number(minutes);
    if (Number.isNaN(mins)) return;
    this.intervalMinutes = mins;
    this.restart();
  }

  updateWindows(winData) {
    if (winData?.fgApp || winData?.fgTitle) {
      // Ignore our own overlay if focused
      if (winData.fgApp?.toLowerCase() !== 'electron') {
        this.lastActiveWindow = {
          fgApp: winData.fgApp || '',
          fgTitle: winData.fgTitle || '',
        };
      }
    }
  }

  restart() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (!this.intervalMinutes || this.intervalMinutes <= 0) return;
    const ms = this.intervalMinutes * 60 * 1000;
    this.timer = setInterval(() => this.triggerInitiative(), ms);
  }

  async triggerInitiative() {
    if (this.engine.busy) return;
    const elapsedMins = Math.max(1, Math.round((Date.now() - this.sessionStart) / 60000));
    const appName = this.lastActiveWindow.fgApp || 'el escritorio';
    const winTitle = this.lastActiveWindow.fgTitle || appName;

    // Play YoRHa initiative sound & perform scan/quirk animation
    this.sound.play('ui-open');
    if (!this.engine.stowed) {
      this.engine.triggerSlot(Math.random() < 0.5 ? 'tool_work' : 'idle_quirk');
    }

    // If BrainRouter is connected, ask it for a dynamic in-character proactive comment;
    // fallback to rich context-aware 2B / Pod 042 templates.
    if (this.onProactivePrompt) {
      try {
        const reply = await this.onProactivePrompt({
          elapsedMins,
          fgApp: appName,
          fgTitle: winTitle,
        });
        if (reply && reply.line) {
          this.panel.say({
            kind: 'info',
            speaker: reply.speaker || '2b',
            tag: 'INICIATIVA',
            line: reply.line,
            hold: 6800,
          });
          return;
        }
      } catch (err) {
        console.warn('[yorha-proactive] fallback to local lines:', err.message);
      }
    }

    const lines = this.buildContextualLines(appName, winTitle, elapsedMins);
    const chosen = pick(lines);
    this.panel.say({
      kind: 'info',
      speaker: chosen.speaker,
      tag: 'INICIATIVA',
      line: chosen.line,
      hold: 6800,
    });
  }

  buildContextualLines(appName, winTitle, elapsedMins) {
    const shortTitle = winTitle.length > 42 ? winTitle.slice(0, 42) + '…' : winTitle;
    const list = [
      {
        speaker: '2b',
        line: `Llevas ${elapsedMins} minutos frente a ${appName}. Incluso los androides requieren mantenimiento... descansa la vista un momento.`,
      },
      {
        speaker: 'pod',
        line: `Reporte: Actividad sostenida detectada en [${shortTitle}]. Propuesta: ¿Deseas que ejecute alguna tarea de apoyo táctico?`,
      },
      {
        speaker: '2b',
        line: `Sigo vigilando tu sesión en ${appName}. Las emociones están prohibidas, pero reconozco tu disciplina en esta misión.`,
      },
      {
        speaker: 'pod',
        line: `Alerta preventiva: Tiempo de operación continua (${elapsedMins} min). Propuesta: Hidratación recomendada para mantener eficiencia biológica.`,
      },
    ];
    return list;
  }
}
