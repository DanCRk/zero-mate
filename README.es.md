[English](README.md) · **Español**

# ZeroMate — Motor de Agente de Escritorio Multi-Temática

> Motor de Desktop Agent multi-temática para Windows con **Slots Semánticos**, rigging WebGL 2D por shader sobre recorte PNG, rastreo de ventanas en tiempo real, interacción híbrida y enlace con modelos de IA locales y en la nube.
> **Tema Inicial Incluido**: *NieR: Automata (2B + Pod 042)* en `themes/nier-2b/`.

---

## ❖ Características Principales

1. **Overlay Transparente Click-Through**:
   - Ventana sin marcos, `alwaysOnTop` ('screen-saver'), con cálculo de impactos píxel por píxel sobre los personajes y los paneles de interfaz activa.
   - Si no estás tocando a los personajes o la interfaz, los clics atraviesan completamente hacia tus ventanas de trabajo.

2. **Rastreo de Ventanas en Vivo (`windows.ps1`)**:
   - El personaje activo camina por los bordes superiores de tus ventanas, se sienta balanceando las piernas y viaja sobre ellas si las arrastras.
   - Si cierras o minimizas la ventana, cae con física gravitatoria realista y aterriza en otra ventana o en el suelo.

3. **Arquitectura Multi-Tema por *Semantic Action Slots* (`ThemeEngine`)**:
   - Cada tema en `themes/<id>/` conecta sus propios sprites, animaciones y sonidos a los slots universales:
     - `sit_window`: caminar y sentarse en bordes de ventanas.
     - `traverse`: desplazamiento aéreo o planeo con el acompañante.
     - `idle_quirk`: gestos propios en reposo (ej. inspeccionar arma o interactuar).
     - `companion_interact`: frotar al acompañante con el cursor con trinos acústicos.
     - `poke_annoyed`: reacción rápida al cursor si molestas al personaje con clics continuos.
     - `tool_work`: escáner o acción de trabajo táctico.
     - `alert_confirm`: el acompañante vuela hacia tu cursor con alarma sonora pidiendo autorización.
     - `victory`: animación de victoria o celebración tras finalizar una tarea.
     - `stow` (`Ctrl+Alt+C`): repliegue del personaje principal a la base, dejando al acompañante flotando como centinela en la esquina.

4. **Interacción y Reconocimiento de Voz Local (Whisper STT)**:
   - **Barra de Chat Táctica**: se abre al hacer clic sobre el acompañante o con `Alt+Espacio`.
   - **Voz Local Push-to-Talk (`Ctrl+Espacio`)**: captura micrófono a 16 kHz y transcribe localmente con `@huggingface/transformers` (`whisper-tiny` ONNX) con 0 gasto de tokens y modelos en caché aislada.

5. **Iniciativa Proactiva Periódica**:
   - Configurable desde el menú de bandeja (`10m`, `25m`, `45m`, `1h`, `Desactivado`, por defecto: **25 minutos**).
   - Los personajes toman la iniciativa espontáneamente para comentar sobre la ventana activa (`fgTitle` / `fgApp`) o recomendarte pausas según su personalidad.

6. **Enrutador Multi-Cerebro (`BrainRouter`)**:
   - CLIs en modo Headless (`windowsHide: true`, pipes directos, 0 ventanas negras de consola):
     - **Antigravity CLI (`agy`)**
     - **Claude Code (`claude`)**
   - APIs Directas y Modelos Locales:
     - **Ollama Local** (`http://127.0.0.1:11434`)
     - **Google Gemini API** (`gemini-2.5-flash`)
     - **OpenAI API** (`gpt-4o-mini`)
     - **Anthropic Claude API** (`claude-3-5-sonnet-latest`)
   - Panel de Configuración modal para seleccionar proveedor, modelo y API Keys.

7. **Control de PC y Permisos en 2 Niveles (`ToolEngine`)**:
   - **Nivel 1 (Control Seguro, auto-aprobado)**:
     - `open_app_or_url`: aplicaciones, carpetas o URLs.
     - `media_and_volume`: volumen, mute, play/pause, siguiente pista y notificaciones.
     - `search_files`: búsqueda rápida de archivos en disco.
     - `read_clipboard` / `write_clipboard`: lectura y escritura de portapapeles.
     - `capture_active_window`: escaneo y diagnóstico de la ventana en primer plano.
     - `web_search`: búsqueda rápida en internet.
   - **Nivel 2 (Acciones Críticas, confirmación visual y sonora)**:
     - `run_shell_command` (PowerShell oculto), `write_or_edit_file` y `kill_process`.
     - El acompañante vuela a tu cursor con sonido de alerta y botones holográficos:
       `[ AUTORIZAR ]`, `[ PERMITIR SIEMPRE ESTE PREFIJO ]`, `[ DENEGAR ]`.

8. **Diccionario de Skills y Memoria de Usuario en `AI-DSL` Comprimido**:
   - `skills/INDEX.ctx`: catálogo ultra-descriptivo inyectado en el prompt inicial para ahorrar ~75% de tokens.
   - Herramientas `load_skill`, `save_skill` y `update_user_memory` para aprendizaje dinámico.
   - `skills/user-memory.example.ctx`: plantilla viva que se inicializa automáticamente en cada instalación sin mezclar datos personales en Git.

---

## ⌨ Atajos de Teclado Globales

| Atajo | Acción |
| :--- | :--- |
| `Alt + Espacio` | Abrir / cerrar barra de chat táctico |
| `Ctrl + Espacio` | Activar / desactivar reconocimiento de voz local (Push-to-Talk) |
| `Ctrl + Alt + C` | Alternar modo *Stow* (guardar personaje y dejar solo al acompañante) |
| `Esc` | Cerrar barra de chat o paneles modales abiertos |

---

## 🚀 Inicio Rápido

### Requisitos
- Windows 10 / 11
- Node.js (v20 o superior en tu PATH)

### Ejecución Directa (Sin Consola)
Haz doble clic sobre `ZeroMate.exe` o el acceso directo `ZeroMate.lnk` en la raíz del proyecto.

### Modo Desarrollo
```powershell
npm start

# O en modo con depurador y consola activa:
npm run dev
```

### Gestión de Hooks Pasivos
Desde el menú de la bandeja del sistema (ícono ZeroMate junto al reloj):
- **Puente de Hooks Pasivos -> Instalar Hooks en Antigravity (AGY)**
- **Puente de Hooks Pasivos -> Instalar Hooks en Claude Code**

O por comando:
```powershell
npm run hooks:install:agy
npm run hooks:install
```

---

## 📁 Estructura del Proyecto

```
zero-mate/
├── ZeroMate.exe             # Lanzador nativo sin ventana de consola (winexe)
├── ZeroMate.lnk             # Acceso directo con icono temático
├── hooks/                   # Forwarders pasivos de eventos para AGY y Claude
├── skills/                  # Diccionario maestro de skills y memoria en AI-DSL (.ctx)
│   ├── INDEX.ctx
│   └── user-memory.example.ctx
├── src/
│   ├── brains/              # Enrutador multi-proveedor (CLIs headless y APIs)
│   ├── main/                # Proceso principal de Electron, audio STT y rastreo de ventanas
│   ├── renderer/            # Motor WebGL de rigging 2D, shaders, audio y UI
│   └── tools/               # Motor de herramientas de PC de 2 niveles y permisos
├── themes/
│   └── nier-2b/             # Tema inicial: Sprites, sonidos y personalidad de 2B y Pod 042
└── tools/                   # Generadores y compilador del lanzador nativo
```

---

*ZeroMate — Multi-Theme Desktop AI Companion Engine.*
