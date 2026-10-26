# AGENTS.md — Development Guidelines for AI Agents & Contributors

This document defines the strict branching workflow and language conventions for **ZeroMate**. All AI coding agents and human contributors must follow these rules.

---

## 1. Gitflow Workflow (Mandatory)

Direct commits to `main` are strictly forbidden.

### Branch Structure
- **`main`**: Production releases and stable tags only. Never commit directly to `main`.
- **`develop`**: Primary integration and development branch. All feature work branches off `develop` and merges back into `develop`.
- **`feat/*`**: New features or capabilities (e.g., `feat/english-default-and-bilingual-docs`).
- **`fix/*`**: Bug fixes.
- **`refactor/*`**: Code restructuring without behavioral changes.
- **`docs/*`**: Documentation updates.

### Lifecycle of a Change
1. Always branch off `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feat/<descriptive-name>
   ```
2. Make clean, granular commits with conventional commit messages in **English**:
   - `feat(...)`: new feature
   - `fix(...)`: bug fix
   - `docs(...)`: documentation only
   - `refactor(...)`: refactoring
   - `chore(...)`: maintenance, dependencies, releases
3. Merge back into `develop` using non-fast-forward (`--no-ff`):
   ```bash
   git checkout develop
   git merge --no-ff feat/<descriptive-name>
   ```
4. Only release merges to `main` happen from `develop` when tagging a milestone release.

---

## 2. Language & Localization Conventions

### Primary Language: English (`en`)
- **Default Language**: The codebase, default application settings, system tray labels, CLI prompts, error messages, code comments, and commit messages must be written in **English** by default.
- **Primary Documentation**: `README.md` must be written entirely in English.
- **Skills Directory (`skills/`)**: File names in `skills/` and `skills/INDEX.ctx` must be named in English (e.g., `diagnose-active-window-error.ctx`, `clean-heavy-ram-processes.ctx`, `organize-downloads-folder.ctx`), and their contents must use English annotations and prompts.
- **Design Docs (`docs/`)**: All architecture, plan, and walkthrough documents in `docs/` must be maintained in English.

### Secondary Language: Spanish (`es`)
- **Bilingual Documentation**: Provide a complete Spanish version of the readme at `README.es.md`.
  - First line of `README.md`: `**English** · [Español](README.es.md)`
  - First line of `README.es.md`: `[English](README.md) · **Español**`
- **Runtime Language Support**: The application configuration (`src/main/config.js`) supports `lang: 'en' | 'es' | 'auto'`. The tray menu allows toggling between English and Spanish, and dialogue tables / system prompts adapt dynamically to the user's selected language.

---

## 3. Strict Operating Rules
- **No Console Popups**: Child processes must always use `windowsHide: true` and pipe `stdio`.
- **Portability**: Never hardcode user-specific paths or machine usernames. Use relative project paths (`path.join(__dirname, ...)`), `os.homedir()`, or standard system environment variables (`process.env.PATH`).
- **User Memory Isolation**: Do not commit personal user data or machine-specific memory. Maintain `skills/user-memory.example.ctx` in the repository, with `skills/user-memory.ctx` ignored by Git and bootstrapped on first launch.

---

## 4. Release Management & Alpha Versioning Guidelines

When preparing releases or milestone updates, follow these requirements:

### Versioning Rules
- Version numbers in `package.json` follow Semantic Versioning with pre-release tags for alphas (e.g., `0.3.1-alpha.1`).
- Tag releases on Git using `v<version>` (e.g., `git tag v0.3.1-alpha.1`).

### Release Notes Format
Every release published on GitHub and documented in this file must follow the human, warm, and evocative bilingual format:
1. **Highlights ("Better" / "Mejor")**: Focus on what feels better in motion, tactile feedback, audio-visual synergy, animation fluidity, edge cleanliness, and bug resolutions.
2. **Installation Instructions**:
   - Provide direct Windows setup executable reference (`ZeroMate-Setup-<version>.exe`).
   - Mention the Windows SmartScreen unsigned executable workaround (*"More info › Run anyway"* / *"Más información › Ejecutar de todas formas"*).
   - Hook persistence notice (*"Already plugged into Claude Code or Antigravity? Nothing to redo"*).
3. **Bilingual Presentation**: Full English version first, followed by the Spanish (*"Mejor"*) translation.
4. **Artifacts & Checksums**: Always list the installer executable, SHA256 hash, and file size.

---

## 5. Alpha Release History

### v0.3.1-alpha.1

#### Better
- **Her ceiling hang is now truly upside down.** Instead of awkwardly standing upright mid-air near the top bezel, 2B has a dedicated inverted sprite with her gothic skirt and silver hair draping downward with gravity, boots anchored right to the monitor frame, and Pod 042 hovering gracefully beside her as a tactical sentinel. When she lets go, she drops down with realistic gravity physics to the nearest ledge or floor.
- **Weapon inspection with traveling glint.** When inspecting the Virtuous Treaty greatsword, the blade floats into the foreground with a warm golden YoRHa aura, 2B glides her gloved fingers along the edge while a brilliant diamond gleam travels down the blade, Pod 042 pings a diagnostic scan, and she finishes with a crisp 360° wrist-flick sheathe.
- **Epic YoRHa victory celebration.** When a task completes, 2B performs an acrobatic somersault leap with a massive crescent energy slash arc, landing into a mid-air blade spin that locks into her back halo with a resounding metallic snap and dual shockwaves. Pod 042 does a celebratory 360° aerial backflip with golden fireworks and joyful chirps.
- **Real-time terminal authorization alert.** Whenever Claude Code or Antigravity requests command permission in the terminal, ZeroMate immediately triggers the red/amber alert: Pod 042 intercepts your cursor and the YoRHa holographic modal opens with `[ ALLOW ]` / `[ DENY ]`.
- **Preloaded textures & smoother refresh.** Character textures are loaded during boot so transitions never stutter.
- **Cleaner edges.** Chroma-key green spill is completely eliminated on Pod 042, katana, and 2B sprites, leaving razor-sharp anime outlines with zero fringe.

#### Install (Windows)
- Download `ZeroMate-Setup-0.3.1-alpha.1.exe` below and run it (it seamlessly updates previous versions).
- The installer isn't signed with an expensive enterprise certificate: if Windows SmartScreen says *"Windows protected your PC"*, click **More info** › **Run anyway**.
- Already plugged her into Claude Code or Antigravity? Nothing to redo, hooks update automatically.
- Everything new in 0.3.0 is documented in the release notes.

---

#### Mejor
- **Su pose colgada del techo ahora está verdaderamente de cabeza.** En lugar de flotar erguida de pie cerca del marco superior con el Pod encima, 2B estrena un sprite dedicado invertido con su falda gótica y cabello plateado cayendo por gravedad hacia abajo, botas ancladas firmemente al borde superior y Pod 042 flotando a su lado como centinela táctico. Al soltarse, cae con físicas suaves de gravedad hasta el suelo o el marco de tu ventana activa.
- **Inspección de katana con destello móvil.** Al inspeccionar *Contrato Virtuoso*, la espada levita al frente con un aura dorada YoRHa. 2B desliza sus dedos enguantados mientras un destello brillante de 4 puntas recorre el filo de la hoja, Pod 042 emite un escaneo diagnóstico y concluye con un ágil giro de muñeca de 360° antes de encajar en el halo.
- **Celebración de victoria épica al estilo NieR.** Al completar una directiva, 2B realiza un salto mortal acrobático descargando un tajo en arco de energía creciente, aterrizando en pose baja y enfundando la hoja en el aire con un sonoro golpe metálico y doble onda de choque concéntrica. Pod 042 celebra haciendo un giro mortal de 360° (backflip) en el aire con fuegos artificiales digitales dorados y gorjeos felices.
- **Alerta de autorización interactiva desde la terminal.** Cuando Claude Code o Antigravity solicitan confirmación de comandos en la terminal, ZeroMate activa la alarma rojo/ámbar: Pod 042 vuela hacia tu cursor y despliega el modal holográfico YoRHa con botones `[ AUTORIZAR ]` / `[ DENEGAR ]`.
- **Texturas precargadas y sin tirones.** Todas las texturas se cargan antes del despliegue, sincronizándose con la tasa de refresco del monitor sin microcortes.
- **Bordes limpios sin rebaba verde.** Se eliminó por completo el remanente verde de croma en los sprites de Pod 042, la katana y 2B, dejando bordes nítidos de anime sin aberraciones de color.

#### Instalación (Windows)
- Descarga `ZeroMate-Setup-0.3.1-alpha.1.exe` abajo y ejecútalo (actualiza versiones anteriores automáticamente).
- El instalador no cuenta con certificado comercial: si Windows SmartScreen muestra *"Windows protegió su PC"*, haz clic en **Más información** › **Ejecutar de todas formas**.
- ¿Ya la tenías vinculada a Claude Code o Antigravity? No necesitas reconfigurar nada; los hooks se actualizan solos.

---

### Assets
* `ZeroMate-Setup-0.3.1-alpha.1.exe` (~115 MB)
* `Source code (zip)`
* `Source code (tar.gz)`
