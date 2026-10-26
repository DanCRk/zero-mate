'use strict';

/**
 * Generates real 44.1kHz 16-bit mono PCM .wav files for the NieR: Automata (2B + Pod 042) theme
 * in themes/nier-2b/sounds/.
 *
 * Acoustic palette inspired by YoRHa menu chimes, Pod 042 tactical scanner/propulsion,
 * Virtuous Contract katana metallic resonance, and Bunker digital transport.
 */

const fs = require('node:fs');
const path = require('node:path');

const SAMPLE_RATE = 44100;
const OUT_DIR = path.resolve(__dirname, '..', 'themes', 'nier-2b', 'sounds');

function writeWav(filename, samples) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);      // Subchunk1Size (PCM)
  buf.writeUInt16LE(1, 20);       // AudioFormat (1 = PCM)
  buf.writeUInt16LE(1, 22);       // NumChannels (1 = mono)
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // ByteRate
  buf.writeUInt16LE(2, 32);       // BlockAlign
  buf.writeUInt16LE(16, 34);      // BitsPerSample
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    // Soft clip with tanh
    const s = Math.tanh(samples[i] * 1.15);
    const val = Math.max(-32768, Math.min(32767, Math.round(s * 32767)));
    buf.writeInt16LE(val, 44 + i * 2);
  }

  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, buf);
  return { filename, bytes: buf.length, durationMs: Math.round((numSamples / SAMPLE_RATE) * 1000) };
}

function makeBuffer(durationSec) {
  return new Float32Array(Math.ceil(durationSec * SAMPLE_RATE));
}

function envADSR(t, a, d, s, r, total) {
  if (t < 0 || t > total) return 0;
  if (t < a) return t / Math.max(1e-5, a);
  if (t < a + d) return 1 - (1 - s) * ((t - a) / Math.max(1e-5, d));
  if (t < total - r) return s;
  return s * (1 - (t - (total - r)) / Math.max(1e-5, r));
}

function envExp(t, attack, decay) {
  if (t < 0) return 0;
  if (t < attack) return t / Math.max(1e-5, attack);
  return Math.exp(-(t - attack) / Math.max(1e-5, decay));
}

// Seeded PRNG for deterministic crisp sound generation
let seed = 42042;
function noise() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 0xFFFFFFFF) * 2 - 1;
}

// 1. ui-open.wav: Crystalline two-tone YoRHa menu chime (B5 -> F#6 with glassy overtones)
function genUiOpen() {
  const dur = 0.42;
  const buf = makeBuffer(dur);
  const notes = [
    { start: 0.0, f: 987.77, amp: 0.35, decay: 0.14 },  // B5
    { start: 0.055, f: 1479.98, amp: 0.42, decay: 0.22 }, // F#6
    { start: 0.055, f: 2959.96, amp: 0.15, decay: 0.12 }, // F#7 harmonic shimmer
  ];
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    let v = 0;
    for (const n of notes) {
      const dt = t - n.start;
      if (dt >= 0) {
        const e = envExp(dt, 0.004, n.decay);
        v += (Math.sin(2 * Math.PI * n.f * dt) + 0.25 * Math.sin(2 * Math.PI * (n.f * 2.002) * dt)) * e * n.amp;
      }
    }
    // Subtle initial mechanical click
    if (t < 0.008) v += noise() * envExp(t, 0.001, 0.002) * 0.25;
    buf[i] = v;
  }
  return buf;
}

// 2. ui-confirm.wav: Crisp YoRHa confirmation chord (F#5 + C#6 + A#6)
function genUiConfirm() {
  const dur = 0.38;
  const buf = makeBuffer(dur);
  const freqs = [739.99, 1108.73, 1864.66];
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    let v = 0;
    freqs.forEach((f, idx) => {
      const dt = t - idx * 0.022;
      if (dt >= 0) {
        const e = envExp(dt, 0.003, 0.14);
        v += (Math.sin(2 * Math.PI * f * dt) + 0.3 * Math.sin(2 * Math.PI * f * 2 * dt)) * e * 0.28;
      }
    });
    if (t < 0.006) v += noise() * (1 - t / 0.006) * 0.2;
    buf[i] = v;
  }
  return buf;
}

// 3. ui-cancel.wav: Descending two-tone YoRHa cancel sound
function genUiCancel() {
  const dur = 0.32;
  const buf = makeBuffer(dur);
  const notes = [
    { start: 0.0, f: 880.0, amp: 0.32, decay: 0.09 },
    { start: 0.06, f: 587.33, amp: 0.36, decay: 0.14 },
  ];
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    let v = 0;
    for (const n of notes) {
      const dt = t - n.start;
      if (dt >= 0) {
        const e = envExp(dt, 0.003, n.decay);
        v += Math.sin(2 * Math.PI * n.f * dt + 0.4 * Math.sin(2 * Math.PI * n.f * 2 * dt)) * e * n.amp;
      }
    }
    buf[i] = v;
  }
  return buf;
}

// 4. alert-permission.wav: Double tactical Pod alert pulse
function genAlertPermission() {
  const dur = 0.56;
  const buf = makeBuffer(dur);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    let v = 0;
    for (const pulseStart of [0.0, 0.24]) {
      const dt = t - pulseStart;
      if (dt >= 0 && dt < 0.2) {
        const f = dt < 0.09 ? 1174.66 : 880.0; // D6 -> A5 tactical alternation
        const e = envADSR(dt, 0.004, 0.03, 0.7, 0.04, 0.19);
        const sq = Math.sign(Math.sin(2 * Math.PI * f * dt)) * 0.35 + Math.sin(2 * Math.PI * f * dt) * 0.65;
        v += sq * e * 0.42;
      }
    }
    buf[i] = v;
  }
  return buf;
}

// 5. pod-scan.wav: Laser scanner frequency sweep with high-tech modulation
function genPodScan() {
  const dur = 0.65;
  const buf = makeBuffer(dur);
  let phase = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    const sweep = 620 + 1800 * Math.sin((t / dur) * Math.PI) + 180 * Math.sin(2 * Math.PI * 36 * t);
    phase += (2 * Math.PI * sweep) / SAMPLE_RATE;
    const e = envADSR(t, 0.02, 0.1, 0.75, 0.15, dur);
    const shimmer = Math.sin(phase) * 0.6 + Math.sin(phase * 1.5) * 0.25 + noise() * 0.06;
    buf[i] = shimmer * e * 0.38;
  }
  return buf;
}

// 6. pod-glide.wav: Aerodynamic Pod propulsion hum + soft mechanical servo
function genPodGlide() {
  const dur = 0.75;
  const buf = makeBuffer(dur);
  let lp = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    const e = envADSR(t, 0.06, 0.12, 0.7, 0.2, dur);
    const n = noise();
    lp = lp * 0.88 + n * 0.12; // Low-pass filtered air whoosh
    const hum = Math.sin(2 * Math.PI * (220 + 40 * Math.sin(2 * Math.PI * 6 * t)) * t) * 0.35
              + Math.sin(2 * Math.PI * 442 * t) * 0.2;
    buf[i] = (lp * 0.6 + hum * 0.45) * e * 0.5;
  }
  return buf;
}

// 7. pod-fire.wav: Rapid Pod tactical pulse burst
function genPodFire() {
  const dur = 0.36;
  const buf = makeBuffer(dur);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    let v = 0;
    for (const shot of [0.0, 0.11, 0.22]) {
      const dt = t - shot;
      if (dt >= 0 && dt < 0.1) {
        const f = 1600 * Math.exp(-dt * 24) + 140;
        const e = envExp(dt, 0.002, 0.035);
        v += (Math.sin(2 * Math.PI * f * dt) * 0.7 + noise() * 0.3) * e * 0.48;
      }
    }
    buf[i] = v;
  }
  return buf;
}

// 8. pod-happy-chirp.wav: Affectionate R2/Pod mechanical chirp when petted
function genPodHappyChirp() {
  const dur = 0.38;
  const buf = makeBuffer(dur);
  let phase = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    const f = t < 0.16
      ? 880 + (t / 0.16) * 640
      : 1320 + Math.sin((t - 0.16) * 45) * 220;
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    const e = envADSR(t, 0.008, 0.05, 0.8, 0.09, dur);
    buf[i] = (Math.sin(phase) * 0.75 + Math.sin(phase * 2) * 0.25) * e * 0.36;
  }
  return buf;
}

// 9. weapon-hum.wav: Virtuous Contract golden halo levitation resonance
function genWeaponHum() {
  const dur = 0.55;
  const buf = makeBuffer(dur);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    const e = envADSR(t, 0.04, 0.1, 0.75, 0.18, dur);
    const ring = Math.sin(2 * Math.PI * 528 * t) * 0.45
               + Math.sin(2 * Math.PI * 792 * t) * 0.3
               + Math.sin(2 * Math.PI * 1584 * t) * 0.18 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 14 * t));
    buf[i] = ring * e * 0.4;
  }
  return buf;
}

// 10. katana-slash.wav: Sharp metallic Virtuous Contract slash + air cut
function genKatanaSlash() {
  const dur = 0.34;
  const buf = makeBuffer(dur);
  let bp = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    const n = noise();
    bp = bp * 0.72 + n * 0.28;
    const whoosh = (n - bp * 0.5) * envExp(t, 0.006, 0.065);
    // High metallic ring
    const ring = (
      Math.sin(2 * Math.PI * 2480 * t) * 0.45 +
      Math.sin(2 * Math.PI * 3710 * t) * 0.35 +
      Math.sin(2 * Math.PI * 5120 * t) * 0.2
    ) * envExp(t, 0.002, 0.12);
    buf[i] = (whoosh * 0.65 + ring * 0.55) * 0.75;
  }
  return buf;
}

// 11. katana-sheathe.wav: Crisp metallic click + resonant ring on victory sheathe
function genKatanaSheathe() {
  const dur = 0.48;
  const buf = makeBuffer(dur);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    // Slide-in scrape (0..0.09s) then crisp lock click at t=0.09s
    let v = 0;
    if (t < 0.09) {
      v += noise() * envADSR(t, 0.005, 0.02, 0.5, 0.02, 0.09) * 0.22;
    }
    const dt = t - 0.085;
    if (dt >= 0) {
      const click = noise() * envExp(dt, 0.001, 0.008) * 0.6;
      const ring = (
        Math.sin(2 * Math.PI * 1975.5 * dt) * 0.5 +
        Math.sin(2 * Math.PI * 3136.0 * dt) * 0.35 +
        Math.sin(2 * Math.PI * 4698.6 * dt) * 0.2
      ) * envExp(dt, 0.001, 0.16);
      v += click + ring * 0.55;
    }
    buf[i] = v;
  }
  return buf;
}

// 12. bunker-transport.wav: Digital dematerialization / particle beam to the Bunker
function genBunkerTransport() {
  const dur = 0.68;
  const buf = makeBuffer(dur);
  let phase = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    const step = Math.floor(t * 28);
    const arpFreq = 330 * Math.pow(2, ((step * 5) % 24) / 12);
    phase += (2 * Math.PI * arpFreq) / SAMPLE_RATE;
    const e = envADSR(t, 0.015, 0.15, 0.7, 0.22, dur);
    const shimmer = Math.sin(phase) * 0.45 + Math.sin(2 * Math.PI * (220 + t * 1400) * t) * 0.35 + noise() * 0.15;
    buf[i] = shimmer * e * 0.45;
  }
  return buf;
}

// 13. error-logic.wav: YoRHa logic virus / low buzz alert
function genErrorLogic() {
  const dur = 0.4;
  const buf = makeBuffer(dur);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    const e = envADSR(t, 0.005, 0.08, 0.75, 0.1, dur);
    const f = t < 0.18 ? 164.81 : 130.81;
    const saw = 2 * ((t * f) - Math.floor(0.5 + t * f));
    const glitch = (Math.floor(t * 60) % 2 === 0 ? 1 : -0.4);
    buf[i] = (saw * 0.65 * glitch + noise() * 0.18) * e * 0.45;
  }
  return buf;
}

// 14. talk-blip.wav: Short mechanical YoRHa dialogue text blip
function genTalkBlip() {
  const dur = 0.045;
  const buf = makeBuffer(dur);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    const e = envExp(t, 0.002, 0.016);
    const v = Math.sin(2 * Math.PI * 1318.5 * t) * 0.65
            + Math.sin(2 * Math.PI * 1975.5 * t) * 0.35;
    buf[i] = v * e * 0.32;
  }
  return buf;
}

// 15. footstep-metal.wav: Light heel tap on window frame
function genFootstepMetal() {
  const dur = 0.09;
  const buf = makeBuffer(dur);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    const e = envExp(t, 0.001, 0.022);
    const tap = Math.sin(2 * Math.PI * (340 * Math.exp(-t * 45) + 95) * t) * 0.65 + noise() * 0.35;
    buf[i] = tap * e * 0.4;
  }
  return buf;
}

// 16. cloth-rustle.wav: Soft combat dress fabric rustle when sitting down
function genClothRustle() {
  const dur = 0.18;
  const buf = makeBuffer(dur);
  let lp = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    const n = noise();
    lp = lp * 0.82 + n * 0.18;
    const e = envADSR(t, 0.02, 0.05, 0.5, 0.06, dur);
    buf[i] = lp * e * 0.35;
  }
  return buf;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const generators = [
    ['ui-open.wav', genUiOpen],
    ['ui-confirm.wav', genUiConfirm],
    ['ui-cancel.wav', genUiCancel],
    ['alert-permission.wav', genAlertPermission],
    ['pod-scan.wav', genPodScan],
    ['pod-glide.wav', genPodGlide],
    ['pod-fire.wav', genPodFire],
    ['pod-happy-chirp.wav', genPodHappyChirp],
    ['weapon-hum.wav', genWeaponHum],
    ['katana-slash.wav', genKatanaSlash],
    ['katana-sheathe.wav', genKatanaSheathe],
    ['bunker-transport.wav', genBunkerTransport],
    ['error-logic.wav', genErrorLogic],
    ['talk-blip.wav', genTalkBlip],
    ['footstep-metal.wav', genFootstepMetal],
    ['cloth-rustle.wav', genClothRustle],
  ];

  console.log(`Generating ${generators.length} YoRHa PCM .wav files into ${OUT_DIR}...`);
  for (const [name, fn] of generators) {
    const info = writeWav(name, fn());
    console.log(`  [OK] ${info.filename.padEnd(22)} (${info.durationMs}ms, ${info.bytes} bytes)`);
  }
}

if (require.main === module) {
  main();
}
