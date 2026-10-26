// YoRHa System Settings & Live Tuner Modal (src/renderer/js/settings-modal.js)
// Provides a full in-app control panel for real-time live tuning, parameter configuration,
// and Semantic Action Slots sandbox testing without needing to open the System Tray.

import { clamp } from './util.js';

export class SettingsModal {
  constructor({ el, host, soundBank, engine, proactive, openBrainModal }) {
    this.el = el;
    this.host = host;
    this.sound = soundBank;
    this.engine = engine;
    this.proactive = proactive;
    this.openBrainModal = openBrainModal;

    this.dragHandle = el.querySelector('#settings-drag-handle');
    this.closeBtn = el.querySelector('#settings-close-btn');
    this.tabBtns = el.querySelectorAll('.yorha-settings__tab');
    this.tabPanels = el.querySelectorAll('.yorha-settings__panel');

    // General inputs
    this.themeSel = el.querySelector('#setting-theme');
    this.langSel = el.querySelector('#setting-lang');
    this.scaleSlider = el.querySelector('#setting-scale');
    this.scaleVal = el.querySelector('#setting-scale-val');
    this.scalePresets = el.querySelectorAll('[data-scale]');
    this.volumeSlider = el.querySelector('#setting-volume');
    this.volumeVal = el.querySelector('#setting-volume-val');
    this.muteChk = el.querySelector('#setting-mute');

    // Behavior inputs
    this.wanderChk = el.querySelector('#setting-wander');
    this.idleFreqSlider = el.querySelector('#setting-idle-freq');
    this.idleFreqVal = el.querySelector('#setting-idle-freq-val');
    this.brainProviderSel = el.querySelector('#setting-brain-provider');
    this.openBrainBtn = el.querySelector('#btn-open-brain-keys');
    this.proactiveSel = el.querySelector('#setting-proactive');
    this.bunkerBtn = el.querySelector('#btn-toggle-bunker');

    // Sandbox buttons
    this.slotBtns = el.querySelectorAll('[data-slot]');
    this.stanceBtns = el.querySelectorAll('[data-stance]');

    this.dragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.scaleTimeout = null;
    this.volumeTimeout = null;
    this.idleTimeout = null;

    this.bindEvents();
    this.populateThemes();
  }

  get visible() {
    return !this.el.hidden;
  }

  rect() {
    if (this.el.hidden) return null;
    return this.el.getBoundingClientRect();
  }

  async populateThemes() {
    try {
      const themes = await this.host.listThemes();
      if (!this.themeSel) return;
      this.themeSel.innerHTML = '';
      for (const th of themes) {
        const opt = document.createElement('option');
        opt.value = th.id;
        opt.textContent = th.name;
        this.themeSel.appendChild(opt);
      }
    } catch {}
  }

  bindEvents() {
    // Dragging
    this.dragHandle?.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      this.dragging = true;
      const b = this.el.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - b.left,
        y: e.clientY - b.top,
      };
      // Remove translate if present
      this.el.style.transform = 'none';
      this.el.style.left = `${b.left}px`;
      this.el.style.top = `${b.top}px`;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      const w = this.el.offsetWidth;
      const h = this.el.offsetHeight;
      const newX = clamp(e.clientX - this.dragOffset.x, 10, innerWidth - w - 10);
      const newY = clamp(e.clientY - this.dragOffset.y, 10, innerHeight - h - 10);
      this.el.style.left = `${newX}px`;
      this.el.style.top = `${newY}px`;
    });

    window.addEventListener('mouseup', () => {
      this.dragging = false;
    });

    // Close button
    this.closeBtn?.addEventListener('click', () => this.close());

    // Tab Navigation
    this.tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.sound.play('ui-click', { gain: 0.6 });
        this.switchTab(tab);
      });
    });

    // General: Theme
    this.themeSel?.addEventListener('change', async () => {
      const theme = this.themeSel.value;
      this.sound.play('ui-confirm');
      await this.host.setConfig({ theme });
    });

    // General: Language
    this.langSel?.addEventListener('change', async () => {
      const lang = this.langSel.value;
      this.sound.play('ui-confirm');
      await this.host.setConfig({ lang });
    });

    // General: Scale slider
    this.scaleSlider?.addEventListener('input', () => {
      const scale = parseFloat(this.scaleSlider.value);
      if (this.scaleVal) this.scaleVal.textContent = `${scale.toFixed(2)}x`;
      this.engine.setScale(scale);
      clearTimeout(this.scaleTimeout);
      this.scaleTimeout = setTimeout(() => {
        this.host.setConfig({ scale });
      }, 180);
    });

    // General: Scale presets
    this.scalePresets.forEach((btn) => {
      btn.addEventListener('click', () => {
        const scale = parseFloat(btn.dataset.scale);
        if (this.scaleSlider) this.scaleSlider.value = scale;
        if (this.scaleVal) this.scaleVal.textContent = `${scale.toFixed(2)}x`;
        this.sound.play('ui-click');
        this.engine.setScale(scale);
        this.host.setConfig({ scale });
      });
    });

    // General: Volume slider
    this.volumeSlider?.addEventListener('input', () => {
      const val = parseInt(this.volumeSlider.value, 10);
      const vol = val / 100;
      if (this.volumeVal) this.volumeVal.textContent = `${val}%`;
      this.sound.configure({ volume: vol });
      clearTimeout(this.volumeTimeout);
      this.volumeTimeout = setTimeout(() => {
        this.sound.play('ui-click', { gain: 0.4 });
        this.host.setConfig({ volume: vol });
      }, 150);
    });

    // General: Mute
    this.muteChk?.addEventListener('change', () => {
      const muted = this.muteChk.checked;
      this.sound.configure({ muted });
      if (!muted) this.sound.play('ui-confirm');
      this.host.setConfig({ muted });
    });

    // Behavior: Wander
    this.wanderChk?.addEventListener('change', () => {
      const wander = this.wanderChk.checked;
      this.engine.wander = wander;
      this.sound.play(wander ? 'ui-confirm' : 'ui-cancel');
      this.host.setConfig({ wander });
    });

    // Behavior: Idle Frequency
    this.idleFreqSlider?.addEventListener('input', () => {
      const sec = parseInt(this.idleFreqSlider.value, 10);
      if (this.idleFreqVal) this.idleFreqVal.textContent = `${sec}s`;
      this.engine.idleQuirkIntervalSec = sec;
      clearTimeout(this.idleTimeout);
      this.idleTimeout = setTimeout(() => {
        this.host.setConfig({ idleQuirkIntervalSec: sec });
      }, 200);
    });

    // Behavior: Brain Provider
    this.brainProviderSel?.addEventListener('change', () => {
      const brainProvider = this.brainProviderSel.value;
      this.sound.play('ui-confirm');
      this.host.setConfig({ brainProvider });
    });

    // Behavior: Open API keys modal
    this.openBrainBtn?.addEventListener('click', () => {
      this.sound.play('ui-open');
      this.openBrainModal?.();
    });

    // Behavior: Quick ping active AI
    document.getElementById('btn-quick-ping-ai')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-quick-ping-ai');
      const prevText = btn.textContent;
      btn.textContent = '[ PINGING... ]';
      btn.disabled = true;
      this.sound.play('pod-scan');
      try {
        const res = await this.host.askBrain('Diagnóstico táctico: Confirma el estado del enlace en una frase.');
        this.sound.play(res.offlineFallback ? 'alert-permission' : 'ui-confirm');
        this.engine.panel.say({
          kind: res.offlineFallback ? 'alert' : 'info',
          speaker: res.speaker || 'pod',
          tag: (res.provider || 'AI').toUpperCase(),
          line: res.line,
          hold: 5000,
        });
      } catch (err) {
        this.sound.play('ui-cancel');
      } finally {
        btn.textContent = prevText;
        btn.disabled = false;
      }
    });

    // Behavior: Proactive minutes
    this.proactiveSel?.addEventListener('change', () => {
      const mins = parseInt(this.proactiveSel.value, 10);
      this.sound.play('ui-confirm');
      this.proactive?.configure(mins);
      this.host.setConfig({ proactiveMinutes: mins });
    });

    // Behavior: Bunker Mode (Stow 2B)
    this.bunkerBtn?.addEventListener('click', async () => {
      this.sound.play('ui-click');
      const isStowed = this.engine.stowed;
      await this.engine.triggerSlot('stow', { on: !isStowed });
      await this.host.setConfig({ visible: isStowed });
      this.updateBunkerButtonText(!isStowed);
    });

    // Sandbox: Semantic Slots
    this.slotBtns.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const slot = btn.dataset.slot;
        const arg = btn.dataset.arg;
        this.sound.play('ui-click', { gain: 0.7 });
        btn.classList.add('is-active-pulse');
        setTimeout(() => btn.classList.remove('is-active-pulse'), 450);

        if (slot === 'idle_quirk') {
          await this.engine.triggerSlot('idle_quirk', { kind: arg || 'katana' });
        } else if (slot === 'alert_confirm') {
          await this.engine.triggerSlot('alert_confirm', { details: 'TEST_PERMISSION_OVERRIDE' });
        } else {
          await this.engine.triggerSlot(slot, { arg, side: arg });
        }
      });
    });

    // Sandbox: Stances
    this.stanceBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const stance = btn.dataset.stance;
        this.sound.play('ui-click');
        this.stanceBtns.forEach((b) => b.classList.remove('is-active-stance'));
        btn.classList.add('is-active-stance');

        if (this.engine.forceStance) {
          this.engine.forceStance(stance);
        } else {
          if (stance === 'auto') {
            this.engine.busy = false;
            this.engine.setStance('stand');
          } else {
            this.engine.busy = false;
            this.engine.setStance(stance);
          }
        }
      });
    });
  }

  switchTab(tabName) {
    this.tabBtns.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tab === tabName);
    });
    this.tabPanels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.id === `tab-${tabName}`);
    });
  }

  updateBunkerButtonText(stowed) {
    if (!this.bunkerBtn) return;
    if (stowed) {
      this.bunkerBtn.textContent = '[ DEPLOY 2B FROM BUNKER ]';
      this.bunkerBtn.classList.add('yorha-btn--warn');
    } else {
      this.bunkerBtn.textContent = '[ STOW 2B TO BUNKER ]';
      this.bunkerBtn.classList.remove('yorha-btn--warn');
    }
  }

  syncState(cfg = {}) {
    if (cfg.theme && this.themeSel) this.themeSel.value = cfg.theme;
    if (cfg.lang && this.langSel) this.langSel.value = cfg.lang;

    if (typeof cfg.scale === 'number') {
      if (this.scaleSlider) this.scaleSlider.value = cfg.scale;
      if (this.scaleVal) this.scaleVal.textContent = `${cfg.scale.toFixed(2)}x`;
    }

    if (typeof cfg.volume === 'number') {
      const pct = Math.round(cfg.volume * 100);
      if (this.volumeSlider) this.volumeSlider.value = pct;
      if (this.volumeVal) this.volumeVal.textContent = `${pct}%`;
    }

    if (typeof cfg.muted === 'boolean' && this.muteChk) {
      this.muteChk.checked = cfg.muted;
    }

    if (typeof cfg.wander === 'boolean' && this.wanderChk) {
      this.wanderChk.checked = cfg.wander;
    }

    if (typeof cfg.idleQuirkIntervalSec === 'number') {
      if (this.idleFreqSlider) this.idleFreqSlider.value = cfg.idleQuirkIntervalSec;
      if (this.idleFreqVal) this.idleFreqVal.textContent = `${cfg.idleQuirkIntervalSec}s`;
    }

    if (cfg.brainProvider && this.brainProviderSel) {
      this.brainProviderSel.value = cfg.brainProvider;
    }

    if (cfg.proactiveMinutes !== undefined && this.proactiveSel) {
      this.proactiveSel.value = String(cfg.proactiveMinutes);
    }

    const stowed = this.engine ? this.engine.stowed : (cfg.visible === false);
    this.updateBunkerButtonText(stowed);
  }

  async open() {
    const cfg = await this.host.getConfig();
    await this.populateThemes();
    this.syncState(cfg);
    this.el.hidden = false;
    this.sound.play('ui-open');
    this.host.setFocusable(true);
    this.host.setInteractive(true);
  }

  close() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.sound.play('ui-cancel');
    this.host.setFocusable(false);
  }

  toggle() {
    if (this.visible) {
      this.close();
    } else {
      this.open();
    }
  }
}
