// Theme SoundBank player (src/renderer/js/sound-bank.js)
// Loads real .wav/.mp3/.ogg files from themes/<id>/sounds/ into WebAudio buffers
// and plays them with zero latency when Semantic Action Slots trigger.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = 0.75;
    this.buffers = new Map();
    this.lastBlip = 0;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    return ctx;
  }

  configure({ muted, volume }) {
    if (typeof muted === 'boolean') this.muted = muted;
    if (typeof volume === 'number') {
      this.volume = volume;
      if (this.master) this.master.gain.value = volume;
    }
  }

  async loadThemeSounds(soundMap = {}) {
    const ctx = this.ensure();
    this.buffers.clear();
    const entries = Object.entries(soundMap);
    await Promise.all(entries.map(async ([name, url]) => {
      try {
        const res = await fetch(url);
        const arr = await res.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arr);
        this.buffers.set(name, audioBuf);
      } catch (err) {
        console.warn('[zeromate-sound] failed to decode', name, err);
      }
    }));
  }

  play(cue, { rate = 1.0, gain = 1.0 } = {}) {
    if (this.muted) return;
    if (cue === 'talk-blip') {
      const now = performance.now();
      if (now - this.lastBlip < 42) return;
      this.lastBlip = now;
      rate = 0.96 + Math.random() * 0.1;
    }
    const ctx = this.ensure();
    if (ctx.state === 'suspended') ctx.resume();

    const buf = this.buffers.get(cue);
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(this.master);
      src.start();
      return;
    }

    // Fallback synth tone if a future custom theme omits a file
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = cue.includes('alert') ? 880 : 1200;
    g.gain.setValueAtTime(0.08 * gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.connect(g).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  }
}
