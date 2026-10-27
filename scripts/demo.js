#!/usr/bin/env node
'use strict';

/**
 * scripts/demo.js
 * Interactive Hook & Animation Showcase for ZeroMate.
 * Sends simulated Claude Code / Antigravity lifecycle hooks to the active ZeroMate instance
 * on 127.0.0.1:47824 to showcase audio, visual, and tactile reactions.
 *
 * Usage:
 *   npm run demo                  # Run complete cinematic showcase
 *   npm run demo -- --stage alert # Run only permission alert
 *   npm run demo -- --stage victory # Run only victory celebration
 *   npm run demo -- --stage katana # Run only weapon inspection
 *   npm run demo -- --fast        # Fast mode (short delays)
 *   npm run demo -- --loop        # Run continuously in a loop
 */

const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const PORT = Number(process.env.ZEROMATE_PORT || process.env.YORHA_PORT) || 47824;
const ROOT = path.resolve(__dirname, '..');

// Parse CLI flags
const args = process.argv.slice(2);
const isHelp = args.includes('--help') || args.includes('-h');
const isFast = args.includes('--fast') || args.includes('-f');
const isLoop = args.includes('--loop') || args.includes('-l');
const stageArgIdx = args.findIndex((a) => a === '--stage' || a === '-s');
const targetStage = stageArgIdx !== -1 ? (args[stageArgIdx + 1] || '').toLowerCase() : null;

// ANSI Colors for YoRHa Terminal Aesthetic
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  gold: '\x1b[38;2;218;212;187m',
  yellow: '\x1b[38;2;255;215;0m',
  amber: '\x1b[38;2;255;165;0m',
  red: '\x1b[38;2;255;68;68m',
  cyan: '\x1b[38;2;120;210;240m',
  green: '\x1b[38;2;140;220;140m',
  gray: '\x1b[38;2;128;128;128m',
  bgDark: '\x1b[48;2;26;25;23m',
};

function banner() {
  console.log(`
${C.gold}${C.bold}========================================================================
   ZEROMATE // PROJECT YORHA — INTERACTIVE HOOK & ANIMATION SHOWCASE
========================================================================${C.reset}
${C.gray}Simulando ciclo de vida de agentes tácticos (Antigravity / Claude Code)
Destino: 127.0.0.1:${PORT}${C.reset}
`);
}

function printHelp() {
  banner();
  console.log(`${C.bold}Modo de uso:${C.reset}`);
  console.log(`  npm run demo                    Ejecuta la demostración cinematográfica completa`);
  console.log(`  npm run demo -- --stage <nombre>  Ejecuta una fase específica`);
  console.log(`  npm run demo -- --fast          Reduce las pausas para pruebas rápidas`);
  console.log(`  npm run demo -- --loop          Ejecuta la demo en bucle continuo`);
  console.log(`  npm run demo -- --help          Muestra esta ayuda\n`);
  console.log(`${C.bold}Fases disponibles (--stage):${C.reset}`);
  console.log(`  ${C.cyan}session${C.reset}     Enlace táctico inicial (SessionStart)`);
  console.log(`  ${C.cyan}prompt${C.reset}      Recepción de directiva del operador (UserPromptSubmit)`);
  console.log(`  ${C.cyan}katana${C.reset}      Inspección táctica de Katana con destello y escaneo`);
  console.log(`  ${C.cyan}command${C.reset}     Ejecución de comando en terminal (PowerShell)`);
  console.log(`  ${C.cyan}alert${C.reset}       Alerta holográfica roja de autorización sensible`);
  console.log(`  ${C.cyan}error${C.reset}       Detección de anomalía táctica (PostToolUseFailure)`);
  console.log(`  ${C.cyan}subagent${C.reset}    Despliegue coordinado de subagente auxiliar`);
  console.log(`  ${C.cyan}victory${C.reset}     Celebración épica de victoria (Acrobacia, corte y fuegos)`);
  console.log();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORT}/health`, { timeout: 1500 }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(Boolean(json && json.ok));
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function postEvent(payload) {
  return new Promise((resolve, reject) => {
    const json = JSON.stringify(payload);
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(json),
        },
        timeout: 4000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ ok: res.statusCode === 200, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout de comunicación con ZeroMate'));
    });
    req.write(json);
    req.end();
  });
}

async function ensureZeroMateRunning() {
  process.stdout.write(`${C.dim}Comprobando estado de ZeroMate... ${C.reset}`);
  const isUp = await checkHealth();
  if (isUp) {
    console.log(`${C.green}[ONLINE]${C.reset} Conexión táctica verificada en pid activo.`);
    return true;
  }

  console.log(`${C.yellow}[OFFLINE]${C.reset}`);
  console.log(`${C.cyan}Iniciando ZeroMate en segundo plano...${C.reset}`);

  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  // Wait up to 15 seconds for startup
  const start = Date.now();
  while (Date.now() - start < 15000) {
    await sleep(800);
    process.stdout.write(`${C.dim}.${C.reset}`);
    if (await checkHealth()) {
      console.log(`\n${C.green}[LISTO]${C.reset} ZeroMate cargado y listo para recibir hooks.\n`);
      await sleep(1200);
      return true;
    }
  }

  console.error(`\n${C.red}[ERROR]${C.reset} No se pudo conectar con ZeroMate en el puerto ${PORT}.`);
  console.error(`Inicia la aplicación manualmente con 'npm start' o 'ZeroMate.exe' y vuelve a intentar.`);
  return false;
}

const STAGES = [
  {
    id: 'session',
    name: '1. Enlace Táctico Inicial (SessionStart)',
    desc: 'Pod 042 confirma la conexión con el entorno de desarrollo y abre canal táctico.',
    reaction: 'Pod 042 emite sonido de confirmación y reporta el enlace en el panel.',
    holdMs: 3200,
    payload: {
      hook_event_name: 'SessionStart',
      source: 'antigravity',
      session_id: 'demo-showcase-01',
    },
  },
  {
    id: 'prompt',
    name: '2. Recepción de Directiva del Operador (UserPromptSubmit)',
    desc: 'El usuario envía una orden compleja al agente de IA.',
    reaction: 'Chime sutil, panel parpadea analizando la directiva táctica.',
    holdMs: 2800,
    payload: {
      hook_event_name: 'UserPromptSubmit',
      source: 'antigravity',
      prompt: 'Pod 042: Escanear anomalías de memoria en el sector 11 y preparar armas de combate.',
    },
  },
  {
    id: 'katana',
    name: '3. Inspección Táctica de Katana (PreToolUse: Read)',
    desc: 'El agente analiza código fuente sensible (lectura de archivos).',
    reaction: '2B entra en animación de katana con aura dorada, brillo deslizante y escaneo de Pod 042.',
    holdMs: 5000,
    payload: {
      hook_event_name: 'PreToolUse',
      source: 'antigravity',
      tool_name: 'Read',
      tool_input: {
        file_path: 'src/combat/virtuous-treaty.rs',
      },
    },
  },
  {
    id: 'command',
    name: '4. Ejecución en Terminal (PreToolUse: PowerShell)',
    desc: 'El agente invoca una herramienta del sistema operativo.',
    reaction: 'Pod 042 confirma ejecución de la herramienta en pantalla.',
    holdMs: 3200,
    payload: {
      hook_event_name: 'PreToolUse',
      source: 'antigravity',
      tool_name: 'PowerShell',
      tool_input: {
        command: 'cargo test --all-targets --release',
      },
    },
  },
  {
    id: 'alert',
    name: '5. Alerta Holográfica de Autorización (PermissionRequest)',
    desc: 'Un comando crítico requiere confirmación explícita del operador.',
    reaction: '¡Alarma roja YoRHa! Pod 042 intercepta el cursor y despliega el modal táctico [ALLOW / DENY].',
    holdMs: 5500,
    payload: {
      hook_event_name: 'PermissionRequest',
      source: 'antigravity',
      notification_type: 'permission_prompt',
      tool_name: 'PowerShell',
      command: 'git push origin main --force',
      title: 'Comando sensible detectado',
      message: 'git push origin main --force',
    },
  },
  {
    id: 'error',
    name: '6. Detección de Anomalía (PostToolUseFailure)',
    desc: 'Una herramienta o compilación falló durante el proceso.',
    reaction: 'Sonido de glitch, 2B advierte de la anomalía en el panel de diálogo.',
    holdMs: 4000,
    payload: {
      hook_event_name: 'PostToolUseFailure',
      source: 'antigravity',
      tool_name: 'PowerShell',
      error: 'Error: segmentation fault en subrutina de enlace',
    },
  },
  {
    id: 'subagent',
    name: '7. Despliegue de Unidad Auxiliar (SubagentStart)',
    desc: 'Se lanza un subagente paralelo para investigación.',
    reaction: 'Pod 042 coordina sensores y notifica el despliegue.',
    holdMs: 3200,
    payload: {
      hook_event_name: 'SubagentStart',
      source: 'antigravity',
      tool_name: 'Subagente de Investigación Táctica',
      subagent_type: 'research',
    },
  },
  {
    id: 'victory',
    name: '8. Celebración Épica de Victoria YoRHa (Stop / SessionEnd)',
    desc: 'La tarea del agente ha finalizado exitosamente.',
    reaction: '¡Gran final! Salto acrobático de 2B, corte masivo de energía, ondas de choque y pirueta 360° de Pod con fuegos artificiales.',
    holdMs: 6500,
    payload: {
      hook_event_name: 'Stop',
      source: 'antigravity',
    },
  },
];

async function runStage(stage, idx, total, isFastMode) {
  const stepNum = `[${idx + 1}/${total}]`;
  console.log(`\n${C.bold}${C.gold}------------------------------------------------------------------------${C.reset}`);
  console.log(`${C.yellow}${C.bold}${stepNum} ${stage.name}${C.reset}`);
  console.log(`${C.gray}Contexto : ${C.reset}${stage.desc}`);
  console.log(`${C.cyan}Reacción : ${C.reset}${stage.reaction}`);

  try {
    const res = await postEvent(stage.payload);
    if (res.ok) {
      console.log(`${C.green}  -> Hook enviado con éxito.${C.reset}`);
    } else {
      console.warn(`${C.amber}  -> Respuesta del puente: ${JSON.stringify(res)}${C.reset}`);
    }
  } catch (err) {
    console.error(`${C.red}  -> Error enviando hook: ${err.message}${C.reset}`);
  }

  const delay = isFastMode ? 800 : stage.holdMs;
  if (idx < total - 1) {
    process.stdout.write(`${C.dim}  Observando animación en pantalla (${(delay / 1000).toFixed(1)}s)... ${C.reset}`);
    await sleep(delay);
    process.stdout.write(`${C.dim}listo.${C.reset}\n`);
  } else {
    await sleep(delay);
  }
}

async function main() {
  if (isHelp) {
    printHelp();
    return;
  }

  banner();

  const ok = await ensureZeroMateRunning();
  if (!ok) process.exit(1);

  let stagesToRun = STAGES;
  if (targetStage) {
    stagesToRun = STAGES.filter((s) => s.id === targetStage || s.name.toLowerCase().includes(targetStage));
    if (stagesToRun.length === 0) {
      console.error(`${C.red}Fase '${targetStage}' no encontrada.${C.reset}`);
      console.log(`Fases disponibles: ${STAGES.map((s) => s.id).join(', ')}`);
      process.exit(1);
    }
  }

  do {
    console.log(`\n${C.bold}${C.gold}>>> INICIANDO DEMOSTRACIÓN TÁCTICA (${stagesToRun.length} eventos) <<<${C.reset}`);
    for (let i = 0; i < stagesToRun.length; i++) {
      await runStage(stagesToRun[i], i, stagesToRun.length, isFast);
    }

    console.log(`\n${C.gold}${C.bold}========================================================================${C.reset}`);
    console.log(`${C.green}${C.bold} [FIN DEL DEMO] Demostración de hooks completada satisfactoriamente.${C.reset}`);
    console.log(`${C.gold}${C.bold}========================================================================${C.reset}\n`);

    if (isLoop) {
      console.log(`${C.dim}Modo bucle activo. Reiniciando en 3 segundos (Ctrl+C para salir)...${C.reset}`);
      await sleep(3000);
    }
  } while (isLoop);
}

main().catch((err) => {
  console.error(`${C.red}Fallo crítico en demo:${C.reset}`, err);
  process.exit(1);
});
