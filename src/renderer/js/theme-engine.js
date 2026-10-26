// Multi-Theme Semantic Action Slots Engine (src/renderer/js/theme-engine.js)
// Translates universal Semantic Action Slots:
//   - sit_window         (walk along window top frame and sit dangling legs)
//   - traverse           (Pod Glide across the desktop)
//   - idle_quirk         (summon/inspect Virtuous Contract katana, pet Pod 042, or adjust visor)
//   - companion_interact (petting Pod 042 -> happy tilt + chirp + 2B reaction)
//   - poke_annoyed       (rapid clicks/shake -> katana slash at cursor + stoic warning)
//   - tool_work          (2B crosses arms vigilantly while Pod 042 projects laser scanner)
//   - alert_confirm      (Pod 042 flies to cursor blinking crimson/amber + YoRHa authorization modal)
//   - victory            (2B spins, flicks, and sheathes her katana in mid-air behind her back)
//   - stow               (Ctrl+Alt+C -> 2B dematerializes to the Bunker in monochrome particles; Pod 042 stays on sentry)

import { SpriteRenderer, SPRITE } from './sprite.js';
import { WeaponHaloRenderer, PodCompanion } from './fx.js';
import { NEUTRAL, Player } from './acting.js';
import { sleep, rand, pick, clamp, lerp, ease, tween, reducedMotion } from './util.js';

const ON_TWOS = 1000 / 12;
const ON_ONES = 1000 / 24;
const GRAVITY = 2500;
const THIGH = 70;

export const NIER_DIALOGUES = {
  boot_2b: [
    'Unidad YoRHa No.2 Tipo B en posición. Sistemas de apoyo activos.',
    'Conexión con el Búnker establecida. Lista para iniciar operaciones.',
  ],
  boot_pod: [
    'Reporte: Unidad de apoyo táctico Pod 042 en línea. Monitoreando entorno de escritorio.',
  ],
  sit_window: [
    'Posición de observación asegurada sobre la ventana activa.',
    'Mantendré vigilancia desde este sector.',
  ],
  traverse: [
    'Propuesta: Desplazamiento aéreo mediante planeo asistido por Pod 042.',
  ],
  idle_katana: [
    'Contrato Virtuoso en óptimas condiciones. El filo no presenta desgaste.',
    'Un androide de combate siempre debe mantener su equipamiento listo.',
  ],
  idle_visor: [
    'Sensores ópticos calibrados. Continúa con tu trabajo.',
    'Llevas bastante tiempo concentrado... recuerda que incluso los androides requieren mantenimiento.',
  ],
  companion_pet_2b: [
    'Agradecida por el apoyo táctico, Pod.',
    'Buen trabajo, Pod 042.',
  ],
  companion_pet_pod: [
    'Afirmativo. Nivel de eficiencia de soporte táctico incrementado en un 4.2%.',
    'Reporte: Interacción de mantenimiento recibida. Sistemas nominales.',
  ],
  poke_annoyed: [
    'Las emociones están prohibidas... concéntrate en la misión.',
    'No hagas eso. Interferir con una unidad YoRHa retrasará tus tareas.',
    'Detente. Mantén el enfoque en tus objetivos.',
  ],
  tool_work: [
    'Reporte: Escaneando estructura de la ventana activa y verificando procesos en ejecución.',
    'Alerta táctica: Analizando datos locales mediante escáner láser.',
  ],
  alert_confirm: [
    'Alerta: Se requiere modificación en el sistema local. Propuesta: ¿Autorizar la ejecución de esta operación?',
  ],
  victory: [
    'Objetivo completado. Regresando a estado de vigilancia.',
    'Misión cumplida sin contratiempos.',
  ],
  stow_out: [
    'Reporte: Unidad 2B transferida al Búnker. Pod 042 permanecerá en modo centinela.',
  ],
  stow_in: [
    'Transferencia desde el Búnker completada. 2B de vuelta en el escritorio.',
  ],
};

export class ThemeEngine {
  constructor({ charRoot, spriteCanvas, weaponCanvas, podRoot, podCanvas, images, fx, soundBank, panel, theme }) {
    this.root = charRoot;
    this.canvas = spriteCanvas;
    this.sprite = new SpriteRenderer(spriteCanvas, images.charImg);
    this.weapon = new WeaponHaloRenderer(weaponCanvas, images.katanaImg);
    this.pod = new PodCompanion(podRoot, podCanvas, images.podImg);
    this.fx = fx;
    this.sound = soundBank;
    this.panel = panel;
    this.theme = theme;

    this.scale = 0.62;
    this.view = { w: innerWidth, h: innerHeight };
    this.pos = { x: innerWidth - 220, y: innerHeight - 6 };
    this.facing = 1;
    this.stance = 'stand'; // stand | sit | walk | glide | work | fall
    this.perch = null;
    this.windows = { fg: 0, wins: [] };
    this.busy = false;
    this.stowed = false;
    this.wander = true;
    this.dragging = false;

    this.p = {
      seed: 0, boil: 0.45, hair: 0, skirt: 0, head: 0,
      armL: 0, armR: 0, longL: 1, longR: 1,
      sit: 0, kickL: 0, kickR: 0,
      smear: [0, 0], echo: [0, 0],
      glitch: 0, glitchSeed: 0, split: 0, collapse: 0, dissolve: 0, bunker: 0,
      sil: [0.1, 0.1, 0.09], silAmount: 0, misreg: [0.0, 0.0], alpha: 1,
    };

    this.bob = 0;
    this.tilt = 0;
    this.sx = 1;
    this.sy = 1;
    this.base = new Player('stand');
    this.act = null;
    this.lastDraw = 0;
    this.mouse = { x: innerWidth * 0.5, y: innerHeight * 0.5 };

    // Interaction trackers for poke_annoyed and companion_interact (petting Pod 042)
    this.clickTimestamps = [];
    this.podRubDistance = 0;
    this.podAngleAccum = 0;
    this.lastPodAngle = null;
    this.lastPodMouse = null;
    this.onPodClick = null;
    this.onChatAnchor = null;

    this.idleQuirkIntervalSec = 45;
    const now = performance.now();
    this.nextWander = now + rand(18000, 32000);
    this.nextQuirk = now + rand(12000, 24000);

    this.alphaMap = this.buildAlphaMap(images.charImg);
    this.setScale(this.scale);
    this.bindInteractions();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  buildAlphaMap(image) {
    const { width: w, height: h } = SPRITE;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h).data;
  }

  setScale(scale) {
    this.scale = scale;
    this.sprite.resize(scale);
    const { width, height } = SpriteRenderer.cssSize(scale);
    this.weapon.resize(width, height, scale);
    this.pod.resize(scale);
    this.pivot();
    this.place();
  }

  pivot() {
    const s = this.scale;
    const fx = (SPRITE.pad + SPRITE.feet.x) * s;
    const fy = (SPRITE.pad + (this.stance === 'sit' ? SPRITE.hip : SPRITE.feet.y)) * s;
    this.canvas.style.transformOrigin = `${fx}px ${fy}px`;
  }

  setView(w, h) {
    this.view = { w, h };
    if (this.stance === 'stand') {
      this.pos.x = clamp(this.pos.x, 70, w - 70);
      this.pos.y = clamp(this.pos.y, SPRITE.height * this.scale, h - 6);
    }
    this.place();
  }

  get floor() {
    return this.view.h - 6;
  }

  head(at = this.pos, facing = this.facing) {
    const s = this.scale;
    const bob = at === this.pos ? this.bob : 0;
    const dx = (SPRITE.head.x - SPRITE.feet.x) * s * facing;
    const dy = (SPRITE.feet.y - SPRITE.head.y) * s;
    return { x: at.x + dx, y: at.y - dy + bob, top: at.y - SPRITE.feet.y * s + bob };
  }

  place() {
    const s = this.scale;
    const left = this.pos.x - (SPRITE.pad + SPRITE.feet.x) * s;
    const top = this.pos.y - (SPRITE.pad + SPRITE.feet.y) * s + this.bob;
    this.root.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    this.canvas.style.transform = `rotate(${this.tilt.toFixed(2)}deg) scale(${(this.facing * this.sx).toFixed(3)}, ${this.sy.toFixed(3)})`;

    const anchor = this.stowed
      ? { x: this.pod.pos.x, y: this.pod.pos.y, top: this.pod.pos.y - 50 }
      : this.head();
    this.panel.setAnchor(anchor, this.view);
    this.onChatAnchor?.({ x: this.pod.pos.x, y: this.pod.pos.y - 45 }, this.view);
  }

  // Pixel-accurate hit test on 2B's sprite
  hitCharacter(x, y) {
    if (this.stowed || this.p.alpha < 0.3) return false;
    const s = this.scale;
    const fy = this.pos.y + this.bob;
    const sx = SPRITE.feet.x + ((x - this.pos.x) / s) * this.facing;
    let sy = SPRITE.feet.y - (fy - y) / s;
    if (this.p.sit > 0 && sy > SPRITE.hip) {
      const c = lerp(1, 0.42, this.p.sit);
      sy = sy <= SPRITE.hip + THIGH * c ? SPRITE.hip + (sy - SPRITE.hip) / c : sy + THIGH * (1 - c);
    }
    for (const [dx, dy] of [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]]) {
      const px = Math.round(sx + dx), py = Math.round(sy + dy);
      if (px < 0 || py < 0 || px >= SPRITE.width || py >= SPRITE.height) continue;
      if (this.alphaMap[(py * SPRITE.width + px) * 4 + 3] > 40) return true;
    }
    return false;
  }

  hitPod(x, y) {
    return this.pod.contains(x, y);
  }

  hitAny(x, y) {
    return this.hitCharacter(x, y) || this.hitPod(x, y);
  }

  // ---------- Window Tracking & Ledge Physics ----------

  setWindows(data) {
    this.windows = data;
    if (this.stance !== 'sit' || this.busy || this.dragging) return;
    const win = data.wins.find((w) => w.id === this.perch?.id);
    const dx = win ? clamp(this.perch.dx, 55, win.w - 65) : 0;
    if (!win || !this.canSit(win) || this.covered(win, win.x + dx)) {
      this.fall(); // Window closed, minimized, maximized, or covered -> fall with physics!
      return;
    }
    const to = this.seat(win, dx);
    if (to.x !== this.pos.x || to.y !== this.pos.y) {
      this.pos = to; // Ride seated on top of the window as the user drags it!
      this.place();
    }
  }

  seat(win, dx) {
    return { x: win.x + dx, y: win.y + 6 + (SPRITE.feet.y - SPRITE.hip) * this.scale };
  }

  canSit(win) {
    const roomAbove = SPRITE.hip * this.scale + 16;
    return !win.max && win.w > 260 && win.y > roomAbove && win.y < this.view.h - 80;
  }

  covered(win, x) {
    const half = 34 * this.scale;
    for (const o of this.windows.wins) {
      if (o === win || o.id === win.id) return false;
      if (o.x < x + half && o.x + o.w > x - half && o.y <= win.y && o.y + o.h >= win.y) return true;
    }
    return false;
  }

  pickSeat({ frontOnly = false } = {}) {
    const options = [];
    for (const win of this.windows.wins) {
      if (!this.canSit(win)) continue;
      const dx = clamp(rand(win.w * 0.22, win.w * 0.68), 65, Math.max(65, win.w - 160));
      if (this.covered(win, win.x + dx)) continue;
      options.push({ win, dx });
    }
    const front = options.find((o) => o.win.id === this.windows.fg);
    if (frontOnly) return front || null;
    return front || options[0] || null;
  }

  // ---------- Semantic Action Slots Dispatcher ----------

  async triggerSlot(slotName, opts = {}) {
    switch (slotName) {
      case 'sit_window':
        return this.slotSitWindow(opts);
      case 'traverse':
        return this.slotTraverse(opts);
      case 'idle_quirk':
        return this.slotIdleQuirk(opts);
      case 'companion_interact':
      case 'companion_pet':
        return this.slotCompanionInteract(opts);
      case 'poke_annoyed':
        return this.slotPokeAnnoyed(opts);
      case 'tool_work':
        return this.slotToolWork(opts);
      case 'alert_confirm':
        return this.slotAlertConfirm(opts);
      case 'victory':
        return this.slotVictory(opts);
      case 'stow':
        return this.slotStow(opts);
      default:
        break;
    }
  }

  // SLOT 1: sit_window — 2B glides to a window's top frame, walks along the border, and sits down
  async slotSitWindow(opts = {}) {
    if (this.stowed || this.busy) return;
    const seat = opts.seat || this.pickSeat();
    if (!seat) {
      // No open floating window with room above: walk along the taskbar floor and sit/perch
      await this.slotTraverse({ to: { x: rand(180, this.view.w - 180), y: this.floor } });
      return;
    }

    const { win, dx } = seat;
    const startDx = clamp(dx + (Math.random() < 0.5 ? -90 : 90), 55, win.w - 65);
    const landPt = this.seat(win, startDx);
    const finalPt = this.seat(win, dx);

    // First glide to the window edge if not already on this window
    if (this.perch?.id !== win.id || Math.abs(this.pos.y - landPt.y) > 25) {
      await this.podGlideTo(landPt);
    }

    // Walk along the window top frame to the target seat spot
    this.busy = true;
    const walkDist = finalPt.x - this.pos.x;
    if (Math.abs(walkDist) > 16) {
      this.facing = walkDist < 0 ? 1 : -1;
      this.setStance('walk');
      const steps = Math.max(8, Math.round(Math.abs(walkDist) / 7));
      const startX = this.pos.x;
      for (let i = 1; i <= steps; i++) {
        this.pos.x = lerp(startX, finalPt.x, i / steps);
        this.pos.y = finalPt.y - (SPRITE.feet.y - SPRITE.hip) * this.scale * 0.15;
        if (i % 4 === 0) this.sound.play('footstep-metal', { gain: 0.55 });
        this.drawFrame();
        await sleep(ON_ONES);
      }
    }

    this.pos = { ...finalPt };
    this.setStance('sit', { perch: { id: win.id, dx } });
    this.sound.play('cloth-rustle');
    await this.perform('plop');
    this.busy = false;

    if (opts.announce !== false) {
      this.panel.say({
        kind: 'info',
        speaker: '2b',
        line: pick(NIER_DIALOGUES.sit_window),
        hold: 3600,
      });
    }
  }

  // SLOT 2: traverse — Pod Glide across the screen (2B holds onto Pod 042 and glides smoothly)
  async slotTraverse(opts = {}) {
    if (this.stowed || this.busy) return;
    const seat = !opts.to && Math.random() < 0.55 ? this.pickSeat() : null;
    if (seat) {
      await this.slotSitWindow({ seat, announce: false });
      return;
    }
    const to = opts.to || {
      x: clamp(rand(160, this.view.w - 160), 120, this.view.w - 120),
      y: this.floor,
    };
    await this.podGlideTo(to, { stance: 'stand' });
  }

  async podGlideTo(to, { stance = 'stand', perch = null } = {}) {
    if (this.stowed || this.busy) return;
    this.busy = true;
    const from = { ...this.pos };
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    this.facing = to.x < from.x ? 1 : -1;

    // Jump & grab Pod 042
    this.sound.play('cloth-rustle', { gain: 0.7 });
    this.sound.play('pod-glide');
    this.pod.state = 'carry';
    this.weapon.setMode('hidden');
    this.setStance('glide');
    this.fx.burst(from.x, from.y - 30, { count: 12, power: 0.7, spread: 40 });

    const durationMs = clamp(dist * 1.15, 480, 1150);
    const arcHeight = Math.min(130, 45 + dist * 0.14);
    const t0 = performance.now();

    while (true) {
      const now = performance.now();
      const t = Math.min(1, (now - t0) / durationMs);
      const e = ease.inOut(t);
      const parabola = 4 * t * (1 - t);
      this.pos.x = lerp(from.x, to.x, e);
      this.pos.y = lerp(from.y, to.y, e) - parabola * arcHeight;
      this.drawFrame(now);
      if (t >= 1) break;
      await sleep(16);
    }

    this.pos = { ...to };
    this.pod.state = 'follow';
    this.weapon.setMode('back');
    this.setStance(stance, { perch });
    this.sound.play('footstep-metal', { gain: 0.75 });
    this.fx.burst(to.x, to.y - 16, { count: 10, power: 0.5, spread: 45 });
    await this.perform(stance === 'sit' ? 'plop' : 'land');
    this.busy = false;
  }

  // SLOT 3: idle_quirk — 1) Inspect Virtuous Contract katana, 2) Pet Pod 042, or 3) Adjust combat visor
  async slotIdleQuirk(opts = {}) {
    if (this.stowed || this.busy) return;
    const choice = opts.kind || pick(['katana', 'pet_pod', 'visor']);

    if (choice === 'katana') {
      this.sound.play('weapon-hum');
      this.weapon.setMode('inspect');
      this.fx.ring(this.pos.x, this.pos.y - 220 * this.scale, { radius: 65, color: '#d8b868' });
      this.panel.say({
        kind: 'info',
        speaker: '2b',
        line: pick(NIER_DIALOGUES.idle_katana),
        hold: 3800,
      });
      await this.perform('inspect_katana', this.facing);
      this.weapon.setMode('back');
    } else if (choice === 'pet_pod') {
      await this.slotCompanionInteract({ initiator: '2b' });
    } else {
      this.sound.play('cloth-rustle');
      this.panel.say({
        kind: 'info',
        speaker: '2b',
        line: pick(NIER_DIALOGUES.idle_visor),
        hold: 4000,
      });
      await this.perform('adjust_visor');
    }
  }

  // SLOT 4: companion_interact — Petting Pod 042 (either by user circular cursor rub or by 2B)
  async slotCompanionInteract(opts = {}) {
    if (this.busy) return;
    this.pod.triggerHappy(2600);
    this.sound.play('pod-happy-chirp');

    if (this.stowed) {
      this.fx.podAffection(this.pod.pos.x, this.pod.pos.y - 25);
      this.panel.say({
        kind: 'info',
        speaker: 'pod',
        line: pick(NIER_DIALOGUES.companion_pet_pod),
        hold: 3600,
      });
      return;
    }

    this.busy = true;
    const prevPodState = this.pod.state;
    // Turn 2B so her right hand (-facing side) faces Pod 042, and bring Pod 042 right under her hand
    if (this.stance === 'stand') {
      this.facing = this.pod.pos.x <= this.pos.x ? 1 : -1;
    }
    const dirToPod = -this.facing;
    this.pod.state = 'pet';

    this.panel.say({
      kind: 'info',
      speaker: opts.initiator === 'user' ? '2b' : pick(['2b', 'pod']),
      line: opts.initiator === 'user'
        ? pick(NIER_DIALOGUES.companion_pet_2b)
        : pick([...NIER_DIALOGUES.companion_pet_2b, ...NIER_DIALOGUES.companion_pet_pod]),
      hold: 3800,
    });

    // Give Pod 042 a brief moment to glide into 2B's hand before her patting strokes
    await sleep(160);
    this.fx.podAffection(
      this.pos.x + dirToPod * (92 * this.scale),
      this.pos.y - 275 * this.scale
    );
    await this.perform('pet_pod', dirToPod);
    this.fx.podAffection(this.pod.pos.x, this.pod.pos.y - 28);

    if (this.pod.state === 'pet') {
      this.pod.state = this.stowed ? 'sentry' : (prevPodState === 'pet' ? 'follow' : prevPodState);
    }
    this.busy = false;
  }

  // SLOT 5: poke_annoyed — Rapid clicks or rough shake triggers Virtuous Contract katana slash at cursor!
  async slotPokeAnnoyed(opts = {}) {
    if (this.stowed || this.busy) return;
    this.busy = true;
    const target = opts.target || this.mouse || { x: this.pos.x - 120 * this.facing, y: this.pos.y - 180 };
    const dir = target.x < this.pos.x ? -1 : 1;
    this.facing = dir < 0 ? 1 : -1;

    this.sound.play('katana-slash');
    this.weapon.setMode('hidden');

    // Dramatic Studio Trigger / YoRHa cut-in banner + white/gold blade arc at cursor
    const h = this.head();
    this.fx.cutin(
      clamp(h.x + dir * 90, 20, this.view.w - 340),
      clamp(h.y - 70, 20, this.view.h - 190),
      dir,
      { kind: 'slash', life: 780 }
    );
    this.fx.slashArc(h.x, h.y + 40, target.x, target.y, { life: 360 });

    this.panel.say({
      kind: 'error',
      speaker: '2b',
      line: pick(NIER_DIALOGUES.poke_annoyed),
      hold: 4200,
    });

    await this.perform('katana_slash', dir);
    this.weapon.setMode('back');
    this.busy = false;
  }

  // SLOT 6: tool_work — 2B crosses arms vigilantly while Pod 042 projects a laser scanner over the active window
  async slotToolWork(opts = {}) {
    if (this.stowed) return;
    const prevStance = this.stance;
    const prevPerch = this.perch;

    this.sound.play('pod-scan');
    this.pod.state = 'scan';

    const fgWin = this.windows.wins.find((w) => w.id === this.windows.fg) || this.windows.wins[0] || {
      x: clamp(this.pos.x - 240, 60, this.view.w - 500),
      y: clamp(this.pos.y - 120, 80, this.view.h - 200),
      w: 480,
      h: 260,
    };

    this.fx.laserScan(() => this.pod.pos, fgWin, { life: 2200 });
    this.panel.say({
      kind: 'work',
      speaker: 'pod',
      tag: opts.tag || 'SCAN',
      line: opts.line || pick(NIER_DIALOGUES.tool_work),
      hold: 3400,
    });

    if (this.stance === 'stand') {
      this.setStance('work');
      await sleep(2200);
      if (this.stance === 'work') this.setStance(prevStance, { perch: prevPerch });
    } else {
      await sleep(2200);
    }
    if (this.pod.state === 'scan') this.pod.state = 'follow';
  }

  // SLOT 7: alert_confirm — Pod 042 flies directly to cursor blinking red/amber + YoRHa authorization hologram
  async slotAlertConfirm(opts = {}) {
    this.sound.play('alert-permission');
    this.pod.state = 'alert';

    const h = this.head();
    if (!this.stowed) {
      this.fx.cutin(
        clamp(h.x - 150, 20, this.view.w - 340),
        clamp(h.y - 90, 20, this.view.h - 190),
        1,
        { kind: 'eyes', life: 880 }
      );
    }

    this.panel.say({
      kind: 'alert',
      speaker: 'pod',
      tag: opts.tool || 'NIVEL 2',
      line: opts.line || pick(NIER_DIALOGUES.alert_confirm),
      quote: opts.command || 'powershell.exe -NoProfile -ExecutionPolicy Bypass ...',
      actions: true,
      hold: null,
    });

    this.panel.onAction = (decision) => {
      this.sound.play(decision === 'deny' ? 'ui-cancel' : 'ui-confirm');
      this.pod.state = this.stowed ? 'sentry' : 'follow';
      opts.onDecision?.(decision);
    };
  }

  // SLOT 8: victory — Classic 2B katana spin, flick, and mid-air sheathe behind her back
  async slotVictory(opts = {}) {
    if (this.stowed || this.busy) return;
    this.busy = true;
    this.sound.play('katana-slash', { rate: 1.15, gain: 0.7 });
    this.weapon.setMode('sheathe');
    const h = this.head();
    this.fx.ring(h.x, h.y + 40, { radius: 110, color: '#ffffff' });
    this.fx.burst(h.x, h.y + 40, { count: 24, power: 1.1, spread: 80 });

    await this.perform('victory_sheathe', this.facing);
    this.sound.play('katana-sheathe');
    this.sound.play('ui-confirm');
    this.weapon.setMode('back');
    this.fx.ring(h.x, h.y + 30, { radius: 85, color: '#d8b868' });

    this.panel.say({
      kind: 'done',
      speaker: '2b',
      line: opts.line || pick(NIER_DIALOGUES.victory),
      hold: 4200,
    });
    this.busy = false;
  }

  // SLOT 9: stow (Ctrl+Alt+C) — 2B dematerializes to the Bunker in monochrome particles; only Pod 042 remains in corner
  async slotStow({ on } = {}) {
    for (let i = 0; this.busy && i < 25; i++) await sleep(80);
    const targetStow = typeof on === 'boolean' ? on : !this.stowed;
    if (targetStow === this.stowed) return;
    this.busy = true;

    this.sound.play('bunker-transport');
    const h = this.head();

    if (targetStow) {
      await this.perform('bunker_out');
      this.fx.bunkerBeam(this.pos.x, this.pos.y, { life: 580, width: 64 });
      this.weapon.setMode('hidden');
      this.p.glitchSeed = Math.random() * 100;
      await tween(this.p, { bunker: 1, collapse: 0.92, dissolve: 0.65, glitch: 0.55, alpha: 0 }, 380, ease.in);
      this.stowed = true;
      this.root.hidden = true;
      this.pod.state = 'sentry';
      this.panel.say({
        kind: 'info',
        speaker: 'pod',
        line: pick(NIER_DIALOGUES.stow_out),
        hold: 3800,
      });
    } else {
      this.stowed = false;
      this.root.hidden = false;
      this.pod.state = 'follow';
      this.fx.bunkerBeam(this.pos.x, this.pos.y, { life: 580, width: 64 });
      Object.assign(this.p, { bunker: 1, collapse: 0.92, dissolve: 0.65, glitch: 0.55, alpha: 1 });
      await tween(this.p, { bunker: 0, collapse: 0, dissolve: 0, glitch: 0 }, 380, ease.out);
      this.weapon.setMode('back');
      this.panel.say({
        kind: 'info',
        speaker: '2b',
        line: pick(NIER_DIALOGUES.stow_in),
        hold: 3800,
      });
    }

    this.busy = false;
  }

  // ---------- Gravity & Falling when a window closes/minimizes ----------

  landing() {
    const hip = this.pos.y - (SPRITE.feet.y - SPRITE.hip) * this.scale;
    let best = null;
    for (const win of this.windows.wins) {
      if (!this.canSit(win) || win.y < hip - 4) continue;
      if (this.pos.x < win.x + 45 || this.pos.x > win.x + win.w - 45) continue;
      if (this.covered(win, this.pos.x)) continue;
      if (!best || win.y < best.y) best = win;
    }
    if (best) {
      const dx = this.pos.x - best.x;
      return { y: this.seat(best, dx).y, stance: 'sit', perch: { id: best.id, dx } };
    }
    return { y: this.floor, stance: 'stand', perch: null };
  }

  fall() {
    if (this.stance === 'fall') return;
    this.landingSpot = this.landing();
    this.setStance('fall');
    this.vy = 0;
    this.lastFall = performance.now();
  }

  updateFall(now) {
    const target = this.landingSpot;
    const dt = Math.min(0.05, (now - this.lastFall) / 1000);
    this.lastFall = now;
    this.vy = Math.min(this.vy + GRAVITY * dt, 1850);
    const y = reducedMotion.matches ? target.y : this.pos.y + this.vy * dt;
    if (y < target.y) {
      this.pos.y = y;
      return;
    }
    this.pos.y = target.y;
    this.setStance(target.stance, { perch: target.perch });
    this.sound.play('footstep-metal');
    this.fx.burst(this.pos.x, this.pos.y - 16, { count: 12, power: 0.6, spread: 50 });
    this.perform(target.stance === 'sit' ? 'plop' : 'land');
  }

  // ---------- Animation & Frame Loop ----------

  perform(name, dir = 0) {
    if (this.stowed) return Promise.resolve();
    const next = new Player(name, { dir });
    if (this.act && this.act.player.priority > next.priority) return Promise.resolve();
    this.endAct(false);
    return new Promise((done) => {
      this.act = { player: next, done };
    });
  }

  endAct(completed) {
    const current = this.act;
    if (!current) return;
    this.act = null;
    if (completed && current.player.act.flip) this.facing *= -1;
    current.done();
  }

  setStance(stance, { perch = null, dir = 0 } = {}) {
    this.stance = stance;
    this.perch = perch;
    this.p.sit = stance === 'sit' ? 1 : 0;
    this.base = new Player(stance, { dir });
    this.pivot();
  }

  interval() {
    if (this.busy || this.stance === 'fall' || this.stance === 'glide' || this.stance === 'walk' || this.act?.player.act.fps === 24) {
      return ON_ONES;
    }
    return ON_TWOS;
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    this.pod.updateAndDraw(now, this.pos, this.facing, this.view, this.mouse);
    if (this.stowed) return;
    if (now - this.lastDraw < this.interval() - 1) return;
    this.drawFrame(now);
    this.behave(now);
  }

  drawFrame(now = performance.now()) {
    this.lastDraw = now;
    this.animate(now);
    this.weapon.draw(now, {
      facing: this.facing,
      alpha: this.p.alpha,
      sit: this.p.sit,
      glide: this.stance === 'glide',
    });
    this.sprite.draw(this.p);
    this.place();
  }

  animate(now) {
    const p = this.p;
    p.seed = Math.random() * 100;

    const under = this.base.sample(now);
    const base = under ? this.base.resolve(under.pose, this.facing) : {};
    let act = null;
    if (this.act) {
      const drawing = this.act.player.sample(now);
      if (drawing) {
        act = this.act.player.resolve(drawing.pose, this.facing);
      } else {
        this.endAct(true);
      }
    }
    const pose = { ...NEUTRAL, ...base, ...act };

    p.head = pose.head;
    p.hair = pose.hair;
    p.skirt = pose.skirt;
    p.armL = pose.armL;
    p.armR = pose.armR;
    p.longL = pose.longL;
    p.longR = pose.longR;
    p.kickL = pose.kickL;
    p.kickR = pose.kickR;
    p.smear = pose.smear;
    p.echo = pose.echo;

    const bob = this.stance === 'sit' ? clamp(pose.bob, -2, 2) : pose.bob;
    this.bob = this.dragging ? 0 : bob;
    this.tilt = this.dragging ? 0 : pose.tilt;
    this.sx = pose.sx;
    this.sy = pose.sy;
  }

  behave(now) {
    if (this.stance === 'fall') {
      this.updateFall(now);
      return;
    }
    if (this.busy || this.dragging || this.stowed) return;

    if (now > this.nextQuirk) {
      const base = (this.idleQuirkIntervalSec || 45) * 1000;
      this.nextQuirk = now + rand(base * 0.75, base * 1.25);
      this.slotIdleQuirk();
      return;
    }

    if (this.wander && now > this.nextWander) {
      this.nextWander = now + rand(28000, 55000);
      const seat = this.pickSeat();
      if (seat && (this.stance !== 'sit' || this.perch?.id !== seat.win.id)) {
        this.slotSitWindow({ seat, announce: false });
      } else {
        this.slotTraverse();
      }
    }
  }

  forceStance(stance) {
    if (stance === 'auto') {
      this.busy = false;
      this.setStance('stand');
      this.pod.state = 'follow';
      this.weapon.setMode('back');
      this.drawFrame();
      return;
    }
    this.busy = false;
    this.setStance(stance);
    if (stance === 'sit') {
      this.p.sit = 1;
      this.weapon.setMode('back');
      this.perform('plop');
    } else if (stance === 'walk') {
      this.p.sit = 0;
      this.weapon.setMode('back');
      this.perform('walk');
    } else if (stance === 'glide') {
      this.p.sit = 0;
      this.pod.state = 'carry';
      this.weapon.setMode('hidden');
    } else if (stance === 'work') {
      this.p.sit = 0;
      this.pod.state = 'follow';
      this.weapon.setMode('back');
    } else {
      this.p.sit = 0;
      this.pod.state = 'follow';
      this.weapon.setMode('back');
    }
    this.drawFrame();
  }

  // ---------- Pointer & Interactive Hotspots (2B + Pod 042) ----------

  bindInteractions() {
    let down = null;
    let shakeDistance = 0;
    let lastDragPos = null;

    window.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;

      // Clicking Pod 042: if stowed, deploy 2B; otherwise open Holographic YoRHa Chat Bar
      if (this.hitPod(e.clientX, e.clientY)) {
        if (this.stowed) {
          this.slotStow({ on: false });
        } else if (this.onPodClick) {
          this.onPodClick({ x: this.pod.pos.x, y: this.pod.pos.y - 45 });
        } else {
          this.sound.play('ui-open');
          this.slotCompanionInteract({ initiator: 'user' });
        }
        return;
      }

      if (this.busy || !this.hitCharacter(e.clientX, e.clientY)) return;
      down = { x: e.clientX, y: e.clientY, pos: { ...this.pos } };
      lastDragPos = { x: e.clientX, y: e.clientY };
      shakeDistance = 0;
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse = { x: e.clientX, y: e.clientY };

      // Check circular rubbing / petting on Pod 042 (companion_pet)
      if (!down && this.hitPod(e.clientX, e.clientY)) {
        const angle = Math.atan2(e.clientY - this.pod.pos.y, e.clientX - this.pod.pos.x);
        if (this.lastPodMouse) {
          this.podRubDistance += Math.hypot(e.clientX - this.lastPodMouse.x, e.clientY - this.lastPodMouse.y);
          if (this.lastPodAngle !== null) {
            let da = angle - this.lastPodAngle;
            if (da > Math.PI) da -= Math.PI * 2;
            if (da < -Math.PI) da += Math.PI * 2;
            this.podAngleAccum += Math.abs(da);
          }
          if (this.podRubDistance > 145 || this.podAngleAccum > Math.PI * 1.65) {
            this.podRubDistance = 0;
            this.podAngleAccum = 0;
            this.slotCompanionInteract({ initiator: 'user' });
          }
        }
        this.lastPodMouse = { x: e.clientX, y: e.clientY };
        this.lastPodAngle = angle;
      } else {
        this.lastPodMouse = null;
        this.lastPodAngle = null;
        this.podRubDistance *= 0.9;
        this.podAngleAccum *= 0.9;
      }

      if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (lastDragPos) {
          shakeDistance += Math.hypot(e.clientX - lastDragPos.x, e.clientY - lastDragPos.y);
          lastDragPos = { x: e.clientX, y: e.clientY };
        }
        if (!this.dragging && Math.hypot(dx, dy) > 6 && !this.busy) {
          this.dragging = true;
          this.endAct(false);
          this.setStance('stand');
          this.panel.suspend();
        }
        if (this.dragging) {
          this.pos = {
            x: clamp(down.pos.x + dx, 50, this.view.w - 50),
            y: clamp(down.pos.y + dy, SPRITE.height * this.scale * 0.5, this.floor),
          };
          this.place();
          // Rough shaking while dragging triggers poke_annoyed katana slash!
          if (shakeDistance > 950) {
            down = null;
            this.dragging = false;
            this.panel.resume();
            this.drop();
            this.slotPokeAnnoyed({ target: { x: e.clientX, y: e.clientY } });
          }
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!down) return;
      const wasDragging = this.dragging;
      down = null;
      this.dragging = false;

      if (wasDragging) {
        this.panel.resume();
        this.drop();
      } else {
        // Track rapid clicks on 2B -> trigger poke_annoyed if >= 4 clicks within 1.8s
        const now = performance.now();
        this.clickTimestamps = this.clickTimestamps.filter((t) => now - t < 1800);
        this.clickTimestamps.push(now);
        if (this.clickTimestamps.length >= 4) {
          this.clickTimestamps = [];
          this.slotPokeAnnoyed({ target: { x: e.clientX, y: e.clientY } });
        } else {
          this.sound.play('ui-open');
          this.statusReport();
        }
      }
    });
  }

  drop() {
    const s = this.scale;
    const hip = this.pos.y - (SPRITE.feet.y - SPRITE.hip) * s;
    for (const win of this.windows.wins) {
      if (!this.canSit(win) || Math.abs(hip - win.y) > 28) continue;
      if (this.pos.x < win.x + 45 || this.pos.x > win.x + win.w - 45 || this.covered(win, this.pos.x)) continue;
      const dx = this.pos.x - win.x;
      this.pos = this.seat(win, dx);
      this.setStance('sit', { perch: { id: win.id, dx } });
      this.sound.play('cloth-rustle');
      this.perform('plop');
      return;
    }
    if (this.pos.y < this.floor - 2) this.fall();
    else this.perform('land');
  }

  statusReport() {
    const speaker = Math.random() < 0.6 ? '2b' : 'pod';
    this.panel.say({
      kind: 'info',
      speaker,
      line: speaker === '2b' ? pick(NIER_DIALOGUES.boot_2b) : pick(NIER_DIALOGUES.boot_pod),
      hold: 4200,
    });
  }
}
