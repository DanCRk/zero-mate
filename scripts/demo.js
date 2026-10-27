#!/usr/bin/env node
'use strict';

/**
 * scripts/demo.js
 * Interactive Hook & Animation Showcase for ZeroMate.
 * Sends simulated Claude Code / Antigravity lifecycle hooks and Semantic Action Slots
 * to the active ZeroMate instance on 127.0.0.1:47824 to showcase audio, visual, and tactile reactions.
 *
 * Usage:
 *   npm run demo                  # Run complete cinematic showcase
 *   npm run demo -- --stage visor # Run only visor calibration animation
 *   npm run demo -- --stage sit   # Run only window sitting animation
 *   npm run demo -- --stage katana# Run only katana inspection animation
 *   npm run demo -- --stage alert # Run only permission alert hologram
 *   npm run demo -- --stage victory # Run only victory celebration
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
${C.gray}Simulando ciclo de vida de agentes tácticos y slots de animación (2B & Pod 042)
Destino: 127.0.0.1:${PORT}${C.reset}
`);
}

function printHelp() {
  banner();
  console.log(`${C.bold}Modo de uso:${C.reset}`);
  console.log(`  npm run demo                    Ejecuta la demostración cinematográfica completa`);
  console.log(`  npm run demo -- --stage <nombre>  Ejecuta una fase o animación específica`);
  console.log(`  npm run demo -- --fast          Reduce las pausas para pruebas rápidas`);
  console.log(`  npm run demo -- --loop          Ejecuta la demo en bucle continuo`);
  console.log(`  npm run demo -- --help          Muestra esta ayuda\n`);
  console.log(`${C.bold}Fases y animaciones disponibles (--stage):${C.reset}`);
  console.log(`  ${C.cyan}session${C.reset}     Enlace táctico inicial (SessionStart)`);
  console.log(`  ${C.cyan}prompt${C.reset}      Recepción de directiva del operador (UserPromptSubmit)`);
  console.log(`  ${C.cyan}katana${C.reset}      [Animación] Inspección de Contrato Virtuoso con halo dorado y giro 360°`);
  console.log(`  ${C.cyan}visor${C.reset}       [Animación] Calibración de visor táctico, destello estrella y escaneo`);
  console.log(`  ${C.cyan}sit${C.reset}         [Animación] Planeo y asiento sobre el marco de una ventana`);
  console.log(`  ${C.cyan}pet${C.reset}         [Animación] Interacción y caricias tácticas a Pod 042 con chirrido`);
  console.log(`  ${C.cyan}command${C.reset}     [Animación] Brazos cruzados vigilantes y escaneo láser de Pod 042`);
  console.log(`  ${C.cyan}alert${C.reset}       [Holograma] Alarma roja YoRHa y modal interactivo de autorización`);
  console.log(`  ${C.cyan}poke${C.reset}        [Animación] Corte relámpago con katana por molestia y advertencia`);
  console.log(`  ${C.cyan}wall_jump${C.reset}   [Animación] Anclaje a pared, salto acrobático 360° y planeo dinámico`);
  console.log(`  ${C.cyan}breach${C.reset}      [Animación] Brecha y hackeo digital YoRHa de ventana activa`);
  console.log(`  ${C.cyan}peek${C.reset}        [Animación] Suspensión invertida en techo o asomo sigiloso en borde`);
  console.log(`  ${C.cyan}traverse${C.reset}    [Animación] Planeo fluido de Pod 042 a través del escritorio`);
  console.log(`  ${C.cyan}error${C.reset}       Detección de anomalía táctica (PostToolUseFailure)`);
  console.log(`  ${C.cyan}subagent${C.reset}    Despliegue coordinado de subagente auxiliar (SubagentStart)`);
  console.log(`  ${C.cyan}uplink${C.reset}      [Animación] Satélite orbital del Búnker, rayo de datos y mirada`);
  console.log(`  ${C.cyan}victory${C.reset}     [Gran Final] Acrobacia, corte masivo de energía y fuegos artificiales`);
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

function sendHttpRequest(pathName, payload) {
  return new Promise((resolve, reject) => {
    const json = JSON.stringify(payload);
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
        path: pathName,
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

function postSlot(slot, opts = {}) {
  return sendHttpRequest('/slot', { slot, ...opts });
}

function postEvent(payload) {
  return sendHttpRequest('/event', payload);
}

async function ensureZeroMateRunning() {
  process.stdout.write(`${C.dim}Comprobando estado de ZeroMate... ${C.reset}`);
  const isUp = await checkHealth();
  if (isUp) {
    console.log(`${C.green}[ONLINE]${C.reset} Conexión táctica verificada en puerto ${PORT}.`);
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
      console.log(`\n${C.green}[LISTO]${C.reset} ZeroMate cargado y listo para recibir animaciones y hooks.\n`);
      await sleep(1200);
      return true;
    }
  }

  console.error(`\n${C.red}[ERROR]${C.reset} No se pudo conectar con ZeroMate en el puerto ${PORT}.`);
  console.error(`Inicia la aplicación con 'npm start' o 'npm run dev' y vuelve a intentar.`);
  return false;
}

const STAGES = [
  {
    id: 'session',
    name: '1. Enlace Táctico Inicial (SessionStart)',
    desc: 'Pod 042 confirma la conexión con el entorno de desarrollo y abre canal táctico.',
    reaction: 'Pod 042 emite sonido de confirmación y reporta el enlace en el panel.',
    holdMs: 3000,
    type: 'event',
    payload: {
      hook_event_name: 'SessionStart',
      source: 'antigravity',
      session_id: 'demo-showcase-01',
      forceAudio: true,
    },
  },
  {
    id: 'prompt',
    name: '2. Recepción de Directiva del Operador (UserPromptSubmit)',
    desc: 'El usuario envía una orden compleja al agente de IA.',
    reaction: 'Chime sutil, panel parpadea analizando la directiva táctica.',
    holdMs: 2500,
    type: 'event',
    payload: {
      hook_event_name: 'UserPromptSubmit',
      source: 'antigravity',
      prompt: 'Pod 042: Escanear anomalías de memoria en el sector 11 y preparar armas de combate.',
      forceAudio: true,
    },
  },
  {
    id: 'katana',
    name: '3. Inspección Táctica de Katana (Slot: idle_quirk / katana)',
    desc: '2B desenvaina y examina Contrato Virtuoso flotante en un halo dorado.',
    reaction: 'Aura dorada YoRHa, destello deslizante a lo largo de la hoja, ping de escaneo y giro 360° para enfundar detrás de la espalda.',
    holdMs: 5200,
    type: 'slot',
    slot: 'idle_quirk',
    payload: {
      kind: 'katana',
      forceAudio: true,
    },
  },
  {
    id: 'visor',
    name: '4. Calibración de Visor de Combate (Slot: idle_quirk / visor)',
    desc: '2B ajusta su visor táctico negro, activando sensores ópticos y HUD.',
    reaction: 'Inclinación stoica, escaneo óptico holográfico cian/dorado, destello de estrella de 4 puntas giratoria con fulgor anamórfico, banner anime de ojos y SFX de calibración.',
    holdMs: 4600,
    type: 'slot',
    slot: 'idle_quirk',
    payload: {
      kind: 'visor',
      forceAudio: true,
    },
  },
  {
    id: 'sit',
    name: '5. Anclaje y Asiento en Ventana (Slot: sit_window)',
    desc: '2B salta hacia la ventana activa del escritorio para montar guardia.',
    reaction: 'Planeo directo con Pod 042 hacia el marco superior de la ventana, aterrizaje suave con balanceo y postura de asiento colgando las piernas.',
    holdMs: 5000,
    type: 'slot',
    slot: 'sit_window',
    payload: {
      announce: true,
      forceAudio: true,
    },
  },
  {
    id: 'pet',
    name: '6. Caricias Tácticas a Pod 042 (Slot: companion_pet)',
    desc: 'Interacción de mantenimiento y afecto hacia la unidad de apoyo táctico.',
    reaction: '2B gira hacia Pod 042 y lo acaricia cariñosamente con partículas de corazones dorados, mientras Pod 042 emite un alegre chirrido melódico.',
    holdMs: 4400,
    type: 'slot',
    slot: 'companion_pet',
    payload: {
      initiator: 'user',
      forceAudio: true,
    },
  },
  {
    id: 'command',
    name: '7. Ejecución de Herramienta en Terminal (PreToolUse / tool_work)',
    desc: 'El agente invoca una herramienta del sistema operativo (PowerShell / compilador).',
    reaction: '2B cruza los brazos con vigilancia marcial mientras Pod 042 proyecta un escáner láser rojo/dorado sobre la ventana activa.',
    holdMs: 4200,
    type: 'slot',
    slot: 'tool_work',
    payload: {
      tag: 'POWERSHELL',
      line: 'Reporte: Escaneando estructura del proyecto y ejecutando tareas del sistema.',
      forceAudio: true,
    },
  },
  {
    id: 'alert',
    name: '8. Alerta Holográfica de Autorización (PermissionRequest)',
    desc: 'Un comando crítico o sensible requiere confirmación explícita del operador.',
    reaction: '¡Alarma roja YoRHa! Pod 042 intercepta el cursor en vuelo parpadeando en rojo/ámbar y despliega el modal táctico [ALLOW / DENY].',
    holdMs: 5500,
    type: 'event',
    payload: {
      hook_event_name: 'PermissionRequest',
      source: 'antigravity',
      notification_type: 'permission_prompt',
      tool_name: 'PowerShell',
      command: 'git push origin main --force',
      title: 'Comando sensible detectado',
      message: 'git push origin main --force',
      forceAudio: true,
    },
  },
  {
    id: 'poke',
    name: '9. Reacción por Molestia (Slot: poke_annoyed)',
    desc: 'El operador insiste repetidamente o agita bruscamente a 2B.',
    reaction: '¡Corte instantáneo con Contrato Virtuoso hacia el cursor! Arco de energía blanca/dorada, banner de corte anime Studio Trigger y advertencia stoica: "Las emociones están prohibidas... concéntrate en la misión."',
    holdMs: 4400,
    type: 'slot',
    slot: 'poke_annoyed',
    payload: {
      forceAudio: true,
    },
  },
  {
    id: 'wall_jump',
    name: '10. Salto Acrobático y Planeo (Slot: wall_jump_glide)',
    desc: '2B se impulsa dinámicamente desde el borde de la pantalla o ventana.',
    reaction: 'Fase 1: Anclaje y crouch en la pared. Fase 2: Voltereta acrobática 360° en el aire con sprite acrobático. Fase 3: Sujeción fluida a Pod 042 y planeo dinámico.',
    holdMs: 5200,
    type: 'slot',
    slot: 'wall_jump_glide',
    payload: {
      announce: true,
      forceAudio: true,
    },
  },
  {
    id: 'breach',
    name: '11. Brecha de Hackeo Digital (Slot: window_breach)',
    desc: 'Invasión táctica y análisis profundo de una ventana de código.',
    reaction: '2B aterriza en la ventana mientras se despliega una cuadrícula de hackeo digital YoRHa que parpadea y expande sus líneas de telemetría.',
    holdMs: 4800,
    type: 'slot',
    slot: 'window_breach',
    payload: {
      announce: true,
      forceAudio: true,
    },
  },
  {
    id: 'peek',
    name: '12. Suspensión Invertida en Techo (Slot: edge_peek / top)',
    desc: 'Modo de observación táctico encubierto desde el marco superior.',
    reaction: '2B se ancla boca abajo desde el bisel superior de la pantalla con las botas firmes y la falda orientada, mientras Pod 042 se posiciona a su lado como centinela.',
    holdMs: 4800,
    type: 'slot',
    slot: 'edge_peek',
    payload: {
      side: 'top',
      announce: true,
      forceAudio: true,
    },
  },
  {
    id: 'traverse',
    name: '13. Planeo Asistido por el Escritorio (Slot: traverse)',
    desc: 'Desplazamiento aéreo continuo para reposicionarse en el entorno.',
    reaction: '2B se engancha de las manijas de Pod 042 y vuela elegantemente en parábola flotante por la pantalla.',
    holdMs: 4200,
    type: 'slot',
    slot: 'traverse',
    payload: {
      announce: true,
      forceAudio: true,
    },
  },
  {
    id: 'error',
    name: '14. Detección de Anomalía (PostToolUseFailure)',
    desc: 'Una herramienta o compilación falló durante el proceso del agente.',
    reaction: 'Sonido de glitch táctico, 2B advierte de la anomalía en el panel de diálogo.',
    holdMs: 3800,
    type: 'event',
    payload: {
      hook_event_name: 'PostToolUseFailure',
      source: 'antigravity',
      tool_name: 'PowerShell',
      error: 'Error: fallo de compilación en subrutina de enlace',
      forceAudio: true,
    },
  },
  {
    id: 'subagent',
    name: '15. Despliegue de Unidad Auxiliar (SubagentStart)',
    desc: 'Se lanza un subagente paralelo para investigación o refactorización.',
    reaction: 'Pod 042 coordina sensores y notifica el despliegue de la unidad de apoyo.',
    holdMs: 3200,
    type: 'event',
    payload: {
      hook_event_name: 'SubagentStart',
      source: 'antigravity',
      tool_name: 'Subagente de Investigación Táctica',
      subagent_type: 'research',
      forceAudio: true,
    },
  },
  {
    id: 'uplink',
    name: '16. Enlace Orbital con el Búnker (Slot: bunker_uplink)',
    desc: 'Conexión de telemetría de alta prioridad con la estación orbital YoRHa.',
    reaction: 'El satélite orbital YoRHa sobrevuela la pantalla emitiendo un haz de telemetría de datos directo a Pod 042 mientras 2B contempla el enlace.',
    holdMs: 5600,
    type: 'slot',
    slot: 'bunker_uplink',
    payload: {
      forceAudio: true,
    },
  },
  {
    id: 'victory',
    name: '17. Celebración Épica de Victoria YoRHa (Slot: victory / Stop)',
    desc: 'La misión del operador ha finalizado con éxito rotundo.',
    reaction: '¡Gran final! Salto acrobático de 2B, corte masivo de energía con ondas expansivas doradas en el suelo, y pirueta aérea 360° de Pod 042 con fuegos artificiales de celebración.',
    holdMs: 6500,
    type: 'slot',
    slot: 'victory',
    payload: {
      forceAudio: true,
      silent: false,
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
    let res;
    if (stage.type === 'slot') {
      res = await postSlot(stage.slot, stage.payload);
      if (res && res.ok) {
        console.log(`${C.green}  -> Animación [${stage.slot}] activada en pantalla con éxito.${C.reset}`);
      } else {
        console.warn(`${C.amber}  -> Respuesta del puente: ${JSON.stringify(res)}${C.reset}`);
      }
    } else {
      res = await postEvent(stage.payload);
      if (res && res.ok) {
        console.log(`${C.green}  -> Hook [${stage.payload.hook_event_name}] procesado con éxito.${C.reset}`);
      } else {
        console.warn(`${C.amber}  -> Respuesta del puente: ${JSON.stringify(res)}${C.reset}`);
      }
    }
  } catch (err) {
    console.error(`${C.red}  -> Error enviando solicitud: ${err.message}${C.reset}`);
  }

  const delay = isFastMode ? 1000 : stage.holdMs;
  if (idx < total - 1) {
    process.stdout.write(`${C.dim}  Observando en escritorio (${(delay / 1000).toFixed(1)}s)... ${C.reset}`);
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
    stagesToRun = STAGES.filter((s) => {
      const id = s.id.toLowerCase();
      const name = s.name.toLowerCase();
      const slot = (s.slot || '').toLowerCase();
      const t = targetStage.toLowerCase();
      return id === t || id.includes(t) || name.includes(t) || slot === t;
    });

    if (stagesToRun.length === 0) {
      console.error(`${C.red}Fase o animación '${targetStage}' no encontrada.${C.reset}`);
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
    console.log(`${C.green}${C.bold} [FIN DEL DEMO] Demostración de hooks y animaciones completada.${C.reset}`);
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
