'use strict';

/**
 * Local Whisper STT Engine (src/main/stt.js)
 * Runs quantized Whisper-tiny ONNX locally via @huggingface/transformers.
 * Stores all model weights and caches within the project's local .cache directory
 * (<project_root>/.cache/models), isolated from global user directories.
 * Includes a local Windows System.Speech offline fallback.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'models');
const TMP_DIR = path.join(ROOT, '.cache', 'tmp');

// Enforce D: drive paths for any underlying cache
process.env.HF_HOME = CACHE_DIR;
process.env.TRANSFORMERS_CACHE = CACHE_DIR;
process.env.XDG_CACHE_HOME = CACHE_DIR;

let transcriberPromise = null;

async function getWhisperPipeline() {
  if (transcriberPromise) return transcriberPromise;
  transcriberPromise = (async () => {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const { pipeline, env } = await import('@huggingface/transformers');
    env.cacheDir = CACHE_DIR;
    env.localModelPath = CACHE_DIR;
    env.allowLocalModels = true;
    env.allowRemoteModels = true;

    const pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
      dtype: 'q8',
      device: 'cpu',
    });
    return pipe;
  })();
  try {
    return await transcriberPromise;
  } catch (err) {
    transcriberPromise = null;
    throw err;
  }
}

function writeTempWav16k(float32Samples) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const wavPath = path.join(TMP_DIR, `ptt-${Date.now()}.wav`);
  const sampleRate = 16000;
  const numSamples = float32Samples.length;
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, float32Samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(wavPath, buf);
  return wavPath;
}

function fallbackWindowsSpeech(float32Samples, lang = 'es-ES') {
  return new Promise((resolve) => {
    const wavPath = writeTempWav16k(float32Samples);
    const psCode = `
      try {
        Add-Type -AssemblyName System.Speech
        $culture = New-Object System.Globalization.CultureInfo('${lang}')
        $rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine($culture)
        $rec.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
        $rec.SetInputToWaveFile('${wavPath.replace(/'/g, "''")}')
        $res = $rec.Recognize()
        if ($res) { [Console]::Out.Write($res.Text) }
        $rec.Dispose()
      } catch {}
    `;
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCode], {
      windowsHide: true,
      timeout: 8000,
    }, (_err, stdout) => {
      try { fs.unlinkSync(wavPath); } catch {}
      resolve(String(stdout || '').trim());
    });
  });
}

async function transcribePcm16k(pcmArray, lang = 'es') {
  const normLang = typeof lang === 'object' ? (lang?.lang || 'es') : (lang || 'es');
  const float32 = pcmArray instanceof Float32Array ? pcmArray : new Float32Array(pcmArray);
  if (float32.length < 1600) {
    return { ok: false, text: '', error: 'Audio demasiado corto' };
  }

  try {
    const pipe = await getWhisperPipeline();
    const out = await pipe(float32, {
      language: normLang === 'en' ? 'english' : 'spanish',
      task: 'transcribe',
      chunk_length_s: 30,
    });
    const text = String(out?.text || '').trim();
    return { ok: true, text, engine: 'whisper-tiny-onnx' };
  } catch (err) {
    console.warn('[zeromate-stt] Whisper ONNX fallback to Windows Speech:', err.message);
    const text = await fallbackWindowsSpeech(float32, normLang === 'en' ? 'en-US' : 'es-ES');
    return { ok: Boolean(text), text, engine: 'windows-speech-local', error: text ? null : err.message };
  }
}

module.exports = { transcribePcm16k, getWhisperPipeline, CACHE_DIR };
