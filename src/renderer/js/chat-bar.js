// Holographic YoRHa Chat & Command Bar (src/renderer/js/chat-bar.js)
// Opens when clicking Pod 042 or pressing Alt+Space (with ui-open.wav).
// Temporarily enables window focus so the user can type directly without opening any console.

import { clamp } from './util.js';

export class ChatBar {
  constructor({ el, host, soundBank, onSubmit, onMicToggle, onOpenSettings }) {
    this.el = el;
    this.host = host;
    this.sound = soundBank;
    this.onSubmit = onSubmit;
    this.onMicToggle = onMicToggle;
    this.onOpenSettings = onOpenSettings;

    this.form = el.querySelector('#chat-form');
    this.input = el.querySelector('#chat-input');
    this.micBtn = el.querySelector('#chat-mic-btn');
    this.cfgBtn = el.querySelector('#chat-cfg-btn');
    this.closeBtn = el.querySelector('#chat-close-btn');
    this.statusEl = el.querySelector('#chat-status');

    this.anchor = { x: innerWidth * 0.5, y: innerHeight - 160 };
    this.view = { w: innerWidth, h: innerHeight };
    this.recording = false;

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.input.value.trim();
      if (!text) return;
      this.sound.play('ui-confirm');
      this.input.value = '';
      this.close({ silent: true });
      this.onSubmit?.(text);
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key.length === 1) {
        this.sound.play('talk-blip', { gain: 0.25 });
      }
    });

    this.micBtn?.addEventListener('click', () => {
      this.onMicToggle?.();
    });

    this.cfgBtn?.addEventListener('click', () => {
      this.sound.play('ui-open');
      this.onOpenSettings?.();
    });

    this.closeBtn?.addEventListener('click', () => {
      this.close();
    });
  }

  get visible() {
    return !this.el.hidden;
  }

  toggle(anchor) {
    if (this.visible) this.close();
    else this.open(anchor);
  }

  open(anchor) {
    if (anchor) this.anchor = anchor;
    this.el.hidden = false;
    this.el.classList.remove('is-leaving');
    this.el.classList.add('is-entering');
    this.place();
    this.sound.play('ui-open');
    this.host.setFocusable(true);
    setTimeout(() => {
      this.input.focus();
      this.input.select();
    }, 30);
  }

  close({ silent = false } = {}) {
    if (this.el.hidden) return;
    if (!silent) this.sound.play('ui-cancel');
    this.input.blur();
    this.el.hidden = true;
    this.host.setFocusable(false);
  }

  setRecording(active, statusText = '') {
    this.recording = active;
    this.el.dataset.recording = active ? 'true' : 'false';
    if (this.micBtn) {
      this.micBtn.textContent = active ? '[ ● ESCUCHANDO... ]' : '[ VOZ (Ctrl+Esp) ]';
    }
    if (this.statusEl) {
      this.statusEl.textContent = statusText || (active ? 'CAPTURANDO AUDIO LOCAL (WHISPER ONNX)...' : 'ENLACE TÁCTICO // ZEROMATE');
    }
  }

  setStatus(text) {
    if (this.statusEl) this.statusEl.textContent = text;
  }

  setAnchor(anchor, view) {
    if (anchor) this.anchor = anchor;
    if (view) this.view = view;
    if (this.visible) this.place();
  }

  place() {
    const { w, h } = this.view;
    const bw = this.el.offsetWidth || 440;
    const bh = this.el.offsetHeight || 88;
    const margin = 16;
    const left = clamp(this.anchor.x - bw * 0.5, margin, w - bw - margin);
    const top = clamp(this.anchor.y - bh - 24, margin, h - bh - margin);
    this.el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
  }

  rect() {
    if (this.el.hidden) return null;
    return this.el.getBoundingClientRect();
  }
}
