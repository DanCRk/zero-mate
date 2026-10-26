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
  edge_peek: [
    'Reporte: Vigilancia perimetral en curso desde el borde de pantalla.',
    'Ángulo de observación óptimo asegurado.',
  ],
  edge_peek_top: [
    'Propuesta: Infiltración aérea suspendida con apoyo de Pod 042.',
    'Vigilancia vertical iniciada.',
  ],
  window_breach: [
    'Iniciando secuencia de hackeo YoRHa. Brecha dimensional establecida.',
    'Reporte: Desplazamiento a través del espacio digital completado.',
  ],
  wall_jump_glide: [
    'Maniobra acrobática ejecutada. Enlace táctico con Pod 042.',
    'Impulso cinético confirmado. Iniciando planeo aéreo.',
  ],
  sleep_standby: [
    'Modo de espera táctico activado. Sistemas en baja potencia.',
    'Reporte: Diagnóstico de sistemas YoRHa en proceso.',
  ],
  sleep_wake: [
    'Reanudando actividad operativa. Sistemas al 100%.',
    'Modo reposo interrumpido. Lista para combate.',
  ],
  bunker_uplink: [
    'Reporte: Telemetría orbital alineada. Sincronizando datos con el Búnker YoRHa.',
    'Enlace con satélite orbital confirmado. Descarga de directivas completada.',
  ],
};

export class ThemeEngine {
  constructor({ charRoot, spriteCanvas, weaponCanvas, podRoot, podCanvas, images, fx, soundBank, panel, theme }) {
    this.root = charRoot;
    this.canvas = spriteCanvas;
    this.sprite = new SpriteRenderer(spriteCanvas, images.charImg, images.sitImg, images.peekImg, images.sleepImg, images.spinImg, images.ceilingImg);
    this.weapon = new WeaponHaloRenderer(weaponCanvas, images.katanaImg);
    this.pod = new PodCompanion(podRoot, podCanvas, images.podImg);
    this.satelliteImg = images.satelliteImg || null;
    this.fx = fx;
    this.sound = soundBank;
    this.panel = panel;
    this.theme = theme;

    this.scale = 0.62;
    this.view = { w: innerWidth, h: innerHeight };
    this.pos = { x: innerWidth - 220, y: innerHeight - 6 };
    this.facing = 1;
    this.stance = 'stand'; // stand | sit | walk | glide | work | fall | peek | sleep
    this.mode = 'idle'; // idle | sleep | peek | breach | wall_jump
    this.peekSide = null; // 'left' | 'right' | 'top'
    this.peekUntil = 0;
    this.nextDoze = 0;
    this.lastUserInteraction = performance.now();
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
      pose: 'stand',
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
    this.sitAlphaMap = images.sitImg ? this.buildAlphaMap(images.sitImg) : null;
    this.peekAlphaMap = images.peekImg ? this.buildAlphaMap(images.peekImg) : null;
    this.sleepAlphaMap = images.sleepImg ? this.buildAlphaMap(images.sleepImg) : null;
    this.spinAlphaMap = images.spinImg ? this.buildAlphaMap(images.spinImg) : null;
    this.ceilingAlphaMap = images.ceilingImg ? this.buildAlphaMap(images.ceilingImg) : null;
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
    if (this.stance === 'ceiling' || this.p.pose === 'ceiling') {
      return { x: at.x, y: 340 * s, top: 310 * s };
    }
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

  // Pixel-accurate hit test on 2B's sprite (supports standing, seated, peek, sleep)
  hitCharacter(x, y) {
    if (this.stowed || this.p.alpha < 0.3) return false;
    const s = this.scale;
    const fy = this.pos.y + this.bob;
    const sx = SPRITE.feet.x + ((x - this.pos.x) / s) * this.facing;
    let sy = SPRITE.feet.y - (fy - y) / s;
    const useSitMap = Boolean(this.sitAlphaMap && (this.p.sit > 0.5 || this.p.pose === 'sit'));
    const useCeilingMap = Boolean(this.ceilingAlphaMap && (this.stance === 'ceiling' || this.p.pose === 'ceiling'));
    const usePeekMap = Boolean(this.peekAlphaMap && (this.stance === 'peek' || this.p.pose === 'peek'));
    const useSleepMap = Boolean(this.sleepAlphaMap && (this.stance === 'sleep' || this.p.pose === 'sleep'));
    if (!useSitMap && !usePeekMap && !useSleepMap && this.p.sit > 0 && sy > SPRITE.hip) {
      const c = lerp(1, 0.42, this.p.sit);
      sy = sy <= SPRITE.hip + THIGH * c ? SPRITE.hip + (sy - SPRITE.hip) / c : sy + THIGH * (1 - c);
    }
    const useSpinMap = Boolean(this.spinAlphaMap && (this.p.pose === 'spin' || this.p.pose === 'wall_spin'));
    const map = useSpinMap ? this.spinAlphaMap : (useCeilingMap ? this.ceilingAlphaMap : (usePeekMap ? this.peekAlphaMap : (useSleepMap ? this.sleepAlphaMap : (useSitMap ? this.sitAlphaMap : this.alphaMap))));
    for (const [dx, dy] of [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]]) {
      const px = Math.round(sx + dx), py = Math.round(sy + dy);
      if (px < 0 || py < 0 || px >= SPRITE.width || py >= SPRITE.height) continue;
      if (map[(py * SPRITE.width + px) * 4 + 3] > 40) return true;
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
    return { x: win.x + dx, y: win.y + 3 + (SPRITE.feet.y - SPRITE.hip) * this.scale };
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
      case 'edge_peek':
      case 'peek':
        return this.slotEdgePeek(opts);
      case 'unpeek':
        return this.unpeek(opts);
      case 'window_breach':
      case 'breach':
        return this.slotWindowBreach(opts);
      case 'wall_jump_glide':
      case 'wall_jump':
        return this.slotWallJumpGlide(opts);
      case 'sleep_standby':
      case 'sleep':
        return this.slotSleepStandby(opts);
      case 'wake':
        return this.wake(opts);
      case 'bunker_uplink':
      case 'uplink':
        return this.slotBunkerUplink(opts);
      default:
        break;
    }
  }

  // SLOT 1: sit_window — 2B glides directly onto a window's top frame and sits down dangling her legs (like Capri's sitOn)
  async slotSitWindow(opts = {}) {
    if (this.stowed || this.busy) return;
    const seat = opts.seat || this.pickSeat();
    if (!seat) {
      await this.slotTraverse({ to: { x: rand(180, this.view.w - 180), y: this.floor } });
      return;
    }

    const { win, dx } = seat;
    const finalPt = this.seat(win, dx);
    await this.podGlideTo(finalPt, { stance: 'sit', perch: { id: win.id, dx } });

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

    if (!opts.silent) this.sound.play('pod-scan');
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
    if (!opts.silent) this.sound.play('katana-slash', { rate: 1.15, gain: 0.7 });
    this.weapon.setMode('sheathe');
    const h = this.head();
    this.fx.ring(h.x, h.y + 40, { radius: 110, color: '#ffffff' });
    this.fx.burst(h.x, h.y + 40, { count: 24, power: 1.1, spread: 80 });

    await this.perform('victory_sheathe', this.facing);
    if (!opts.silent) {
      this.sound.play('katana-sheathe');
      this.sound.play('ui-confirm');
    }
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

  // SLOT: edge_peek — 2B firmly anchors and peeks from screen borders with hand & boots aligned to monitor bezel
  async slotEdgePeek(opts = {}) {
    if (this.stowed || this.busy) return;
    const side = opts.side || opts.arg || pick(['left', 'right', 'top']);
    this.busy = true;
    this.mode = 'peek';
    this.peekSide = side;
    this.peekUntil = performance.now() + rand(8000, 12000);

    this.sound.play('cloth-rustle', { gain: 0.65 });
    const s = this.scale;
    // Exactly aligns hand grip and braced boots with monitor border (x = 0 or x = view.w)
    const anchorOffset = Math.round(126 * s);

    if (side === 'left') {
      this.facing = -1;
      this.pos.x = anchorOffset;
      this.pos.y = this.floor;
      this.setStance('peek');
      this.weapon.setMode('hidden');
      this.pod.pos = { x: this.pos.x + 95, y: this.pos.y - 180 };
    } else if (side === 'right') {
      this.facing = 1;
      this.pos.x = Math.round(this.view.w - anchorOffset);
      this.pos.y = this.floor;
      this.setStance('peek');
      this.weapon.setMode('hidden');
      this.pod.pos = { x: this.pos.x - 95, y: this.pos.y - 180 };
    } else {
      // Ceiling Hang — 2B suspendida de cabeza desde el borde superior de la pantalla
      this.facing = Math.random() < 0.5 ? 1 : -1;
      this.pos.x = clamp(rand(240, this.view.w - 240), 200, this.view.w - 200);
      // Las botas se anclan exactamente en el marco superior de la pantalla (y = 0)
      this.pos.y = Math.round((SPRITE.feet.y - 12) * s);
      this.setStance('ceiling');
      this.p.pose = 'ceiling';
      this.weapon.setMode('hidden');
      this.pod.state = 'ceiling';
      this.pod.pos = { x: this.pos.x + (this.facing * 92), y: 56 };
    }

    if (opts.announce !== false) {
      this.panel.say({
        kind: 'info',
        speaker: 'pod',
        line: side === 'top' ? pick(NIER_DIALOGUES.edge_peek_top) : pick(NIER_DIALOGUES.edge_peek),
        hold: 3800,
      });
    }

    this.busy = false;
  }

  async unpeek(opts = {}) {
    if (this.stance !== 'peek' && this.stance !== 'ceiling') return;
    if (this.peekSide === 'top') {
      this.busy = true;
      this.mode = 'idle';
      this.peekSide = null;
      this.sound.play('cloth-rustle', { gain: 0.7 });
      this.setStance('stand');
      this.p.pose = 'stand';
      this.pod.state = 'follow';
      this.weapon.setMode('back');
      this.fall(); // Cae con gravedad suavemente al suelo o a una ventana
      this.busy = false;
      return;
    }
    this.busy = true;
    this.mode = 'idle';
    const side = this.peekSide;
    this.peekSide = null;
    this.sound.play('cloth-rustle', { gain: 0.6 });
    this.setStance('stand');
    this.weapon.setMode('back');
    const stepIn = side === 'left' ? 90 : -90;
    this.pos.x = clamp(this.pos.x + stepIn, 100, this.view.w - 100);
    this.facing = side === 'left' ? -1 : 1;
    this.place();
    if (opts.shy) {
      this.panel.say({
        kind: 'info',
        speaker: '2b',
        line: '... Detectada proximidad. Reanudando postura neutral.',
        hold: 3000,
      });
    }
    this.busy = false;
  }

  // SLOT: window_breach — Infiltration / hack dive through window with YoRHa portal glitch
  async slotWindowBreach(opts = {}) {
    if (this.stowed || this.busy) return;
    this.busy = true;
    this.mode = 'breach';

    const wins = this.windows.wins.filter((w) => this.canSit(w));
    let w1 = wins[0];
    let w2 = wins[1] || wins[0];

    if (!w1) {
      w1 = { x: 140, y: 220, w: 420, h: 280, id: 998 };
      w2 = { x: this.view.w - 560, y: 180, w: 440, h: 290, id: 999 };
    } else if (!wins[1]) {
      w2 = { x: clamp(w1.x > this.view.w * 0.5 ? 120 : this.view.w - 520, 80, this.view.w - 480), y: w1.y, w: w1.w, h: w1.h, id: 999 };
    }

    this.panel.say({
      kind: 'work',
      speaker: 'pod',
      tag: 'INFILTRACIÓN',
      line: pick(NIER_DIALOGUES.window_breach),
      hold: 4000,
    });

    const entryPt = { x: clamp(w1.x + w1.w * 0.5, 90, this.view.w - 90), y: w1.y + 40 };
    this.pos = { ...entryPt };
    this.setStance('stand');
    this.sound.play('pod-scan');
    this.fx.windowBreach(w1);
    await sleep(400);

    this.sound.play('bunker-transport', { rate: 1.2, gain: 0.85 });
    this.perform('dive');
    this.p.glitchSeed = Math.random() * 100;
    await tween(this.p, { collapse: 0.95, dissolve: 0.8, glitch: 0.9, alpha: 0 }, 360, ease.in);

    await sleep(250);

    const exitPt = this.seat(w2, clamp(w2.w * 0.5, 45, w2.w - 45));
    this.pos = { ...exitPt };
    this.facing = exitPt.x > this.view.w * 0.5 ? -1 : 1;
    this.fx.windowBreach(w2);
    this.sound.play('bunker-transport', { rate: 1.1, gain: 0.75 });
    Object.assign(this.p, { collapse: 0.95, dissolve: 0.8, glitch: 0.9, alpha: 1 });
    await tween(this.p, { collapse: 0, dissolve: 0, glitch: 0 }, 340, ease.out);

    this.sound.play('cloth-rustle');
    this.sound.play('footstep-metal');
    this.setStance('sit', { perch: { id: w2.id, dx: w2.w * 0.5 } });
    await this.perform('plop');

    this.mode = 'idle';
    this.busy = false;
  }

  // SLOT: wall_jump_glide — 3-Phase Dynamic Acrobatic Ninja Wall Jump & Pod Glide
  async slotWallJumpGlide(opts = {}) {
    if (this.stowed || this.busy) return;
    this.busy = true;
    this.mode = 'wall_jump';

    const side = opts.side || (this.pos.x > this.view.w * 0.5 ? 'right' : 'left');
    const s = this.scale;
    const anchorOffset = Math.round(126 * s);
    const wallX = side === 'left' ? anchorOffset : Math.round(this.view.w - anchorOffset);
    const startY = this.pos.y;

    // FASE 1: Compresión en la pared (2B corre y se ancla al borde del monitor flexionando rodillas)
    this.facing = side === 'left' ? 1 : -1;
    this.setStance('walk');
    this.sound.play('cloth-rustle', { gain: 0.7 });
    await tween(this.pos, { x: wallX, y: Math.max(180, startY - 90) }, 230, ease.out);

    // Impacto y anclaje en el marco (orientada hacia el interior del escritorio)
    this.facing = side === 'left' ? -1 : 1;
    this.setStance('peek');
    this.weapon.setMode('hidden');
    this.sound.play('footstep-metal', { gain: 0.85 });
    this.fx.burst(wallX, this.pos.y - 40, { count: 10, power: 0.65, spread: 35 });
    await sleep(220); // Pausa de compresión elástica preparatoria

    // FASE 2: Impulso explosivo y pirueta aérea con textura acrobática 2b-acrobat-spin
    this.facing = side === 'left' ? -1 : 1; // Despega orientada hacia el centro
    this.sound.play('katana-slash', { rate: 1.25, gain: 0.85 });
    this.fx.burst(wallX, this.pos.y - 60, { count: 24, power: 1.45, spread: 85 });
    this.fx.ring(wallX, this.pos.y - 60, { radius: 105, color: '#d8b868' });

    // Inicia somersault acrobático (cambia a textura 2b-acrobat-spin vía pose: 'spin')
    this.perform('wall_spin');

    // Salto parabólico despegándose hacia arriba y al centro
    const apexX = clamp(wallX + (side === 'left' ? 240 : -240), 120, this.view.w - 120);
    const apexY = Math.max(100, this.pos.y - 170);
    await tween(this.pos, { x: apexX, y: apexY }, 310, ease.out);
    this.sound.play('weapon-hum', { gain: 0.65 });
    this.fx.ring(this.pos.x, this.pos.y - 35, { radius: 70, color: '#ffffff' });

    // FASE 3: Enganche dinámico con Pod 042 y planeo suave a destino
    this.endAct(true);
    this.pod.pos = { x: this.pos.x, y: this.pos.y - 455 * s };
    this.sound.play('pod-glide');
    this.sound.play('cloth-rustle', { gain: 0.7 });
    this.pod.state = 'carry';
    this.weapon.setMode('hidden');
    this.setStance('glide');

    const seat = this.pickSeat();
    const landTarget = seat ? this.seat(seat.win, seat.dx) : { x: clamp(this.view.w * 0.5 + rand(-150, 150), 140, this.view.w - 140), y: this.floor };
    this.facing = landTarget.x < this.pos.x ? 1 : -1;
    const glideMid = {
      x: (this.pos.x + landTarget.x) * 0.5,
      y: Math.min(this.pos.y, landTarget.y) - 45,
    };

    await tween(this.pos, glideMid, 290, ease.out);
    await tween(this.pos, landTarget, 380, ease.in);

    // Aterrizaje
    this.pod.state = 'follow';
    this.weapon.setMode('back');
    if (seat) {
      this.facing = seat.win.x > this.view.w * 0.5 ? -1 : 1;
      this.setStance('sit', { perch: { id: seat.win.id, dx: seat.dx } });
      this.sound.play('cloth-rustle');
      await this.perform('plop');
    } else {
      this.setStance('stand');
      this.sound.play('footstep-metal');
      this.fx.burst(landTarget.x, landTarget.y - 12, { count: 14, power: 0.7, spread: 50 });
      await this.perform('land');
    }

    if (opts.announce !== false) {
      this.panel.say({
        kind: 'info',
        speaker: 'pod',
        line: pick(NIER_DIALOGUES.wall_jump_glide),
        hold: 3600,
      });
    }

    this.mode = 'idle';
    this.busy = false;
  }

  // SLOT: sleep_standby — 2B sits down, lowers head, diagnostic hologram cone
  async slotSleepStandby(opts = {}) {
    if (this.stowed || this.busy) return;
    this.busy = true;
    this.mode = 'sleep';
    this.nextDoze = performance.now() + rand(12000, 20000);

    this.sound.play('cloth-rustle', { gain: 0.65 });
    this.setStance('sleep');
    this.weapon.setMode('back');
    this.pod.state = 'follow';

    this.fx.diagnosticHologram(() => this.pod.pos, () => this.pos);

    if (opts.announce !== false) {
      this.panel.say({
        kind: 'info',
        speaker: 'pod',
        line: pick(NIER_DIALOGUES.sleep_standby),
        hold: 4200,
      });
    }

    this.busy = false;
  }

  wake(opts = {}) {
    if (this.mode !== 'sleep') return;
    this.mode = 'idle';
    this.sound.play('ui-open', { gain: 0.7 });
    this.setStance('stand');
    this.perform('land');
    if (opts.announce !== false) {
      this.panel.say({
        kind: 'info',
        speaker: '2b',
        line: pick(NIER_DIALOGUES.sleep_wake),
        hold: 3600,
      });
    }
  }

  // SLOT: bunker_uplink — Bunker satellite flyover + Pod 042 telemetry data beam + 2B gaze
  async slotBunkerUplink(opts = {}) {
    if (this.stowed || this.busy) return;
    this.busy = true;

    this.sound.play('bunker-transport', { rate: 0.9, gain: 0.8 });
    this.sound.play('pod-scan');

    this.perform('gaze');
    this.fx.satelliteUplink({
      satelliteImg: this.satelliteImg,
      podPosFn: () => this.pod.pos,
    });

    this.panel.say({
      kind: 'info',
      speaker: 'pod',
      tag: 'BÚNKER YORHA',
      line: pick(NIER_DIALOGUES.bunker_uplink),
      hold: 5200,
    });

    await sleep(2800);
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
    this.p.pose = stance === 'sit' ? 'sit' : (stance === 'peek' ? 'peek' : (stance === 'ceiling' ? 'ceiling' : (stance === 'sleep' ? 'sleep' : 'stand')));
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

    p.pose = pose.pose || (this.stance === 'sit' ? 'sit' : (this.stance === 'peek' ? 'peek' : (this.stance === 'ceiling' ? 'ceiling' : (this.stance === 'sleep' ? 'sleep' : 'stand'))));
    const bob = (this.stance === 'sit' || this.stance === 'sleep' || this.stance === 'peek' || this.stance === 'ceiling') ? clamp(pose.bob, -2, 2) : pose.bob;
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

    if (this.mode === 'sleep') {
      if (now > this.nextDoze) {
        this.nextDoze = now + rand(14000, 24000);
        this.perform('doze');
      }
      return;
    }

    if (this.mode === 'peek') {
      if (now > this.peekUntil) {
        this.unpeek();
      }
      return;
    }

    if (now > this.nextQuirk) {
      const base = (this.idleQuirkIntervalSec || 45) * 1000;
      this.nextQuirk = now + rand(base * 0.75, base * 1.25);
      const idleTime = now - this.lastUserInteraction;
      if (idleTime > 120000 && Math.random() < 0.35) {
        this.slotSleepStandby();
      } else if (Math.random() < 0.25) {
        this.slotBunkerUplink();
      } else {
        this.slotIdleQuirk();
      }
      return;
    }

    if (this.wander && now > this.nextWander) {
      this.nextWander = now + rand(28000, 52000);
      const roll = Math.random();
      if (roll < 0.35) {
        const seat = this.pickSeat();
        if (seat && (this.stance !== 'sit' || this.perch?.id !== seat.win.id)) {
          this.slotSitWindow({ seat, announce: false });
        } else {
          this.slotTraverse();
        }
      } else if (roll < 0.55) {
        this.slotEdgePeek({ announce: false });
      } else if (roll < 0.75) {
        this.slotWallJumpGlide({ announce: false });
      } else if (roll < 0.90 && this.windows.wins.length > 0) {
        this.slotWindowBreach({ announce: false });
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
    } else if (stance === 'spin') {
      this.mode = 'idle';
      this.p.sit = 0;
      this.weapon.setMode('hidden');
      this.pod.state = 'follow';
      this.perform('wall_spin');
    } else if (stance === 'peek') {
      this.mode = 'peek';
      this.p.sit = 0;
      this.weapon.setMode('hidden');
      this.pod.state = 'follow';
      this.perform('peek');
    } else if (stance === 'sleep') {
      this.mode = 'sleep';
      this.p.sit = 0;
      this.weapon.setMode('back');
      this.pod.state = 'follow';
      this.fx.diagnosticHologram(() => this.pod.pos, () => this.pos);
      this.perform('sleep');
    } else if (stance === 'work') {
      this.mode = 'idle';
      this.p.sit = 0;
      this.pod.state = 'follow';
      this.weapon.setMode('back');
    } else {
      this.mode = 'idle';
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
      this.lastUserInteraction = performance.now();
      if (this.mode === 'sleep') {
        this.wake();
        return;
      }
      if (this.stance === 'peek') {
        if (this.peekSide === 'top') {
          this.unpeek();
          return;
        }
        this.unpeek({ shy: true });
        return;
      }
      down = { x: e.clientX, y: e.clientY, pos: { ...this.pos } };
      lastDragPos = { x: e.clientX, y: e.clientY };
      shakeDistance = 0;
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse = { x: e.clientX, y: e.clientY };
      if (this.mode === 'sleep') {
        const d = Math.hypot(e.clientX - this.pos.x, e.clientY - this.pos.y);
        if (d < 140) {
          this.lastUserInteraction = performance.now();
          this.wake({ announce: false });
        }
      }

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
