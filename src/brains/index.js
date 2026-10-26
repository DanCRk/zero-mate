'use strict';

// Multi-Brain Router (src/brains/index.js)
// Connects ZeroMate Desktop Agent to:
//   1) Headless CLIs (windowsHide: true, stdin/stdout pipes, zero console popups):
//      - 'agy'        (Antigravity CLI)
//      - 'claude-cli' (Claude Code CLI)
//   2) Direct Cloud APIs & Local LLMs:
//      - 'gemini'     (Google Gemini REST API)
//      - 'openai'     (OpenAI Chat Completions API)
//      - 'claude-api' (Anthropic Messages API)
//      - 'ollama'     (Local Ollama HTTP API at 127.0.0.1:11434)
// Automatically injects compact .ctx files (themes/<theme>/personality.ctx, skills/user-memory.ctx, skills/INDEX.ctx).

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

const PROVIDERS = [
  { id: 'agy', label: 'Antigravity CLI (Headless · 0 Consola)', type: 'cli', defaultModel: 'agy-default' },
  { id: 'claude-cli', label: 'Claude Code CLI (Headless · 0 Consola)', type: 'cli', defaultModel: 'claude-code' },
  { id: 'ollama', label: 'Ollama Local (127.0.0.1:11434)', type: 'local', defaultModel: 'llama3.2' },
  { id: 'gemini', label: 'Google Gemini API', type: 'api', defaultModel: 'gemini-2.5-flash' },
  { id: 'openai', label: 'OpenAI API', type: 'api', defaultModel: 'gpt-4o-mini' },
  { id: 'claude-api', label: 'Anthropic Claude API', type: 'api', defaultModel: 'claude-3-5-sonnet-latest' },
];

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return '';
  }
}

function readThemeMeta(themeId = 'nier-2b') {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'themes', themeId, 'theme.json'), 'utf8'));
  } catch {
    return { name: 'ZeroMate', character: { name: 'Personaje' }, companion: { name: 'Acompañante' } };
  }
}

function ensureUserMemoryFile() {
  const memPath = path.join(ROOT, 'skills', 'user-memory.ctx');
  const examplePath = path.join(ROOT, 'skills', 'user-memory.example.ctx');
  if (!fs.existsSync(memPath) && fs.existsSync(examplePath)) {
    try {
      fs.copyFileSync(examplePath, memPath);
    } catch {}
  }
}

function buildSystemContext(themeId = 'nier-2b', lang = 'en') {
  ensureUserMemoryFile();
  const meta = readThemeMeta(themeId);
  const charName = meta.character?.name || '2B';
  const compName = meta.companion?.name || 'Pod 042';

  const personality = readFileSafe(path.join(ROOT, 'themes', themeId, 'personality.ctx'));
  const userMem = readFileSafe(path.join(ROOT, 'skills', 'user-memory.ctx'));
  const skillsIdx = readFileSafe(path.join(ROOT, 'skills', 'INDEX.ctx'));

  const isEs = lang === 'es';
  const toolsHeader = isEs
    ? 'HERRAMIENTAS TÁCTICAS DISPONIBLES (si la solicitud del operador requiere una acción del sistema o PC, añade al final [TOOL:nombre {"param": "valor"}]):'
    : 'AVAILABLE TACTICAL TOOLS (if operator request requires a system or PC action, append [TOOL:name {"param": "value"}] at the end):';

  const instruction = isEs
    ? 'INSTRUCTION: Responde SIEMPRE en español en 1 o 2 oraciones concisas para un globo de diálogo en el escritorio.'
    : 'INSTRUCTION: Always reply in English in 1 or 2 concise sentences suitable for a desktop speech bubble.';

  const speakerPrefix = isEs
    ? `Inicia tu respuesta con "[${charName}]" si hablas como ${charName} o "[${compName}]" si hablas como ${compName} (usando "Reporte:", "Propuesta:" o "Alerta:").`
    : `Start your reply with "[${charName}]" if speaking as ${charName} or "[${compName}]" if speaking as ${compName} (using "Report:", "Proposal:" or "Alert:").`;

  return [
    personality,
    userMem,
    skillsIdx,
    toolsHeader,
    '- open_app_or_url: {"target": "calc"|"https://..."|"path/folder"}',
    '- media_and_volume: {"action": "up"|"down"|"mute"|"play_pause"|"next"|"prev"|"notify", "value": 3}',
    '- search_files: {"query": "...", "baseDir": "path/projects"}',
    '- read_clipboard: {}',
    '- write_clipboard: {"text": "..."}',
    '- capture_active_window: {}',
    '- web_search: {"query": "..."}',
    '- run_shell_command: {"command": "..."} [TIER 2]',
    '- write_or_edit_file: {"filePath": "...", "content": "...", "append": false} [TIER 2]',
    '- kill_process: {"processName": "..."} [TIER 2]',
    '- load_skill: {"filename": "..."}',
    '- save_skill: {"filename": "...", "dsl": "...", "summary": "..."}',
    '- update_user_memory: {"key": "...", "fact": "..."}',
    instruction,
    speakerPrefix,
  ].filter(Boolean).join('\n');
}

function parseCharacterReply(rawText) {
  let text = String(rawText || '').trim();
  if (!text) return null;

  let speaker = '2b';
  let slot = null;
  let toolCall = null;

  const toolMatch = text.match(/\[TOOL:([a-z_]+)\s*(\{.*?\})?\]/i);
  if (toolMatch) {
    try {
      const toolParams = toolMatch[2] ? JSON.parse(toolMatch[2]) : {};
      toolCall = { name: toolMatch[1].toLowerCase(), params: toolParams };
    } catch {
      toolCall = { name: toolMatch[1].toLowerCase(), params: {} };
    }
    text = text.replace(toolMatch[0], '').trim();
  }

  const slotMatch = text.match(/\[SLOT:([a-z_]+)\]/i);
  if (slotMatch) {
    slot = slotMatch[1].toLowerCase();
    text = text.replace(slotMatch[0], '').trim();
  }

  if (/^\[POD(?:\s*042)?\]/i.test(text)) {
    speaker = 'pod';
    text = text.replace(/^\[POD(?:\s*042)?\]\s*:?\s*/i, '').trim();
  } else if (/^\[2B\]/i.test(text)) {
    speaker = '2b';
    text = text.replace(/^\[2B\]\s*:?\s*/i, '').trim();
  } else if (/^(Reporte|Propuesta|Alerta|Afirmativo|Negativo|Report|Proposal|Alert|Affirmative|Negative)\s*:/i.test(text)) {
    speaker = 'pod';
  }

  // Keep concise for desktop overlay bubble
  const clean = text.replace(/\s+/g, ' ').slice(0, 280);
  return { speaker, line: clean, slot, toolCall };
}

function detectDirectToolIntent(userPrompt) {
  const p = String(userPrompt || '').trim().toLowerCase();

  // Open app / URL
  const openMatch = p.match(/^(?:abre|abrir|lanzar|ejecuta la aplicaci[oó]n|open|launch|run|start)\s+(?:the\s+)?(?:app(?:lication)?|program|url|link|folder)?\s*(.+)$/i);
  if (openMatch) {
    let target = openMatch[1].trim();
    if (/^(enlace|url|link)\s+/i.test(target)) target = target.replace(/^(enlace|url|link)\s+/i, '');
    if (/^(el|la|the)\s+/i.test(target)) target = target.replace(/^(el|la|the)\s+/i, '');
    return { name: 'open_app_or_url', params: { target } };
  }

  // Media / Volume
  if (/(?:subir?\s+(?:el\s+)?volumen|volume\s*(?:up|increase|louder))/i.test(p)) return { name: 'media_and_volume', params: { action: 'up', value: 4 } };
  if (/(?:bajar?\s+(?:el\s+)?volumen|volume\s*(?:down|decrease|lower|quieter))/i.test(p)) return { name: 'media_and_volume', params: { action: 'down', value: 4 } };
  if (/^(?:silencia|mute|mutear|unmute|silence)$/i.test(p) || /(?:mute\s+volume|silenciar\s+audio)/i.test(p)) return { name: 'media_and_volume', params: { action: 'mute' } };
  if (/^(?:pausa|play|reproducir|reanuda|pause|resume)$/i.test(p) || /(?:pause\s+music|reproducir\s+m[uú]sica)/i.test(p)) return { name: 'media_and_volume', params: { action: 'play_pause' } };
  if (/(?:siguiente\s+(?:canci[oó]n|pista)|next\s+(?:track|song))/i.test(p)) return { name: 'media_and_volume', params: { action: 'next' } };
  if (/(?:(?:canci[oó]n|pista)\s+anterior|previous\s+(?:track|song)|prev\s+(?:track|song))/i.test(p)) return { name: 'media_and_volume', params: { action: 'prev' } };

  // Capture active window / screen scan
  if (/(?:qu[eé]\s+ventana|captura|escanea\s+la\s+pantalla|qu[eé]\s+hay\s+en\s+pantalla|what\s+window|active\s+window|capture\s+screen|scan\s+screen)/i.test(p)) {
    return { name: 'capture_active_window', params: {} };
  }

  // Search files
  const searchMatch = p.match(/^(?:busca|buscar|encuentra|localiza|search|find|locate)\s+(?:for\s+)?(?:archivos?|ficheros?|files?)\s+(?:de|named|matching)?\s*(.+)$/i);
  if (searchMatch) {
    return { name: 'search_files', params: { query: searchMatch[1].trim() } };
  }

  // Clipboard read / write
  if (/(?:lee\s+el\s+portapapeles|qu[eé]\s+tengo\s+copiado|pega\s+el\s+portapapeles|read\s+(?:the\s+)?clipboard|what(?:'s|\s+is)\s+in\s+(?:the\s+)?clipboard)/i.test(p)) {
    return { name: 'read_clipboard', params: {} };
  }
  const copyMatch = p.match(/^(?:copia|copiar|copy)\s+(?:(?:to\s+(?:the\s+)?clipboard|al\s+portapapeles)\s+)?(.+)$/i);
  if (copyMatch && !p.includes('archivo') && !p.includes('file')) {
    return { name: 'write_clipboard', params: { text: copyMatch[1].trim() } };
  }

  // Web search
  const webMatch = p.match(/^(?:busca|buscar|investiga|googlea|web\s+search|search\s+(?:the\s+)?web|google)\s+(?:en\s+(?:la\s+)?web|en\s+internet|en\s+google|for)?\s*(.+)$/i);
  if (webMatch && (p.includes('web') || p.includes('internet') || p.includes('google') || p.startsWith('google') || p.startsWith('web search'))) {
    return { name: 'web_search', params: { query: webMatch[1].trim() } };
  }

  // Skills & Memory (Tier 1)
  const loadSkillMatch = p.match(/^(?:carga|cargar|lee|leer|ejecuta|load|run)\s+(?:the\s+|la\s+)?skill\s+([a-z0-9_-]+)/i);
  if (loadSkillMatch) {
    return { name: 'load_skill', params: { filename: loadSkillMatch[1].trim() } };
  }

  const memoryMatch = p.match(/^(?:recuerda|guarda\s+en\s+memoria|remember)\s+(?:que\s+|that\s+)?([a-z0-9_]+)\s*(?:es|=|is|\:)\s*(.+)$/i);
  if (memoryMatch) {
    return { name: 'update_user_memory', params: { key: memoryMatch[1].trim(), fact: memoryMatch[2].trim() } };
  }

  // Shell command (Tier 2)
  const cmdMatch = p.match(/^(?:ejecuta|corre|ejecutar|correr|run\s+(?:the\s+)?command|exec)\s+(?:el\s+comando\s+)?(.+)$/i);
  if (cmdMatch) {
    return { name: 'run_shell_command', params: { command: cmdMatch[1].trim() } };
  }

  // Kill process (Tier 2)
  const killMatch = p.match(/^(?:cierra|mata|termina|kill|terminate|stop)\s+(?:el\s+proceso\s+|the\s+process\s+)?(.+)$/i);
  if (killMatch) {
    return { name: 'kill_process', params: { processName: killMatch[1].trim() } };
  }

  return null;
}

function spawnHeadlessCli(binCandidates, args, inputText, timeoutMs = 22000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const nodeDir = path.dirname(process.execPath);
    const env = {
      ...process.env,
      PATH: `${nodeDir};${process.env.PATH || ''}`,
      NO_COLOR: '1',
    };

    const cmd = binCandidates[0];
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env,
      windowsHide: true,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch {}
      reject(new Error('CLI headless timeout'));
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `CLI exited with code ${code}`));
      }
    });

    if (inputText) {
      child.stdin.write(inputText);
    }
    child.stdin.end();
  });
}

async function askHeadlessCli(providerId, sysPrompt, userPrompt) {
  const combined = `${sysPrompt}\n\nOperador: ${userPrompt}\nRespuesta:`;
  const isWin = process.platform === 'win32';

  if (providerId === 'agy') {
    // Run via node/cmd completely hidden with windowsHide: true
    const cmdExe = isWin ? 'cmd.exe' : 'agy';
    const args = isWin ? ['/d', '/s', '/c', 'agy', '-p', combined] : ['-p', combined];
    return spawnHeadlessCli([cmdExe], args, '');
  }

  if (providerId === 'claude-cli') {
    const cmdExe = isWin ? 'cmd.exe' : 'claude';
    const args = isWin ? ['/d', '/s', '/c', 'claude', '-p', combined] : ['-p', combined];
    return spawnHeadlessCli([cmdExe], args, '');
  }

  throw new Error(`Unsupported CLI provider: ${providerId}`);
}

async function askGemini(apiKey, model, sysPrompt, userPrompt) {
  if (!apiKey) throw new Error('Falta Gemini API Key');
  const m = model || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sysPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: 160, temperature: 0.7 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function askOpenAI(apiKey, model, sysPrompt, userPrompt) {
  if (!apiKey) throw new Error('Falta OpenAI API Key');
  const m = model || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: m,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 160,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function askClaudeApi(apiKey, model, sysPrompt, userPrompt) {
  if (!apiKey) throw new Error('Falta Claude API Key');
  const m = model || 'claude-3-5-sonnet-latest';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: m,
      max_tokens: 160,
      system: sysPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API HTTP ${res.status}`);
  const data = await res.json();
  return data?.content?.[0]?.text || '';
}

async function askOllama(ollamaUrl, model, sysPrompt, userPrompt) {
  const base = (ollamaUrl || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const m = model || 'llama3.2';
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: m,
      stream: false,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  return data?.message?.content || '';
}

function localTacticalFallback(userPrompt, providerId, themeId = 'nier-2b', lang = 'en') {
  const meta = readThemeMeta(themeId);
  const charName = meta.character?.name || 'Agent';
  const compName = meta.companion?.name || 'Companion';
  const q = String(userPrompt || '').toLowerCase();
  const isEs = lang === 'es';

  if (q.includes('estado') || q.includes('status') || q.includes('reporte') || q.includes('report')) {
    return {
      speaker: 'pod',
      line: isEs
        ? `Reporte [${compName}]: Sistemas operativos al 100%. Enlace activo en modo [${providerId.toUpperCase()}]. Sin anomalías.`
        : `Report [${compName}]: Systems 100% operational. Active link in [${providerId.toUpperCase()}] mode. No anomalies detected.`,
      slot: 'tool_work',
    };
  }
  if (q.includes('hola') || q.includes('hello') || q.includes('hi') || q.includes(charName.toLowerCase())) {
    return {
      speaker: '2b',
      line: isEs
        ? `${charName} en posición. Dime cuál es el siguiente objetivo, operador.`
        : `${charName} standing by. State the next objective, operator.`,
      slot: 'idle_quirk',
    };
  }
  if (q.includes(compName.toLowerCase()) || q.includes('escanea') || q.includes('analiza') || q.includes('scan') || q.includes('analyze')) {
    return {
      speaker: 'pod',
      line: isEs
        ? `Afirmativo. ${compName} ejecutando barrido de diagnóstico sobre "${String(userPrompt).slice(0, 48)}".`
        : `Affirmative. ${compName} executing diagnostic sweep on "${String(userPrompt).slice(0, 48)}".`,
      slot: 'tool_work',
    };
  }
  return {
    speaker: Math.random() < 0.55 ? '2b' : 'pod',
    line: Math.random() < 0.55
      ? (isEs
          ? `${charName}: Orden recibida — "${String(userPrompt).slice(0, 60)}". Mantendré vigilancia sobre esta tarea.`
          : `${charName}: Directive received — "${String(userPrompt).slice(0, 60)}". Maintaining tactical oversight.`)
      : (isEs
          ? `Reporte [${compName}]: Directiva registrada ("${String(userPrompt).slice(0, 52)}"). Listo para asistir.`
          : `Report [${compName}]: Directive logged ("${String(userPrompt).slice(0, 52)}"). Ready to assist.`),
    slot: 'tool_work',
  };
}

class BrainRouter {
  constructor({ getConfig, toolEngine }) {
    this.getConfig = getConfig;
    this.toolEngine = toolEngine;
  }

  listProviders() {
    return PROVIDERS;
  }

  async executeToolAndFormat(toolName, params, lang = 'en') {
    if (!this.toolEngine) return null;
    const isEs = lang === 'es';
    try {
      const res = await this.toolEngine.execute(toolName, params);
      switch (toolName) {
        case 'open_app_or_url':
          return {
            speaker: 'pod',
            line: isEs
              ? `Afirmativo. Lanzando objetivo táctico: [${params.target}].`
              : `Affirmative. Launching tactical target: [${params.target}].`,
            slot: 'tool_work',
          };
        case 'media_and_volume':
          return {
            speaker: 'pod',
            line: isEs
              ? `Reporte: Ajuste de medios del sistema ejecutado (${params.action}).`
              : `Report: System media control executed (${params.action}).`,
            slot: 'idle_quirk',
          };
        case 'capture_active_window':
          return {
            speaker: 'pod',
            line: isEs
              ? `Reporte: Ventana activa identificada — [${res.title}] (${res.app}). Escáner completado.`
              : `Report: Active window identified — [${res.title}] (${res.app}). Scan complete.`,
            slot: 'tool_work',
          };
        case 'search_files':
          return {
            speaker: 'pod',
            line: isEs
              ? `Reporte: Localizados ${res.count} archivos para "${params.query}". Primer resultado: ${res.results?.[0]?.name || 'ninguno'}.`
              : `Report: Located ${res.count} file(s) for "${params.query}". First match: ${res.results?.[0]?.name || 'none'}.`,
            slot: 'tool_work',
          };
        case 'read_clipboard':
          return {
            speaker: 'pod',
            line: res.text
              ? (isEs
                  ? `Reporte: Portapapeles (${res.length} caracteres): "${res.text.slice(0, 75)}${res.length > 75 ? '...' : ''}"`
                  : `Report: Clipboard (${res.length} chars): "${res.text.slice(0, 75)}${res.length > 75 ? '...' : ''}"`)
              : (isEs ? 'Reporte: El portapapeles del sistema está vacío.' : 'Report: System clipboard is empty.'),
            slot: 'tool_work',
          };
        case 'write_clipboard':
          return {
            speaker: 'pod',
            line: isEs
              ? `Reporte: Texto copiado al portapapeles con éxito (${res.length} caracteres).`
              : `Report: Text copied to clipboard successfully (${res.length} chars).`,
            slot: 'tool_work',
          };
        case 'web_search':
          return {
            speaker: 'pod',
            line: isEs
              ? `Reporte táctico: ${res.summary.slice(0, 180)}`
              : `Tactical report: ${res.summary.slice(0, 180)}`,
            slot: 'tool_work',
          };
        case 'run_shell_command':
          return {
            speaker: 'pod',
            line: res.ok
              ? (isEs
                  ? `Reporte: Comando de Nivel 2 completado con código 0. ${res.stdout ? `Salida: ${res.stdout.slice(0, 80)}` : ''}`
                  : `Report: Tier 2 command completed with exit code 0. ${res.stdout ? `Output: ${res.stdout.slice(0, 80)}` : ''}`)
              : (isEs
                  ? `Alerta: El comando falló con código ${res.exitCode}. ${res.stderr ? `Error: ${res.stderr.slice(0, 80)}` : ''}`
                  : `Alert: Command failed with exit code ${res.exitCode}. ${res.stderr ? `Error: ${res.stderr.slice(0, 80)}` : ''}`),
            slot: res.ok ? 'victory' : 'tool_work',
          };
        case 'write_or_edit_file':
          return {
            speaker: 'pod',
            line: isEs
              ? `Reporte: Archivo [${path.basename(res.path)}] ${res.append ? 'actualizado' : 'escrito'} (${res.bytes} bytes).`
              : `Report: File [${path.basename(res.path)}] ${res.append ? 'updated' : 'written'} (${res.bytes} bytes).`,
            slot: 'victory',
          };
        case 'kill_process':
          return {
            speaker: 'pod',
            line: res.ok
              ? (isEs
                  ? `Reporte: Proceso ${params.processName || params.pid} terminado con éxito.`
                  : `Report: Process ${params.processName || params.pid} terminated successfully.`)
              : (isEs
                  ? `Alerta: No se pudo terminar el proceso ${params.processName || params.pid}.`
                  : `Alert: Failed to terminate process ${params.processName || params.pid}.`),
            slot: res.ok ? 'victory' : 'tool_work',
          };
        case 'load_skill':
          return {
            speaker: 'pod',
            line: isEs
              ? `Reporte: Módulo táctico [${params.filename}] cargado en memoria de trabajo.`
              : `Report: Tactical module [${params.filename}] loaded into working memory.`,
            slot: 'tool_work',
          };
        case 'save_skill':
          return {
            speaker: 'pod',
            line: isEs
              ? `Reporte: Nueva rutina táctica [${params.filename}] indexada en skills/INDEX.ctx.`
              : `Report: New tactical routine [${params.filename}] indexed in skills/INDEX.ctx.`,
            slot: 'victory',
          };
        case 'update_user_memory':
          return {
            speaker: '2b',
            line: isEs
              ? `Dato registrado en memoria de usuario: [${params.key}] -> ${params.fact}.`
              : `Entry recorded in user memory: [${params.key}] -> ${params.fact}.`,
            slot: 'idle_quirk',
          };
        default:
          return {
            speaker: 'pod',
            line: isEs
              ? `Reporte: Herramienta [${toolName}] ejecutada correctamente.`
              : `Report: Tool [${toolName}] executed successfully.`,
            slot: 'tool_work',
          };
      }
    } catch (err) {
      return {
        speaker: '2b',
        line: isEs ? `Operación detenida: ${err.message}` : `Operation aborted: ${err.message}`,
        slot: 'poke_annoyed',
      };
    }
  }

  async ask(prompt, options = {}) {
    const cfg = this.getConfig();
    const lang = cfg.lang || 'en';
    const provider = options.provider || cfg.brainProvider || 'agy';
    const themeId = cfg.theme || 'nier-2b';
    const sysPrompt = buildSystemContext(themeId, lang);
    const model = cfg.brainModel || '';
    const keys = cfg.brainKeys || {};

    // 1. Direct intent detection (0-latency PC controls & fast skills)
    const directIntent = detectDirectToolIntent(prompt);
    if (directIntent && this.toolEngine) {
      const toolRes = await this.executeToolAndFormat(directIntent.name, directIntent.params, lang);
      if (toolRes) {
        return { ...toolRes, provider, offlineFallback: false, directTool: true };
      }
    }

    // 2. Query configured brain provider
    try {
      let raw = '';
      switch (provider) {
        case 'agy':
        case 'claude-cli':
          raw = await askHeadlessCli(provider, sysPrompt, prompt);
          break;
        case 'gemini':
          raw = await askGemini(keys.gemini || process.env.GEMINI_API_KEY, model, sysPrompt, prompt);
          break;
        case 'openai':
          raw = await askOpenAI(keys.openai || process.env.OPENAI_API_KEY, model, sysPrompt, prompt);
          break;
        case 'claude-api':
          raw = await askClaudeApi(keys.claude || process.env.ANTHROPIC_API_KEY, model, sysPrompt, prompt);
          break;
        case 'ollama':
          raw = await askOllama(cfg.ollamaUrl || 'http://127.0.0.1:11434', model, sysPrompt, prompt);
          break;
        default:
          raw = await askHeadlessCli('agy', sysPrompt, prompt);
          break;
      }

      const parsed = parseCharacterReply(raw);
      if (parsed) {
        if (parsed.toolCall && this.toolEngine) {
          const executed = await this.executeToolAndFormat(parsed.toolCall.name, parsed.toolCall.params, lang);
          if (executed) {
            return { ...executed, provider, offlineFallback: false };
          }
        }
        if (parsed.line) {
          return { ...parsed, provider, offlineFallback: false };
        }
      }
    } catch (err) {
      console.warn(`[zeromate-brain] provider '${provider}' fallback:`, err.message);
    }

    return {
      ...localTacticalFallback(prompt, provider, themeId, lang),
      provider,
      offlineFallback: true,
    };
  }
}

module.exports = { BrainRouter, PROVIDERS };
