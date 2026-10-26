// Push-to-Talk Local Voice Recorder & Resampler (src/renderer/js/voice-stt.js)
// Captures microphone audio when Ctrl+Space is held/toggled or via the YoRHa Chat Bar,
// resamples to 16kHz mono Float32 PCM in memory, and sends it to the local Whisper ONNX engine.

export class VoicePTT {
  constructor({ host, soundBank, chatBar, panel, onTranscribed }) {
    this.host = host;
    this.sound = soundBank;
    this.chatBar = chatBar;
    this.panel = panel;
    this.onTranscribed = onTranscribed;

    this.recording = false;
    this.stream = null;
    this.audioCtx = null;
    this.processor = null;
    this.chunks = [];
    this.sampleRate = 44100;
  }

  async toggle() {
    if (this.recording) {
      await this.stopAndTranscribe();
    } else {
      await this.start();
    }
  }

  async start() {
    if (this.recording) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      this.audioCtx = new AudioContext();
      this.sampleRate = this.audioCtx.sampleRate;
      const source = this.audioCtx.createMediaStreamSource(this.stream);
      const proc = this.audioCtx.createScriptProcessor(4096, 1, 1);
      this.chunks = [];

      proc.onaudioprocess = (e) => {
        if (!this.recording) return;
        const input = e.inputBuffer.getChannelData(0);
        this.chunks.push(new Float32Array(input));
      };

      source.connect(proc);
      proc.connect(this.audioCtx.destination);
      this.processor = { source, proc };
      this.recording = true;

      this.sound.play('ui-open');
      this.chatBar.setRecording(true, 'ESCUCHANDO MICRÓFONO LOCAL (WHISPER ONNX)...');
      if (!this.chatBar.visible) {
        this.panel.say({
          kind: 'work',
          speaker: 'pod',
          tag: 'STT LOCAL',
          line: 'Reporte: Canal de voz activo (Ctrl+Espacio para finalizar transmisión).',
          hold: null,
        });
      }
    } catch (err) {
      this.sound.play('error-logic');
      this.panel.say({
        kind: 'error',
        speaker: 'pod',
        tag: 'STT ERROR',
        line: `Alerta: No se pudo acceder al micrófono local (${err.message}).`,
        hold: 4500,
      });
    }
  }

  async stopAndTranscribe() {
    if (!this.recording) return;
    this.recording = false;
    this.sound.play('ui-confirm');

    try {
      this.processor?.proc.disconnect();
      this.processor?.source.disconnect();
      this.stream?.getTracks().forEach((t) => t.stop());
      await this.audioCtx?.close();
    } catch {}

    this.chatBar.setRecording(false, 'PROCESANDO VOZ EN LOCAL (0 TOKENS)...');

    const totalLen = this.chunks.reduce((acc, c) => acc + c.length, 0);
    if (totalLen === 0) {
      this.chatBar.setRecording(false);
      return;
    }

    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const c of this.chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    this.chunks = [];

    // Resample to 16000 Hz mono for Whisper ONNX
    const pcm16k = await this.resampleTo16k(merged, this.sampleRate);
    const transcribeFn = this.host.transcribeAudio || this.host.transcribePcm16k;
    const res = await transcribeFn?.call(this.host, Array.from(pcm16k));
    this.chatBar.setRecording(false);

    if (res?.ok && res.text) {
      if (this.chatBar.visible) {
        this.chatBar.input.value = res.text;
        this.chatBar.input.focus();
      }
      this.onTranscribed?.(res.text);
    } else {
      this.panel.say({
        kind: 'info',
        speaker: 'pod',
        tag: 'STT LOCAL',
        line: 'Reporte: No se detectó voz clara en la transmisión de audio.',
        hold: 3500,
      });
    }
  }

  async resampleTo16k(samples, srcRate) {
    if (srcRate === 16000) return samples;
    const durationSec = samples.length / srcRate;
    const targetLen = Math.max(1, Math.round(durationSec * 16000));
    const offline = new OfflineAudioContext(1, targetLen, 16000);
    const buffer = offline.createBuffer(1, samples.length, srcRate);
    buffer.copyToChannel(samples, 0);
    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0);
  }
}
