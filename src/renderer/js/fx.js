// YoRHa Visual Effects, Floating Katana Halo, and Pod 042 Companion Renderer (src/renderer/js/fx.js)

import { rand, pick, lerp, clamp } from './util.js';

export const YORHA_COLORS = {
  beige: '#dad4bb',
  gold: '#d8b868',
  white: '#f7f5eb',
  ink: '#1a1917',
  alert: '#cd4439',
  cyan: '#a8e4dc',
};

const FRAME_MS = 1000 / 24;

export class WeaponHaloRenderer {
  constructor(canvas, katanaImg) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.katanaImg = katanaImg;
    this.scale = 0.62;
    // mode: 'back' (floating behind 2B), 'inspect' (held in front), 'slash' (striking), 'sheathe' (spinning into back), 'hidden'
    this.mode = 'back';
    this.modeTime = 0;
  }

  resize(width, height, scale) {
    this.scale = scale;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setMode(mode) {
    this.mode = mode;
    this.modeTime = performance.now();
  }

  draw(now, { facing = 1, alpha = 1, sit = 0, glide = false } = {}) {
    const { ctx, canvas } = this;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    if (alpha <= 0.05 || this.mode === 'hidden' || glide) return;

    const s = this.scale;
    const cx = w * 0.5 - 10 * s * facing;
    const cy = h * 0.36 + sit * 14 * s;
    const t = now * 0.001;

    ctx.save();
    ctx.globalAlpha = alpha;

    // 1. Draw YoRHa geometric golden/white weapon levitation ring (weapon-ring)
    const ringRadius = 54 * s;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.36); // Tilted 3D perspective ellipse behind her back
    ctx.rotate(t * 0.9);

    ctx.strokeStyle = 'rgba(216, 184, 104, 0.72)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(247, 245, 235, 0.85)';
    ctx.lineWidth = 1.0;
    ctx.setLineDash([8 * s, 5 * s]);
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius * 0.84, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 8 geometric YoRHa diamond nodes around the ring
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rx = Math.cos(a) * ringRadius;
      const ry = Math.sin(a) * ringRadius;
      ctx.fillStyle = i % 2 === 0 ? YORHA_COLORS.white : YORHA_COLORS.gold;
      ctx.fillRect(rx - 2.2, ry - 2.2, 4.4, 4.4);
    }
    ctx.restore();

    // 2. Draw Virtuous Treaty Greatsword (manodoble) sprite floating diagonally behind 2B
    if (this.katanaImg) {
      ctx.save();
      const hoverY = Math.sin(t * 2.4) * 4 * s;
      let kx = cx + 4 * s * facing;
      let ky = cy + 16 * s + hoverY;
      let angle = -0.82 * facing;

      if (this.mode === 'inspect') {
        const dt = Math.min(1, (now - this.modeTime) / 300);
        kx = cx + 36 * s * facing * dt;
        ky = cy - 6 * s * dt;
        angle = (-0.28 + Math.sin(t * 5) * 0.06) * facing;
      } else if (this.mode === 'sheathe') {
        const dt = (now - this.modeTime) * 0.016;
        angle = dt * 2.4 * facing;
        ky = cy - 18 * s;
      }

      ctx.translate(kx, ky);
      ctx.rotate(angle);
      if (facing < 0) ctx.scale(-1, 1);
      const kw = 305 * s;
      const kh = 86 * s;
      ctx.drawImage(this.katanaImg, -kw * 0.45, -kh * 0.5, kw, kh);
      ctx.restore();
    }

    ctx.restore();
  }
}

export class PodCompanion {
  constructor(rootEl, canvas, podImg) {
    this.root = rootEl;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.podImg = podImg;
    this.scale = 0.62;
    this.pos = { x: 200, y: 200 };
    this.target = { x: 200, y: 200 };
    this.facing = 1;
    // states: 'follow' (floating near 2B), 'carry' (carrying 2B in Pod Glide), 'sentry' (stowed corner guard),
    //         'alert' (flying next to cursor blinking red/amber), 'scan' (projecting laser scanner)
    this.state = 'follow';
    this.happyUntil = 0;
    this.alertBlink = false;
    this.pointer = null;
  }

  resize(scale) {
    this.scale = scale;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(135 * scale);
    const h = Math.round(155 * scale);
    this.w = w;
    this.h = h;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  triggerHappy(durationMs = 1800) {
    this.happyUntil = performance.now() + durationMs;
  }

  contains(x, y) {
    const halfW = (this.w || 80) * 0.48;
    const halfH = (this.h || 90) * 0.48;
    return Math.abs(x - this.pos.x) <= halfW && Math.abs(y - this.pos.y) <= halfH;
  }

  updateAndDraw(now, charPos, charFacing, view, mouse) {
    const s = this.scale;
    const t = now * 0.001;

    if (this.state === 'sentry') {
      // Corner sentry mode when 2B is in the Bunker (Ctrl+Alt+C)
      this.target.x = 74;
      this.target.y = view.h - 92 + Math.sin(t * 2.5) * 6;
      this.facing = 1;
    } else if (this.state === 'carry') {
      // Directly above 2B's raised hands during Pod Glide
      this.target.x = charPos.x;
      this.target.y = charPos.y - 455 * s;
      this.pos.x = this.target.x;
      this.pos.y = this.target.y;
      this.facing = charFacing;
    } else if (this.state === 'pet') {
      // Hovering affectionately right under 2B's outstretched right hand (which is on her -charFacing side)
      // leaning in and bobbing with her patting motion
      const handSide = -charFacing;
      const patBob = Math.sin(now * 0.014) * 5 * s;
      const nuzzleX = Math.cos(now * 0.011) * 4 * s;
      this.target.x = clamp(charPos.x + handSide * (92 * s) + nuzzleX, 55, view.w - 55);
      this.target.y = clamp(charPos.y - 252 * s + patBob, 65, view.h - 65);
      this.facing = charFacing;
    } else if (this.state === 'alert' && mouse) {
      const side = mouse.x > view.w * 0.5 ? -95 : 95;
      this.target.x = clamp(mouse.x + side, 70, view.w - 70);
      this.target.y = clamp(mouse.y - 30, 80, view.h - 80);
      this.facing = mouse.x >= this.pos.x ? 1 : -1;
    } else {
      // Floating loyally beside 2B's shoulder
      const orbitX = charPos.x - charFacing * (108 * s) + Math.cos(t * 1.6) * 8 * s;
      const orbitY = charPos.y - 330 * s + Math.sin(t * 2.3) * 9 * s;
      this.target.x = clamp(orbitX, 55, view.w - 55);
      this.target.y = clamp(orbitY, 65, view.h - 65);
      this.facing = mouse ? (mouse.x >= this.pos.x ? 1 : -1) : charFacing;
    }

    const followRate = this.state === 'carry' ? 1.0 : this.state === 'pet' ? 0.24 : 0.14;
    this.pos.x = lerp(this.pos.x, this.target.x, followRate);
    this.pos.y = lerp(this.pos.y, this.target.y, followRate);

    const left = Math.round(this.pos.x - this.w * 0.5);
    const top = Math.round(this.pos.y - this.h * 0.5);
    this.root.style.transform = `translate3d(${left}px, ${top}px, 0)`;

    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);

    const isHappy = now < this.happyUntil || this.state === 'pet';
    const tilt = this.state === 'pet'
      ? -0.14 * this.facing + Math.sin(now * 0.018) * 0.14
      : isHappy
        ? Math.sin(now * 0.025) * 0.22
        : this.state === 'carry'
          ? 0.08 * this.facing
          : Math.sin(t * 1.8) * 0.05;
    ctx.rotate(tilt);
    if (this.facing < 0) ctx.scale(-1, 1);

    // Subtle propulsion thruster ring beneath Pod 042
    ctx.save();
    ctx.strokeStyle = this.state === 'alert' ? 'rgba(205, 68, 57, 0.7)' : 'rgba(218, 212, 187, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.34, 22 * s * (0.85 + 0.15 * Math.sin(t * 16)), 5 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (this.podImg) {
      ctx.drawImage(this.podImg, -w * 0.46, -h * 0.46, w * 0.92, h * 0.92);
    }

    // Glowing camera lens pulse (amber normally, crimson/amber blinking on alert_confirm)
    const lensX = -w * 0.14;
    const lensY = -h * 0.1;
    const isAlert = this.state === 'alert' && Math.floor(now / 160) % 2 === 0;
    const glowColor = isAlert ? 'rgba(255, 68, 54, 0.85)' : isHappy ? 'rgba(255, 230, 130, 0.9)' : 'rgba(235, 180, 75, 0.55)';
    const grad = ctx.createRadialGradient(lensX, lensY, 1, lensX, lensY, 16 * s);
    grad.addColorStop(0, glowColor);
    grad.addColorStop(1, 'rgba(235, 180, 75, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lensX, lensY, 16 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Status tag when 2B is stowed in the Bunker
    if (this.state === 'sentry') {
      ctx.fillStyle = 'rgba(26, 25, 23, 0.86)';
      ctx.fillRect(4, h - 18, w - 8, 15);
      ctx.strokeStyle = YORHA_COLORS.beige;
      ctx.strokeRect(4, h - 18, w - 8, 15);
      ctx.fillStyle = YORHA_COLORS.beige;
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('POD 042 [BÚNKER]', w * 0.5, h - 7);
    }
  }
}

export class FxLayer {
  constructor(canvas, { cutins = {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cutins = cutins;
    this.items = [];
    this.running = false;
    this.last = 0;
  }

  resize(width, height) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  add(item) {
    item.born = performance.now();
    this.items.push(item);
    if (!this.running) {
      this.running = true;
      requestAnimationFrame((t) => this.frame(t));
    }
    return item;
  }

  // Monochrome white/black YoRHa digital particles (used in Bunker transport, jumps, and landings)
  burst(x, y, { count = 20, power = 1, spread = 60, monochrome = false } = {}) {
    const palette = monochrome
      ? ['#f7f5eb', '#1a1917', '#dad4bb', '#2b2926']
      : ['#f7f5eb', '#dad4bb', '#d8b868', '#1a1917'];
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(140, 480) * power;
      this.add({
        type: 'particle',
        life: rand(260, 560),
        x: x + rand(-spread, spread) * 0.5,
        y: y + rand(-spread, spread) * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        size: rand(4, 11),
        rot: rand(0, Math.PI),
        vr: rand(-6, 6),
        color: pick(palette),
      });
    }
  }

  // Bunker vertical monochrome particle beam (Slot: stow / unstow)
  bunkerBeam(x, bottomY, { life = 520, width = 58 } = {}) {
    this.burst(x, bottomY - 90, { count: 32, power: 1.2, spread: 70, monochrome: true });
    return this.add({ type: 'bunker_beam', life, x, bottomY, width });
  }

  // Virtuous Contract Katana slash arc across the target point (Slot: poke_annoyed & victory)
  slashArc(fromX, fromY, toX, toY, { life = 340 } = {}) {
    this.burst(toX, toY, { count: 18, power: 1.1, spread: 36 });
    return this.add({ type: 'slash_arc', life, fromX, fromY, toX, toY });
  }

  // Pod 042 Laser Scanner sweep over a window or area (Slot: tool_work)
  laserScan(podPosFn, targetRect, { life = 1600 } = {}) {
    return this.add({ type: 'laser_scan', life, podPosFn, targetRect });
  }

  // Affectionate YoRHa geometric hearts/diamonds rising from Pod 042 when petted (Slot: companion_interact)
  podAffection(x, y) {
    for (let i = 0; i < 6; i++) {
      this.add({
        type: 'affection',
        life: rand(650, 1000),
        x: x + rand(-28, 28),
        y: y - rand(10, 26),
        vy: -rand(45, 80),
        symbol: i % 2 === 0 ? '❖' : '♥',
      });
    }
  }

  // YoRHa ring pulse
  ring(x, y, { radius = 75, life = 320, color = YORHA_COLORS.beige } = {}) {
    return this.add({ type: 'ring', life, x, y, radius, color });
  }

  // Anime Cut-in banner (cutin-slash.png / cutin-eyes.png)
  cutin(x, y, dir = 1, { kind = 'slash', life = 820 } = {}) {
    const image = this.cutins[kind] || this.cutins.slash;
    if (!image) return Promise.resolve();
    return new Promise((done) => this.add({ type: 'cutin', life, x, y, dir, image, done }));
  }

  // YoRHa Hacking Window Breach effect (Slot: window_breach)
  windowBreach(targetRect, { life = 1800 } = {}) {
    return new Promise((done) => this.add({ type: 'window_breach', life, targetRect, done }));
  }

  // YoRHa Orbital Bunker Satellite Uplink (Slot: bunker_uplink)
  satelliteUplink({ satelliteImg, podPosFn, life = 7500 } = {}) {
    return new Promise((done) => this.add({ type: 'satellite_uplink', life, satelliteImg, podPosFn, done }));
  }

  // Tactical Standby Diagnostic Hologram (Slot: sleep_standby)
  diagnosticHologram(podPosFn, charPosFn, { life = 4200 } = {}) {
    return new Promise((done) => this.add({ type: 'diagnostic_hologram', life, podPosFn, charPosFn, done }));
  }

  frame(now) {
    if (now - this.last < FRAME_MS - 2) {
      requestAnimationFrame((t) => this.frame(t));
      return;
    }
    const dt = Math.min(0.08, (now - (this.last || now)) / 1000);
    this.last = now;

    const dpr = window.devicePixelRatio || 1;
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

    this.items = this.items.filter((it) => {
      const alive = now - it.born < it.life;
      if (!alive) it.done?.();
      return alive;
    });

    for (const it of this.items) {
      this.drawItem(it, (now - it.born) / it.life, dt, now);
    }

    if (this.items.length) {
      requestAnimationFrame((t) => this.frame(t));
    } else {
      this.running = false;
      this.last = 0;
    }
  }

  drawItem(it, t, dt) {
    const { ctx } = this;
    switch (it.type) {
      case 'particle': {
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        it.vx *= 0.9;
        it.vy *= 0.9;
        it.rot += it.vr * dt;
        const alpha = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(it.x, it.y);
        ctx.rotate(it.rot);
        ctx.fillStyle = it.color;
        ctx.fillRect(-it.size * 0.5, -it.size * 0.5, it.size, it.size);
        ctx.strokeStyle = YORHA_COLORS.beige;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(-it.size * 0.5, -it.size * 0.5, it.size, it.size);
        ctx.restore();
        break;
      }

      case 'bunker_beam': {
        const w = it.width * (1 - t * 0.75);
        ctx.save();
        ctx.globalAlpha = 1 - t * 0.8;
        ctx.fillStyle = 'rgba(26, 25, 23, 0.78)';
        ctx.fillRect(it.x - w * 0.6, 0, w * 1.2, it.bottomY);
        ctx.fillStyle = 'rgba(247, 245, 235, 0.92)';
        ctx.fillRect(it.x - w * 0.28, 0, w * 0.56, it.bottomY);
        // Binary/geometric glitch bars along the Bunker beam
        for (let i = 0; i < 9; i++) {
          const by = rand(20, it.bottomY - 20);
          const bw = rand(w * 0.8, w * 2.1);
          ctx.fillStyle = i % 2 === 0 ? '#f7f5eb' : '#1a1917';
          ctx.fillRect(it.x - bw * 0.5, by, bw, rand(2, 6));
        }
        ctx.restore();
        break;
      }

      case 'slash_arc': {
        const alpha = 1 - t;
        ctx.save();
        ctx.globalAlpha = alpha;
        const midX = (it.fromX + it.toX) * 0.5 + (it.fromY - it.toY) * 0.25;
        const midY = (it.fromY + it.toY) * 0.5 - Math.abs(it.toX - it.fromX) * 0.22;

        // Outer golden glow
        ctx.strokeStyle = YORHA_COLORS.gold;
        ctx.lineWidth = 10 * (1 - t * 0.6);
        ctx.beginPath();
        ctx.moveTo(it.fromX, it.fromY);
        ctx.quadraticCurveTo(midX, midY, it.toX, it.toY);
        ctx.stroke();

        // Crisp white blade core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4 * (1 - t * 0.5);
        ctx.beginPath();
        ctx.moveTo(it.fromX, it.fromY);
        ctx.quadraticCurveTo(midX, midY, it.toX, it.toY);
        ctx.stroke();

        // Cross impact flash at cursor
        const r = 28 * (1 - t * 0.4);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(it.toX - r, it.toY - r);
        ctx.lineTo(it.toX + r, it.toY + r);
        ctx.moveTo(it.toX + r, it.toY - r);
        ctx.lineTo(it.toX - r, it.toY + r);
        ctx.stroke();
        ctx.restore();
        break;
      }

      case 'laser_scan': {
        const pod = it.podPosFn();
        const r = it.targetRect;
        const scanX = r.x + r.w * (0.15 + 0.7 * (0.5 + 0.5 * Math.sin(t * Math.PI * 3)));
        const scanY = r.y;

        ctx.save();
        // Laser cone from Pod 042 lens to the window ledge
        const grad = ctx.createLinearGradient(pod.x, pod.y, scanX, scanY);
        grad.addColorStop(0, 'rgba(216, 184, 104, 0.78)');
        grad.addColorStop(1, 'rgba(218, 212, 187, 0.12)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(pod.x, pod.y);
        ctx.lineTo(scanX - 38, scanY + 24);
        ctx.lineTo(scanX + 38, scanY + 24);
        ctx.closePath();
        ctx.fill();

        // Central laser beam
        ctx.strokeStyle = YORHA_COLORS.white;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pod.x, pod.y);
        ctx.lineTo(scanX, scanY);
        ctx.stroke();

        // YoRHa target reticle at scan point
        ctx.strokeStyle = YORHA_COLORS.gold;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(scanX - 14, scanY - 14, 28, 28);
        ctx.restore();
        break;
      }

      case 'affection': {
        it.y += it.vy * dt;
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = YORHA_COLORS.gold;
        ctx.font = '700 15px "Chakra Petch", sans-serif';
        ctx.fillText(it.symbol, it.x, it.y);
        ctx.restore();
        break;
      }

      case 'ring': {
        const r = it.radius * (0.25 + 0.75 * t);
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = it.color;
        ctx.lineWidth = 2.5 * (1 - t);
        ctx.beginPath();
        ctx.arc(it.x, it.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        break;
      }

      case 'cutin': {
        const w = 310, h = 156;
        const enter = Math.min(1, t / 0.15);
        const exit = t > 0.82 ? (t - 0.82) / 0.18 : 0;
        const alpha = 1 - exit;
        const slide = (1 - enter) * -45 * it.dir;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(it.x + slide, it.y);

        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(w, 0);
        ctx.lineTo(w - 16, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = YORHA_COLORS.ink;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = YORHA_COLORS.beige;
        ctx.stroke();

        ctx.clip();
        ctx.drawImage(it.image, 0, -20, w, h + 40);
        ctx.restore();
        break;
      }

      case 'window_breach': {
        const r = it.targetRect;
        const alpha = t < 0.8 ? 1 : (1 - t) / 0.2;
        ctx.save();
        ctx.globalAlpha = alpha;

        // Digital hacking border pulse along window rect
        ctx.strokeStyle = YORHA_COLORS.gold;
        ctx.lineWidth = 3;
        ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);

        ctx.strokeStyle = YORHA_COLORS.beige;
        ctx.lineWidth = 1;
        ctx.setLineDash([12, 8]);
        ctx.lineDashOffset = -t * 60;
        ctx.strokeRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12);
        ctx.setLineDash([]);

        // YoRHa Hacking Geometric Triangles around breach point
        const cx = r.x + r.w * 0.5;
        const cy = r.y;
        for (let i = 0; i < 7; i++) {
          const triAngle = (i / 7) * Math.PI * 2 + t * 4;
          const dist = 35 + t * 65 + (i % 2) * 20;
          const tx = cx + Math.cos(triAngle) * dist;
          const ty = cy + Math.sin(triAngle) * (dist * 0.45);
          const triSize = 10 + (i % 3) * 4;

          ctx.save();
          ctx.translate(tx, ty);
          ctx.rotate(triAngle + t * 6);
          ctx.fillStyle = i % 2 === 0 ? YORHA_COLORS.white : YORHA_COLORS.ink;
          ctx.strokeStyle = YORHA_COLORS.gold;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(0, -triSize);
          ctx.lineTo(triSize * 0.86, triSize * 0.5);
          ctx.lineTo(-triSize * 0.86, triSize * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // Scanline grid ripple
        const scanY = r.y + (r.h * (t * 2 % 1));
        ctx.fillStyle = 'rgba(216, 184, 104, 0.22)';
        ctx.fillRect(r.x, scanY - 3, r.w, 6);
        ctx.restore();
        break;
      }

      case 'satellite_uplink': {
        const viewW = this.canvas.width / (window.devicePixelRatio || 1);
        const satX = lerp(-60, viewW + 60, t);
        const satY = 52 + Math.sin(t * Math.PI * 4) * 6;
        const pod = it.podPosFn?.() || { x: viewW * 0.5, y: 350 };

        ctx.save();
        // 1. Draw YoRHa Bunker Space Station
        if (it.satelliteImg) {
          const satW = 110, satH = 55;
          ctx.drawImage(it.satelliteImg, satX - satW * 0.5, satY - satH * 0.5, satW, satH);
        }

        // Blinking beacon on satellite
        if (Math.sin(t * 24) > 0) {
          ctx.fillStyle = YORHA_COLORS.gold;
          ctx.beginPath();
          ctx.arc(satX, satY - 14, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2. High-speed upward data transmission beam from Pod 042 to Bunker
        if (t > 0.15 && t < 0.85) {
          const beamAlpha = Math.sin((t - 0.15) / 0.7 * Math.PI);
          ctx.globalAlpha = beamAlpha;

          // Outer beam
          const grad = ctx.createLinearGradient(pod.x, pod.y, satX, satY);
          grad.addColorStop(0, 'rgba(216, 184, 104, 0.85)');
          grad.addColorStop(1, 'rgba(247, 245, 235, 0.95)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(pod.x, pod.y);
          ctx.lineTo(satX, satY);
          ctx.stroke();

          // Ascending digital telemetry squares
          for (let i = 0; i < 6; i++) {
            const frac = ((t * 3.5 + i * 0.18) % 1);
            const px = lerp(pod.x, satX, frac);
            const py = lerp(pod.y, satY, frac);
            ctx.fillStyle = i % 2 === 0 ? YORHA_COLORS.gold : YORHA_COLORS.white;
            ctx.fillRect(px - 3, py - 3, 6, 6);
          }
        }
        ctx.restore();
        break;
      }

      case 'diagnostic_hologram': {
        const pod = it.podPosFn?.() || { x: 300, y: 200 };
        const char = it.charPosFn?.() || { x: 300, y: 350 };
        const alpha = t < 0.15 ? t / 0.15 : (t > 0.82 ? (1 - t) / 0.18 : 1);

        ctx.save();
        ctx.globalAlpha = alpha * 0.65;

        // Holographic conical projection from Pod lens down to 2B
        const coneGrad = ctx.createLinearGradient(pod.x, pod.y, char.x, char.y);
        coneGrad.addColorStop(0, 'rgba(216, 184, 104, 0.7)');
        coneGrad.addColorStop(1, 'rgba(218, 212, 187, 0.08)');
        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.moveTo(pod.x, pod.y);
        ctx.lineTo(char.x - 70, char.y);
        ctx.lineTo(char.x + 70, char.y);
        ctx.closePath();
        ctx.fill();

        // Concentric scanning rings at base
        const ringY = char.y - 10;
        ctx.strokeStyle = YORHA_COLORS.gold;
        ctx.lineWidth = 1.2;
        ctx.save();
        ctx.translate(char.x, ringY);
        ctx.scale(1, 0.35);
        ctx.beginPath();
        ctx.arc(0, 0, 50 + Math.sin(t * 12) * 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // YoRHa Diagnostic Text
        ctx.font = '700 9px "Chakra Petch", monospace';
        ctx.fillStyle = YORHA_COLORS.gold;
        ctx.fillText('STANDBY // 2B RECHARGE [100%]', char.x - 62, ringY - 24);
        ctx.restore();
        break;
      }
    }
  }
}
