// Pose-to-pose exposure sheets for 2B (src/renderer/js/acting.js)
// Implements stances and animations mapped to Semantic Action Slots:
// - stand, sit, walk, glide (Pod Glide), work (vigilant crossed arms), fall
// - inspect_katana, pet_pod, adjust_visor (idle_quirk & companion_interact)
// - katana_slash (poke_annoyed)
// - victory_sheathe (victory)
// - bunker_out (stow)

export const SHEET_FPS = 12;

const rep = (n, keys) => Array.from({ length: n }, () => keys).flat();

export const NEUTRAL = {
  head: 0, hair: 0, skirt: 0, tilt: 0, bob: 0, sx: 1, sy: 1,
  armL: 0, armR: 0, longL: 1, longR: 1,
  smear: [0, 0], echo: [0, 0], kickL: 0, kickR: 0,
  pose: 'stand',
};

export const ACTS = {
  // ---- Looping Stances ----

  stand: {
    loop: true,
    keys: [
      [6, { bob: 0, hair: -1.6, skirt: -1.8, arms: 0.03 }],
      [4, { bob: -1, hair: 0, skirt: 0, arms: 0 }],
      [6, { bob: -2, hair: 1.6, skirt: 1.8, arms: -0.03 }],
      [4, { bob: -1, hair: 0, skirt: 0, arms: 0 }],
    ],
  },

  // Sitting on a window top frame (2b-sit.png): hands planted on the ledge, boots kicking one after the other like Capri
  sit: {
    loop: true,
    keys: [
      [5, { kickL: 0.18, kickR: -0.04, hair: -1.4, arms: 0 }],
      [2, { kickL: 0.06, kickR: 0.06, arms: 0 }],
      [5, { kickL: -0.04, kickR: 0.18, hair: 1.4, arms: 0 }],
      [2, { kickL: 0.06, kickR: 0.06, arms: 0 }],
      [5, { kickL: 0.18, kickR: -0.04, hair: -1.4, arms: 0 }],
      [2, { kickL: 0.06, kickR: 0.06, arms: 0 }],
      [5, { kickL: -0.04, kickR: 0.18, hair: 1.4, arms: 0 }],
      [10, { kickL: 0.03, kickR: 0.03, head: 0.08, arms: 0 }],
    ],
  },

  // Walking along the top border of a window before sitting down
  walk: {
    loop: true,
    fps: 24,
    keys: [
      [3, { bob: -3, kickL: 0.26, kickR: -0.2, armL: -0.22, armR: 0.22, skirt: 2.5 }, 'step'],
      [3, { bob: 0, kickL: 0.05, kickR: 0.05, armL: 0, armR: 0, skirt: 0 }],
      [3, { bob: -3, kickL: -0.2, kickR: 0.26, armL: 0.22, armR: -0.22, skirt: -2.5 }, 'step'],
      [3, { bob: 0, kickL: 0.05, kickR: 0.05, armL: 0, armR: 0, skirt: 0 }],
    ],
  },

  // Pod Glide (Slot: traverse & Wall Jump Phase 3) — 2B holds onto Pod 042's handles with raised arms,
  // floating and swaying naturally in the wind stream with realistic leg and dress physics, zero stiff board tilt.
  glide: {
    loop: true,
    fps: 24,
    keys: [
      [3, { armL: 1.92, armR: 1.84, longL: 1.10, longR: 1.10, head: 0.05, hair: -5.2, skirt: -6.8, kickL: -0.16, kickR: -0.12, bob: -2, sy: 1.02, sx: 0.99 }],
      [3, { armL: 1.95, armR: 1.86, longL: 1.12, longR: 1.12, head: 0.07, hair: -7.8, skirt: -9.5, kickL: -0.22, kickR: -0.16, bob: -4, sy: 1.03, sx: 0.985 }],
      [3, { armL: 1.97, armR: 1.88, longL: 1.13, longR: 1.13, head: 0.08, hair: -9.4, skirt: -11.2, kickL: -0.28, kickR: -0.21, bob: -5, sy: 1.03, sx: 0.985 }],
      [3, { armL: 1.95, armR: 1.87, longL: 1.12, longR: 1.12, head: 0.07, hair: -8.0, skirt: -9.8, kickL: -0.24, kickR: -0.24, bob: -4, sy: 1.02, sx: 0.99 }],
      [3, { armL: 1.93, armR: 1.85, longL: 1.11, longR: 1.11, head: 0.05, hair: -6.4, skirt: -7.6, kickL: -0.18, kickR: -0.18, bob: -2, sy: 1.015, sx: 0.995 }],
      [3, { armL: 1.91, armR: 1.83, longL: 1.09, longR: 1.09, head: 0.04, hair: -5.0, skirt: -6.2, kickL: -0.14, kickR: -0.13, bob: -1, sy: 1.01, sx: 0.995 }],
    ],
  },

  // Vigilant stance while Pod 042 scans windows/runs tools (Slot: tool_work)
  work: {
    loop: true,
    keys: [
      [8, { armL: -0.52, armR: -0.52, head: 0.05, hair: -1.5, skirt: -1.2 }],
      [8, { armL: -0.52, armR: -0.52, head: 0.08, hair: 1.5, skirt: 1.2 }],
    ],
  },

  // Falling with gravity when a window closes/minimizes
  fall: {
    loop: true,
    fps: 24,
    keys: [
      [2, { sy: 1.08, sx: 0.94, hair: -6.0, skirt: -7.5, armL: 0.95, armR: 0.75, kickL: 0.2, kickR: -0.1 }],
      [2, { sy: 1.06, sx: 0.95, hair: 6.0, skirt: 7.5, armL: 0.75, armR: 0.95, kickL: -0.1, kickR: 0.2 }],
    ],
  },

  // Ceiling Hang stance with dedicated 2b-ceiling sprite (hanging upside down)
  ceiling: {
    loop: true,
    keys: [
      [10, { pose: 'ceiling', head: 0, bob: 0 }],
      [8,  { pose: 'ceiling', head: 0.04, bob: -1 }],
      [10, { pose: 'ceiling', head: -0.02, bob: 0 }],
    ],
  },

  // Peeking from screen edge with dedicated 2b-peek sprite
  peek: {
    loop: true,
    keys: [
      [8, { pose: 'peek', head: 0.04, hair: -0.8, bob: 0 }],
      [6, { pose: 'peek', head: 0.10, hair: 0.6, bob: -1 }],
      [8, { pose: 'peek', head: 0.06, hair: -0.4, bob: 0 }],
    ],
  },

  // Tactical standby / sleep mode with dedicated 2b-sleep sprite
  sleep: {
    loop: true,
    keys: [
      [12, { pose: 'sleep', head: 0.12, bob: 0, hair: 0.3, skirt: 0.2 }],
      [14, { pose: 'sleep', head: 0.16, bob: 1.4, hair: 0.6, skirt: 0.4 }],
      [10, { pose: 'sleep', head: 0.13, bob: 0.5, hair: 0.2, skirt: 0.1 }],
    ],
  },

  // Intermittent nodding / dozing while in standby
  doze: {
    priority: 2,
    keys: [
      [10, { pose: 'sleep', head: 0.18, bob: 1.5 }],
      [4,  { pose: 'sleep', head: 0.36, bob: 3.5 }],
      [3,  { pose: 'sleep', head: 0.08, bob: -1.0 }],
      [8,  { pose: 'sleep', head: 0.14, bob: 0 }],
    ],
  },

  // Infiltration dive through digital window portal (Slot: window_breach)
  dive: {
    priority: 3,
    fps: 24,
    keys: [
      [3, { bob: 4, head: -0.1, armL: -0.3, armR: -0.3, sx: 1.06, sy: 0.92 }],
      [2, { bob: -8, head: 0.2, armL: 1.4, armR: 1.4, sx: 0.92, sy: 1.15, smear: [0, -12] }],
      [4, { bob: -18, head: 0.4, armL: 2.1, armR: 2.1, sx: 0.82, sy: 1.28, smear: [0, -24] }],
    ],
  },

  // Acrobatic wall-jump spin off screen borders (Slot: wall_jump_glide)
  wall_spin: {
    priority: 3,
    fps: 24,
    keys: [
      [2, { bob: 2, tilt: -15, kickL: -0.4, kickR: 0.3, armL: -0.8, armR: 0.8, smear: [-8, -6] }],
      [2, { bob: -12, tilt: 60, kickL: 0.5, kickR: -0.4, armL: 1.2, armR: -1.2, smear: [12, -15], echo: [8, 4] }],
      [3, { bob: -20, tilt: 180, kickL: -0.2, kickR: 0.2, armL: 1.8, armR: 1.8, smear: [18, -12], echo: [14, 6] }],
      [2, { bob: -12, tilt: 290, kickL: 0.3, kickR: -0.2, armL: 1.9, armR: 1.8, smear: [10, -6] }],
      [2, { bob: -4, tilt: 0, kickL: 0, kickR: 0, armL: 1.95, armR: 1.85 }],
    ],
  },

  // Looking up and reaching hand toward the YoRHa Bunker Satellite (Slot: bunker_uplink)
  gaze: {
    priority: 2,
    keys: [
      [6, { head: -0.32, armR: 0.85, longR: 1.1, hair: 1.2, bob: -1 }],
      [14, { head: -0.40, armR: 1.15, longR: 1.18, hair: 1.8, bob: -2 }],
      [6, { head: -0.34, armR: 0.95, longR: 1.12, hair: 1.4, bob: -1 }],
    ],
  },

  // ---- One-Shot Acts ----

  talk: {
    priority: 0,
    keys: rep(2, [[3, { head: 0.04 }], [3, { head: 0 }]]),
  },

  plop: {
    priority: 3,
    fps: 24,
    keys: [
      [2, { sy: 0.92, sx: 1.05, kickL: 0.22, kickR: 0.22, arms: 0 }, 'cloth'],
      [2, { sy: 1.02, sx: 0.99, kickL: 0.08, kickR: 0.08, arms: 0 }],
      [1, {}],
    ],
  },

  land: {
    priority: 3,
    fps: 24,
    keys: [
      [2, { sy: 0.78, sx: 1.16, bob: 5, skirt: 4.5, arms: -0.35 }],
      [2, { sy: 0.92, sx: 1.04, bob: 2, arms: -0.12 }],
      [2, { sy: 1.03, sx: 0.98, arms: 0.06 }],
      [1, {}],
    ],
  },

  // Slot: idle_quirk (1) — Summon and inspect Virtuous Contract katana
  inspect_katana: {
    priority: 2,
    directional: true,
    fps: 24,
    keys: [
      [3, { head: -0.06, armR: 0.55, armL: -0.12, bob: -1 }, 'weapon_summon'],
      [6, { head: 0.12, armR: 1.15, armL: 0.65, longL: 1.05, skirt: 1.8, bob: 0 }],
      [10, { head: 0.16, armR: 1.22, armL: 0.88, longL: 1.08, hair: 1.5, skirt: 1.2, bob: -1 }, 'weapon_shine'],
      [6, { head: 0.08, armR: 0.95, armL: 0.45, longL: 1.02, bob: 0 }],
      [4, { head: -0.04, armR: 0.35, armL: 0.05, bob: 1, tilt: -3 }, 'weapon_return'],
      [2, { arms: 0, tilt: 0 }],
    ],
  },

  // Slot: idle_quirk (2) & companion_interact — Pet Pod 042 affectionately as it hovers right beside her hand
  pet_pod: {
    priority: 2,
    directional: true,
    keys: [
      [3, { head: 0.08, armR: 0.52, longR: 1.02, armL: 0.02 }],
      [4, { head: 0.12, armR: 0.88, longR: 1.04, skirt: 1.2 }, 'pod_chirp'],
      [3, { head: 0.10, armR: 0.72, longR: 1.03, hair: 1.0 }],
      [4, { head: 0.14, armR: 0.92, longR: 1.05, skirt: -1.0 }, 'pod_hearts'],
      [3, { head: 0.10, armR: 0.74, longR: 1.03, hair: -1.0 }],
      [4, { head: 0.13, armR: 0.88, longR: 1.04 }],
      [3, { head: 0.05, armR: 0.38, longR: 1.0 }],
      [1, {}],
    ],
  },

  // Slot: idle_quirk (3) — Adjust black combat visor & look around
  adjust_visor: {
    priority: 1,
    keys: [
      [2, { head: 0.08, armL: 1.35, longL: 1.05 }, 'cloth'],
      [6, { head: 0.12, armL: 1.48, longL: 1.08 }],
      [4, { head: -0.1, armL: 1.42, longL: 1.06 }],
      [2, { head: 0, armL: 0.5 }],
      [1, {}],
    ],
  },

  // Slot: poke_annoyed — Fast Virtuous Contract katana slash at cursor + cut-in
  katana_slash: {
    priority: 4,
    fps: 24,
    directional: true,
    keys: [
      [2, { sy: 0.9, sx: 1.06, bob: 4, armR: -0.45, head: -0.08 }, 'slash_cutin'],
      [1, { sy: 1.12, sx: 0.9, bob: -6, armR: 1.65, longR: 1.45, smear: [-14, 0], echo: [10, 0] }, 'slash_strike'],
      [4, { bob: -4, armR: 1.42, longR: 1.35, head: 0.14, skirt: 5.0 }],
      [5, { bob: -2, armR: 1.1, longR: 1.2, head: 0.12 }],
      [3, { armR: 0.35, head: 0.04 }, 'weapon_return'],
      [1, {}],
    ],
  },

  // Slot: victory — Acrobatic aerial somersault, crescent slash, and mid-air blade twirl sheathe
  victory_sheathe: {
    priority: 4,
    fps: 24,
    directional: true,
    keys: [
      // 1. Preparation crouch before leap
      [2, { sy: 0.86, sx: 1.08, bob: 8, arms: -0.3, skirt: -2.0 }],
      // 2. Acrobatic aerial somersault with 2b-acrobat-spin texture
      [3, { pose: 'spin', sy: 1.06, sx: 1.0, bob: -24, tilt: 80, smear: [12, -18], echo: [10, 6] }, 'victory_spin'],
      [3, { pose: 'spin', sy: 1.06, sx: 1.0, bob: -32, tilt: 220, smear: [18, -14], echo: [16, 8] }],
      [2, { pose: 'spin', sy: 1.02, sx: 1.0, bob: -16, tilt: 340, smear: [8, -8] }],
      // 3. Crisp landing in low combat stance with energy slash
      [4, { pose: 'stand', sy: 0.90, sx: 1.08, bob: 10, armR: 1.7, armL: -0.4, tilt: 0, skirt: 4.5, smear: [14, 0] }, 'victory_flick'],
      // 4. Elegant blade flick & twirl
      [5, { bob: 4, armR: 1.45, armL: -0.2, head: 0.06, skirt: 2.0 }],
      // 5. Back holster lock with hand resting on hilt
      [4, { bob: -1, armR: 0.72, armL: 0.1, head: -0.06, sy: 0.96, sx: 1.03 }, 'victory_lock'],
      // 6. Composed standing pose, hand on hip, looking at operator
      [8, { bob: 0, armR: 0.22, armL: 0.18, head: 0.05, skirt: 0.5 }, 'speak'],
      [3, { arms: 0 }],
    ],
  },

  // Slot: stow — Prepare for Bunker particle transport
  bunker_out: {
    priority: 3,
    fps: 24,
    keys: [
      [3, { head: -0.08, arms: -0.15 }],
      [3, { head: 0.05, arms: -0.35, sy: 1.04, sx: 0.96 }],
    ],
  },
};

export class Player {
  constructor(name, { dir = 0, reach = 1, at = performance.now() } = {}) {
    this.name = name;
    this.act = ACTS[name] || ACTS.stand;
    this.dir = dir;
    this.reach = reach;
    this.start = at;
    this.total = this.act.keys.reduce((n, [hold]) => n + hold, 0);
  }

  get priority() {
    return this.act.priority ?? 0;
  }

  sample(now) {
    const fps = this.act.fps || SHEET_FPS;
    let f = Math.floor((now - this.start) / (1000 / fps));
    if (f >= this.total) {
      if (!this.act.loop) return null;
      f %= this.total;
    }
    const { keys } = this.act;
    for (let i = 0; i < keys.length; i++) {
      const [hold, pose, cue] = keys[i];
      if (f < hold) return { pose, index: i, cue };
      f -= hold;
    }
    return null;
  }

  resolve(pose, facing) {
    const out = { ...pose };
    const lean = this.act.directional && this.dir ? this.dir * facing : 0;
    if (lean) {
      if (pose.head !== undefined) out.head = pose.head * lean;
      if (pose.tilt !== undefined) out.tilt = pose.tilt * this.dir;
      if (pose.smear) out.smear = [pose.smear[0] * lean, pose.smear[1]];
      if (pose.echo) out.echo = [pose.echo[0] * lean, pose.echo[1]];
    }
    if (pose.arms !== undefined) {
      out.armL = pose.arms;
      out.armR = pose.arms;
    }
    delete out.arms;
    return out;
  }
}
