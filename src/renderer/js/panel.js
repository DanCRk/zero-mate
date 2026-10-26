// Holographic YoRHa Transmission Panel & Ticker (src/renderer/js/panel.js)
// Supports Dual Personality (2B + Pod 042) with dynamic portraits, YoRHa text decode,
// and permission confirmation controls.

import { clamp, reducedMotion } from './util.js';

const NOISE = '■□❖▚▞01';
const PRIORITY = { info: 1, idle: 1, work: 2, done: 3, error: 3, alert: 4, reply: 5 };
const DECODE_STEP_MS = 24;

export class Panel {
  constructor({ panel, ticker, theme }) {
    this.el = panel;
    this.tickerEl = ticker;
    this.theme = theme;
    this.line = panel.querySelector('.panel__line');
    this.portrait = panel.querySelector('#panel-portrait');
    this.who = panel.querySelector('.panel__who');
    this.quote = panel.querySelector('.panel__quote');
    this.reply = panel.querySelector('.panel__reply');
    this.summary = panel.querySelector('.panel__summary');
    this.log = panel.querySelector('.panel__log');
    this.tag = panel.querySelector('.panel__tag');
    this.state = panel.querySelector('.panel__state');
    this.actionsEl = panel.querySelector('#panel-actions');
    this.tickerVerb = ticker.querySelector('.ticker__verb');
    this.tickerTarget = ticker.querySelector('.ticker__target');

    this.current = null;
    this.hideTimer = null;
    this.decodeTimer = null;
    this.anchor = { x: 400, y: 300, top: 220 };
    this.view = { w: innerWidth, h: innerHeight };
    this.onChar = null;
    this.onTalk = null;
    this.onAction = null;
    this.suspended = false;
    this.tickerAction = null;

    this.el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        e.stopPropagation();
        const act = btn.dataset.action;
        this.onAction?.(act);
        this.hide();
        return;
      }
      if (this.current?.kind !== 'alert') {
        this.hide();
      }
    });
  }

  setTheme(theme) {
    this.theme = theme;
  }

  get visible() {
    return !this.el.hidden && !this.suspended && !this.leaving;
  }

  // msg: { kind, speaker: '2b' | 'pod', line, tag, quote, reply, summary, log, actions: boolean, hold }
  say(msg) {
    const cur = this.current;
    if (cur && this.visible && cur.kind !== msg.kind && PRIORITY[cur.kind] > PRIORITY[msg.kind] && performance.now() - cur.at < 2400) {
      return false;
    }
    this.current = { ...msg, at: performance.now() };
    clearTimeout(this.hideTimer);

    const speaker = msg.speaker || (msg.kind === 'alert' || msg.kind === 'work' ? 'pod' : '2b');
    this.el.dataset.kind = msg.kind || 'info';
    this.el.dataset.speaker = speaker;

    const portraitUrl = speaker === 'pod'
      ? this.theme?.companion?.portraitUrl
      : this.theme?.character?.portraitUrl;
    if (portraitUrl && this.portrait.getAttribute('src') !== portraitUrl) {
      this.portrait.setAttribute('src', portraitUrl);
    }

    const isCompanion = speaker === 'pod' || speaker === 'companion';
    this.who.textContent = isCompanion
      ? `${this.theme?.companion?.name || 'ACOMPAÑANTE'} // TACTICAL SUPPORT`
      : `${this.theme?.character?.name || 'PERSONAJE'} // ${this.theme?.character?.fullName || this.theme?.name || 'ZeroMate Agent'}`;

    const stateLabels = {
      info: 'ACTIVO',
      idle: 'EN ESPERA',
      work: 'ESCANEANDO',
      done: 'COMPLETADO',
      alert: 'AUTORIZACIÓN',
      error: 'ALERTA LÓGICA',
    };
    this.state.textContent = stateLabels[msg.kind] || 'ACTIVO';
    this.tag.textContent = msg.tag || '';
    this.quote.textContent = msg.quote || '';
    this.quote.hidden = !msg.quote;
    this.reply.textContent = msg.reply || '';
    this.reply.hidden = !msg.reply;
    this.summary.textContent = msg.summary || '';
    this.summary.hidden = !msg.summary;
    this.actionsEl.hidden = !msg.actions;

    this.tickerEl.hidden = true;
    this.leaving = false;
    this.el.hidden = false;
    this.el.classList.remove('is-leaving');
    this.replayEnter();
    this.place();
    this.decode(msg.line || '', msg.kind);

    if (msg.hold && !msg.actions) {
      this.hideTimer = setTimeout(() => this.hide(), msg.hold);
    }
    return true;
  }

  hide() {
    clearTimeout(this.hideTimer);
    clearInterval(this.decodeTimer);
    this.onTalk?.(false);
    if (this.el.hidden || this.leaving) return;
    this.current = null;
    this.leaving = true;
    if (reducedMotion.matches) {
      this.el.hidden = true;
    } else {
      this.el.classList.add('is-leaving');
      setTimeout(() => {
        if (this.leaving) this.el.hidden = true;
      }, 140);
    }
    if (this.tickerAction) this.setTicker(this.tickerAction);
  }

  suspend() {
    this.suspended = true;
    this.el.style.visibility = 'hidden';
    this.tickerEl.style.visibility = 'hidden';
  }

  resume() {
    this.suspended = false;
    this.el.style.visibility = '';
    this.tickerEl.style.visibility = '';
    this.place();
  }

  replayEnter() {
    this.el.classList.remove('is-entering');
    void this.el.offsetWidth;
    this.el.classList.add('is-entering');
  }

  decode(text, kind) {
    clearInterval(this.decodeTimer);
    if (reducedMotion.matches || !text) {
      this.line.textContent = text;
      return;
    }
    const chars = [...text];
    let done = 0;
    this.onTalk?.(true);
    const step = () => {
      done = Math.min(chars.length, done + 2);
      const head = chars.slice(0, done).join('');
      let tail = '';
      for (let i = done; i < Math.min(chars.length, done + 5); i++) {
        tail += chars[i] === ' ' ? ' ' : NOISE[Math.floor(Math.random() * NOISE.length)];
      }
      this.line.textContent = head + tail;
      if (chars[done - 1] && chars[done - 1] !== ' ') this.onChar?.(kind);
      if (done >= chars.length) {
        clearInterval(this.decodeTimer);
        this.line.textContent = text;
        this.onTalk?.(false);
      }
    };
    step();
    this.decodeTimer = setInterval(step, DECODE_STEP_MS);
  }

  setTicker(action) {
    this.tickerAction = action;
    if (!action || this.visible) {
      this.tickerEl.hidden = true;
      return;
    }
    this.tickerVerb.textContent = action.verb || 'POD 042';
    this.tickerTarget.textContent = action.target || '';
    this.tickerEl.hidden = false;
    this.place();
  }

  setAnchor(anchor, view) {
    this.anchor = anchor;
    this.view = view;
    this.place();
  }

  place() {
    const { x, y, top: crown = y - 80 } = this.anchor;
    const { w, h } = this.view;
    const margin = 14;
    const towardLeft = x > w * 0.5;

    if (!this.el.hidden) {
      const pw = this.el.offsetWidth || 350;
      const ph = this.el.offsetHeight || 110;
      let left = towardLeft ? x - pw + 48 : x - 48;
      left = clamp(left, margin, w - pw - margin);
      let top = crown - ph - 12;
      let below = false;
      if (top < margin) {
        top = y + 36;
        below = true;
      }
      if (h) top = clamp(top, margin, h - ph - margin);
      this.el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
      this.el.style.setProperty('--tail-x', `${clamp(x - left, 24, pw - 24)}px`);
      this.el.dataset.below = below ? 'true' : 'false';
    }

    if (!this.tickerEl.hidden) {
      const tw = this.tickerEl.offsetWidth || 200;
      const left = clamp(x - tw * 0.5, margin, w - tw - margin);
      const top = Math.max(margin, crown - 38);
      this.tickerEl.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    }
  }

  rect() {
    if (this.el.hidden || this.suspended) return null;
    return this.el.getBoundingClientRect();
  }
}
