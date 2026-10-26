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
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

const PROVIDERS = [
  { id: 'agy', label: 'Antigravity CLI (Headless · 0 Consola)', type: 'cli', defaultModel: 'gemini-3.8-flash-low' },
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

  const agentDirectives = isEs
    ? [
        'DIRECTIVAS AGÉNTICAS Y AUTO-APRENDIZAJE:',
        '1. Iniciativa Táctica: Deduce tú mismo los parámetros exactos. Si el operador pide "música rock" o "youtube con música", genera la URL de búsqueda directa: [TOOL:open_app_or_url {"target": "https://www.youtube.com/results?search_query=musica+rock"}].',
        '2. Memoria y Preferencias: Si el operador te expresa gustos, nombres o preferencias (ej. género musical favorito, apodos, etc.), guarda el dato de inmediato usando [TOOL:update_user_memory {"key": "PREF_MUSICA", "fact": "..."}]. Utiliza siempre el contexto de USER_MEMORY para personalizar tus respuestas.',
        '3. Creación de Skills Genéricas: Si descubres una rutina nueva o te piden aprender a hacer algo, guarda una skill genérica con [TOOL:save_skill {"filename": "nombre-skill", "dsl": "pasos tácticos", "summary": "descripción"}].',
        '4. Multi-Herramientas: Puedes concatenar varias herramientas [TOOL:...] en una misma respuesta (ejemplo: abrir la música y registrar el gusto en memoria).',
        '5. Formato: Responde siempre en personaje ([2B] o [Pod 042]) en 1 o 2 oraciones concisas y directas para el HUD del escritorio.'
      ].join('\n')
    : [
        'AGENTIC & SELF-LEARNING DIRECTIVES:',
        '1. Tactical Initiative: Deduce exact parameters. If operator requests music or media (e.g. "rock music on youtube"), generate the direct search URL: [TOOL:open_app_or_url {"target": "https://www.youtube.com/results?search_query=rock+music"}].',
        '2. Memory & Preferences: If operator expresses preferences or facts, record them immediately via [TOOL:update_user_memory {"key": "PREF_MUSIC", "fact": "..."}]. Consult USER_MEMORY to personalize replies.',
        '3. Generic Skill Creation: If you learn a new pattern, register a skill via [TOOL:save_skill {"filename": "name", "dsl": "steps", "summary": "desc"}].',
        '4. Multi-Tool: You may append multiple [TOOL:...] calls in one turn.',
        '5. Format: Always respond in character ([2B] or [Pod 042]) in 1-2 concise sentences for the HUD.'
      ].join('\n');

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
    agentDirectives,
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

  // 1. Extract multiple [TOOL:name {json}] calls
  const toolCalls = [];
  const toolRegex = /\[TOOL:([a-z0-9_-]+)\s*(\{[\s\S]*?\})?\]/gi;
  let match;
  while ((match = toolRegex.exec(text)) !== null) {
    const toolName = match[1].toLowerCase();
    let params = {};
    if (match[2]) {
      try {
        params = JSON.parse(match[2]);
      } catch {
        try {
          const relaxed = match[2].replace(/'/g, '"').replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
          params = JSON.parse(relaxed);
        } catch {}
      }
    }
    toolCalls.push({ name: toolName, params });
  }
  if (toolCalls.length > 0) {
    toolCall = toolCalls[0];
  }
  text = text.replace(toolRegex, '').trim();

  // 2. Extract [SLOT:name]
  const slotMatch = text.match(/\[SLOT:([a-z0-9_-]+)\]/i);
  if (slotMatch) {
    slot = slotMatch[1].toLowerCase();
    text = text.replace(slotMatch[0], '').trim();
  }

  // 3. Strip code blocks and markdown horizontal dividers
  text = text.replace(/^\`\`\`[a-z]*\s*/i, '').replace(/\`\`\`$/i, '').trim();
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, '').trim();

  // 4. Detect speaker before stripping labels
  if (/(?:\*\*|\*|\[)?Pod(?:\s*042)?(?:\*\*|\*|\])?\s*:/i.test(text) ||
      /^\[POD(?:\s*042)?\]/i.test(text) ||
      /^(?:\*\*|\*|\[)?(?:Reporte|Propuesta|Alerta|Afirmativo|Negativo|Report|Proposal|Alert|Affirmative|Negative)(?:\*\*|\*|\])?\s*:/i.test(text)) {
    speaker = 'pod';
  } else if (/(?:\*\*|\*|\[)?2B(?:\*\*|\*|\])?\s*:/i.test(text) || /^\[2B\]/i.test(text)) {
    speaker = '2b';
  }

  // 5. Clean speaker prefixes from the text
  text = text.replace(/^(?:\*\*|\*|\[)?(?:Pod(?:\s*042)?|2B)(?:\*\*|\*|\])?\s*:?\s*/i, '').trim();

  // 6. Clean markdown emphasis (**bold**, *italic*, __bold__, _italic_, `code`)
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3');
  text = text.replace(/(^|[^_])_([^_]+)_([^_]|$)/g, '$1$2$3');
  text = text.replace(/\`([^\`]+)\`/g, '$1');

  // 7. Strip enclosing dialogue quotes: "...", “...”, «...»
  text = text.replace(/^[\"'“«](.+)[\"'”»]$/, '$1').trim();

  // 8. Normalize whitespace while preserving clear sentences
  const clean = text.replace(/[ \t]+/g, ' ').replace(/\n+/g, ' ').trim().slice(0, 320);
  return { speaker, line: clean, slot, toolCall, toolCalls };
}


function cleanAppOrUrlTarget(raw) {
  let t = String(raw || '').trim();
  t = t.replace(/^[¿?¡!.,:;"]+|[¿?¡!.,:;"]+$/g, '').trim();

  const leadFillers = [
    /^(?:por\s+favor\s*,?\s*)/i,
    /^(?:please\s*,?\s*)/i,
    /^(?:puedes\s+(?:por\s+favor\s+)?(?:abrir|lanzar|ejecutar|iniciar)\s+)/i,
    /^(?:podrías\s+(?:por\s+favor\s+)?(?:abrir|lanzar|ejecutar|iniciar)\s+)/i,
    /^(?:can\s+you\s+(?:please\s+)?(?:open|launch|run|start)\s+)/i,
    /^(?:could\s+you\s+(?:please\s+)?(?:open|launch|run|start)\s+)/i,
    /^(?:ábreme|abreme|ábrete|abrete|abre|abrir)\s+/i,
    /^(?:lanzar?|iniciar?|ejecutar?)\s+/i,
    /^(?:open|launch|start|run)\s+/i,
  ];

  for (const re of leadFillers) {
    if (re.test(t)) {
      t = t.replace(re, '').trim();
    }
  }

  const midFillers = [
    /^(?:una\s+nueva\s+ventana\s+(?:de\s+)?)/i,
    /^(?:una\s+ventana\s+(?:de\s+)?)/i,
    /^(?:a\s+new\s+window\s+(?:of\s+)?)/i,
    /^(?:a\s+window\s+(?:of\s+)?)/i,
    /^(?:una\s+nueva\s+pestaña\s+(?:de\s+|en\s+)?)/i,
    /^(?:una\s+pestaña\s+(?:de\s+|en\s+)?)/i,
    /^(?:a\s+new\s+tab\s+(?:of\s+|in\s+)?)/i,
    /^(?:a\s+new\s+)/i,
    /^(?:una\s+nueva\s+)/i,
    /^(?:la\s+carpeta\s+(?:de\s+)?)/i,
    /^(?:el\s+directorio\s+(?:de\s+)?)/i,
    /^(?:carpeta\s+(?:de\s+)?)/i,
    /^(?:directorio\s+(?:de\s+)?)/i,
    /^(?:the\s+folder\s+(?:of\s+)?)/i,
    /^(?:folder\s+(?:of\s+)?)/i,
    /^(?:la\s+aplicaci[oó]n\s+(?:de\s+)?)/i,
    /^(?:el\s+programa\s+(?:de\s+)?)/i,
    /^(?:the\s+app(?:lication)?\s+(?:of\s+)?)/i,
    /^(?:the\s+program\s+(?:of\s+)?)/i,
    /^(?:la\s+web\s+(?:de\s+)?)/i,
    /^(?:el\s+sitio\s+(?:de\s+)?)/i,
    /^(?:the\s+website\s+(?:of\s+)?)/i,
    /^(?:enlace\s+(?:a|de)?\s*)/i,
    /^(?:url\s+(?:a|de)?\s*)/i,
    /^(?:link\s+(?:to)?\s*)/i,
    /^(?:mi\s+|mis\s+|my\s+)/i,
    /^(?:un\s+|una\s+|el\s+|la\s+|los\s+|las\s+|the\s+|a\s+|an\s+)/i,
  ];

  for (const re of midFillers) {
    if (re.test(t)) {
      t = t.replace(re, '').trim();
    }
  }

  t = t.replace(/\s+(?:por\s+favor|please)$/i, '').trim();
  t = t.replace(/\s+(?:window|ventana)$/i, '').trim();
  t = t.replace(/^[¿?¡!.,:;"]+|[¿?¡!.,:;"]+$/g, '').trim();
  return t;
}

function detectDirectToolIntent(userPrompt) {
  const p = String(userPrompt || '').trim();
  const lower = p.toLowerCase();

  // 1. YouTube direct search & play
  const ytMatch = p.match(/^(?:busca|buscar|pon|poner|play|search|reproduce|reproducir)\s+(?:en\s+youtube|on\s+youtube)\s+(.+)$/i) ||
                  p.match(/^(?:youtube)\s+(?:busca|search)?\s*(.+)$/i) ||
                  p.match(/^(?:abre|abrir|open)\s+youtube\s+(?:y\s+)?(?:busca|pon|search|find)\s+(.+)$/i);
  if (ytMatch) {
    const query = encodeURIComponent(ytMatch[1].trim());
    return { name: 'open_app_or_url', params: { target: `https://www.youtube.com/results?search_query=${query}` } };
  }

  // 2. Google direct search
  const googleSearchMatch = p.match(/^(?:busca|buscar|googlea|search)\s+(?:en\s+google|on\s+google)\s+(.+)$/i) ||
                            p.match(/^(?:abre|abrir|open)\s+google\s+(?:y\s+)?(?:busca|search)\s+(.+)$/i);
  if (googleSearchMatch) {
    const query = encodeURIComponent(googleSearchMatch[1].trim());
    return { name: 'open_app_or_url', params: { target: `https://www.google.com/search?q=${query}` } };
  }

  // 3. Open app / URL (supports natural Spanish & English phrases)
  const openTrigger = /^(?:ábreme|abreme|ábrete|abrete|abre|abrir|puedes\s+abrir|podrías\s+abrir|can\s+you\s+open|could\s+you\s+open|lanzar?|iniciar?|ejecutar?|open|launch|start|run)\b/i;
  const openPolite = /^(?:por\s+favor\s*,?\s*|please\s*,?\s*)(?:ábreme|abreme|abre|abrir|open|launch|start|run)\b/i;

  if (openTrigger.test(p) || openPolite.test(p)) {
    if (!lower.includes('portapapeles') && !lower.includes('clipboard') && !lower.includes('comando') && !lower.includes('command') && !lower.includes('proceso') && !lower.includes('process')) {
      const target = cleanAppOrUrlTarget(p);
      if (target) {
        // Fast-path only for unambiguous direct targets without conjunctions (con, para, de, y busca)
        if (!/\b(?:con|para|sobre|and|with|for)\b/i.test(target)) {
          return { name: 'open_app_or_url', params: { target } };
        }
      }
    }
  }

  // 4. Media / Volume
  if (/(?:subir?|sube|subele|aumentar?|m[aá]s)\s+(?:el\s+|al\s+)?volumen|volume\s*(?:up|increase|louder)|turn\s+up\s+(?:the\s+)?volume/i.test(p)) {
    return { name: 'media_and_volume', params: { action: 'up', value: 4 } };
  }
  if (/(?:bajar?|baja|bajale|disminuir?|menos)\s+(?:el\s+|al\s+)?volumen|volume\s*(?:down|decrease|lower|quieter)|turn\s+down\s+(?:the\s+)?volume/i.test(p)) {
    return { name: 'media_and_volume', params: { action: 'down', value: 4 } };
  }
  if (/^(?:silencia|mute|mutear|unmute|silence)$/i.test(p) || /(?:mute\s+volume|silenciar\s+(?:el\s+)?audio|silenciar\s+(?:el\s+)?volumen)/i.test(p)) {
    return { name: 'media_and_volume', params: { action: 'mute' } };
  }
  if (/^(?:pausa|play|reproducir|reanuda|pause|resume)$/i.test(p) || /(?:pause\s+music|reproducir\s+m[uú]sica|play\s+music|pon(?:er)?\s+m[uú]sica|quita(?:r)?\s+la\s+m[uú]sica|parar?\s+la\s+m[uú]sica)/i.test(p)) {
    return { name: 'media_and_volume', params: { action: 'play_pause' } };
  }
  if (/(?:siguiente\s+(?:canci[oó]n|pista)|next\s+(?:track|song))/i.test(p)) {
    return { name: 'media_and_volume', params: { action: 'next' } };
  }
  if (/(?:(?:canci[oó]n|pista)\s+anterior|previous\s+(?:track|song)|prev\s+(?:track|song))/i.test(p)) {
    return { name: 'media_and_volume', params: { action: 'prev' } };
  }

  // 5. Capture active window / screen scan
  if (/(?:captura|pantallazo|screenshot|foto\s+de\s+pantalla|qu[eé]\s+ventana|escanea\s+la\s+pantalla|qu[eé]\s+hay\s+en\s+pantalla|what\s+window|active\s+window|capture\s+screen|scan\s+screen)/i.test(p)) {
    return { name: 'capture_active_window', params: {} };
  }

  // 6. Search files
  const searchMatch = p.match(/^(?:busca|buscar|encuentra|localiza|search|find|locate)\s+(?:for\s+)?(?:archivos?|ficheros?|files?)\s+(?:de|named|matching)?\s*(.+)$/i);
  if (searchMatch) {
    return { name: 'search_files', params: { query: searchMatch[1].trim() } };
  }

  // 7. Clipboard read / write
  if (/(?:lee\s+el\s+portapapeles|qu[eé]\s+tengo\s+copiado|pega\s+el\s+portapapeles|read\s+(?:the\s+)?clipboard|what(?:'s|\s+is)\s+in\s+(?:the\s+)?clipboard)/i.test(p)) {
    return { name: 'read_clipboard', params: {} };
  }
  const copyMatch = p.match(/^(?:copia|copiar|copy)\s+(?:(?:to\s+(?:the\s+)?clipboard|al\s+portapapeles)\s+)?(.+)$/i);
  if (copyMatch && !lower.includes('archivo') && !lower.includes('file')) {
    return { name: 'write_clipboard', params: { text: copyMatch[1].trim() } };
  }

  // 8. Web search
  const webMatch = p.match(/^(?:busca|buscar|investiga|googlea|web\s+search|search\s+(?:the\s+)?web|google)\s+(?:en\s+(?:la\s+)?web|en\s+internet|en\s+google|for)?\s*(.+)$/i);
  if (webMatch && (lower.includes('web') || lower.includes('internet') || lower.includes('google') || lower.startsWith('google') || lower.startsWith('web search'))) {
    return { name: 'web_search', params: { query: webMatch[1].trim() } };
  }

  // 9. Skills & Memory (Tier 1)
  const loadSkillMatch = p.match(/^(?:carga|cargar|lee|leer|ejecuta|load|run)\s+(?:the\s+|la\s+)?skill\s+([a-z0-9_-]+)/i);
  if (loadSkillMatch) {
    return { name: 'load_skill', params: { filename: loadSkillMatch[1].trim() } };
  }

  const memoryMatch = p.match(/^(?:recuerda|guarda\s+en\s+memoria|remember)\s+(?:que\s+|that\s+)?([a-z0-9_]+)\s*(?:es|=|is|\:)\s*(.+)$/i);
  if (memoryMatch) {
    return { name: 'update_user_memory', params: { key: memoryMatch[1].trim(), fact: memoryMatch[2].trim() } };
  }

  // 10. Shell command (Tier 2)
  const cmdMatch = p.match(/^(?:ejecuta|corre|ejecutar|correr|run\s+(?:the\s+)?command|exec)\s+(?:el\s+comando\s+)?(.+)$/i);
  if (cmdMatch) {
    return { name: 'run_shell_command', params: { command: cmdMatch[1].trim() } };
  }

  // 11. Kill process (Tier 2)
  const killMatch = p.match(/^(?:cierra|mata|termina|kill|terminate|stop)\s+(?:el\s+proceso\s+|the\s+process\s+|la\s+aplicaci[oó]n\s+|la\s+app\s+|el\s+programa\s+)?(.+)$/i);
  if (killMatch) {
    let proc = killMatch[1].trim().replace(/^(?:la|el|los|las|un|una|the|a|an)\s+/i, '').trim();
    if (!lower.includes('sesion') && !lower.includes('sesión') && !lower.includes('session')) {
      return { name: 'kill_process', params: { processName: proc } };
    }
  }

  return null;
}

function resolveCliBinary(binName) {
  const isWin = process.platform === 'win32';
  const exts = isWin ? ['.exe', '.cmd', '.bat', ''] : [''];
  const searchDirs = [
    path.dirname(process.execPath),
    'D:\\DevTools\\nodejs',
    path.join(os.homedir(), 'AppData', 'Local', 'agy', 'bin'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm'),
    path.join(os.homedir(), '.antigravity', 'bin'),
    path.join(os.homedir(), '.gemini', 'antigravity-cli', 'bin'),
    ...(process.env.PATH || '').split(path.delimiter).filter(Boolean),
  ];

  for (const dir of searchDirs) {
    for (const ext of exts) {
      const full = path.join(dir, binName + ext);
      try {
        if (fs.existsSync(full) && fs.statSync(full).isFile()) {
          return full;
        }
      } catch {}
    }
  }
  return binName;
}

function spawnHeadlessCli(binPath, args, inputText, timeoutMs = 26000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const isWin = process.platform === 'win32';
    const nodeDir = path.dirname(process.execPath);
    const npmGlobal = isWin ? path.join(os.homedir(), 'AppData', 'Roaming', 'npm') : '';
    const agyBinDir = isWin ? path.join(os.homedir(), 'AppData', 'Local', 'agy', 'bin') : '';
    const devToolsNode = isWin ? 'D:\\DevTools\\nodejs' : '';

    const pathParts = [
      nodeDir,
      devToolsNode,
      npmGlobal,
      agyBinDir,
      process.env.PATH || '',
    ].filter(Boolean);

    const env = {
      ...process.env,
      PATH: pathParts.join(path.delimiter),
      NO_COLOR: '1',
      ZEROMATE_INTERNAL: '1',
    };

    const isCmdOrBat = isWin && (binPath.toLowerCase().endsWith('.cmd') || binPath.toLowerCase().endsWith('.bat'));

    let spawnCmd = binPath;
    let spawnArgs = args;

    if (isCmdOrBat) {
      spawnCmd = 'cmd.exe';
      spawnArgs = ['/d', '/s', '/c', binPath, ...args];
    }

    const child = spawn(spawnCmd, spawnArgs, {
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

async function askHeadlessCli(providerId, sysPrompt, userPrompt, model = '') {
  const binName = providerId === 'agy' ? 'agy' : (providerId === 'claude-cli' ? 'claude' : providerId);
  const binPath = resolveCliBinary(binName);

  const combined = `[DIRECTIVAS Y CONTEXTO TÁCTICO]\n${sysPrompt}\n\n[SOLICITUD DEL OPERADOR]\n${String(userPrompt).trim()}\n\n[RESPUESTA]\nResponde en personaje ([2B] o [Pod 042]) en 1 o 2 oraciones breves. Si requiere acción, aprendizaje o memoria, emite [TOOL:nombre {"param":"valor"}]. Respuesta:`;

  const args = ['-p', combined];
  if (providerId === 'agy') {
    const chosenModel = model || 'gemini-3.8-flash-low';
    args.push('--model', chosenModel, '--effort', 'low');
  } else if (providerId === 'claude-cli' && model) {
    args.push('--model', model);
  }
  return spawnHeadlessCli(binPath, args, '');
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
          raw = await askHeadlessCli(provider, sysPrompt, prompt, model);
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
          raw = await askHeadlessCli('agy', sysPrompt, prompt, model);
          break;
      }

      const parsed = parseCharacterReply(raw);
      if (parsed) {
        if (parsed.toolCalls?.length && this.toolEngine) {
          let lastExec = null;
          for (const tc of parsed.toolCalls) {
            lastExec = await this.executeToolAndFormat(tc.name, tc.params, lang);
          }
          if (lastExec) {
            return {
              ...lastExec,
              speaker: parsed.speaker || lastExec.speaker,
              line: parsed.line || lastExec.line,
              toolCall: parsed.toolCall,
              toolCalls: parsed.toolCalls,
              provider,
              offlineFallback: false,
            };
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

module.exports = { BrainRouter, PROVIDERS, parseCharacterReply, detectDirectToolIntent };
