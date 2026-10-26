**English** · [Español](README.es.md)

# ZeroMate — Multi-Theme Desktop Agent Engine

> A modular multi-theme desktop AI companion engine for Windows featuring **Semantic Action Slots**, WebGL 2D skeletal shader rigging on transparent PNG cutouts, real-time window ledge tracking, hybrid interactions, and headless local/cloud AI brain routing.
> **Default Starter Theme**: *NieR: Automata (2B + Pod 042)* in `themes/nier-2b/`.

---

## ❖ Key Features

1. **Pixel-Accurate Click-Through Transparent Overlay**:
   - Frameless, borderless, `alwaysOnTop` ('screen-saver') Electron window spanning your entire workspace.
   - Evaluates click-through transparency on a per-pixel basis across characters, companions, and active HUD panels.
   - Any click outside character hitboxes or interface plates passes straight through to your underlying workflow apps.

2. **Live Window Ledge Tracking (`windows.ps1`)**:
   - The active character autonomously patrols the top titlebar of your focused application window, sits down swinging their legs, and travels with the window as you drag it.
   - If the window is minimized or closed, realistic gravity physics trigger, causing the character to drop and land gracefully onto the next available window ledge or desktop floor.

3. **Multi-Theme Architecture via *Semantic Action Slots* (`ThemeEngine`)**:
   - Themes in `themes/<id>/` wire their unique character sprites, rigging animations, and acoustic feedback to universal semantic slots:
     - `sit_window`: walk along window top titlebars and sit dangling legs.
     - `traverse`: aerial gliding or traversal held by the companion.
     - `idle_quirk`: unique idle gestures (e.g., inspecting weapon, adjusting visor, resting).
     - `companion_interact`: rubbing the companion with circular cursor movements to trigger pleasant chirps and affection reactions.
     - `poke_annoyed`: fast slash or defensive reaction if repeatedly poked or shaken with the mouse.
     - `tool_work`: companion laser scanning, diagnostics, or tactical assist animation.
     - `alert_confirm`: companion intercepts the user's cursor with alert acoustics requesting security authorization.
     - `victory`: celebratory flair or weapon sheathing animation upon finishing an operation.
     - `stow` (`Ctrl+Alt+C`): character dematerializes back to headquarters via energy beam, leaving only the companion hovering as a silent sentry.

4. **Hybrid Interaction & Zero-Token Local Speech-to-Text (Whisper ONNX)**:
   - **Tactical Command HUD**: Click on the companion or press `Alt+Space` to summon a holographic command bar.
   - **Local Push-to-Talk (`Ctrl+Space`)**: High-speed microphone capture resampled to 16 kHz and transcribed completely offline via `@huggingface/transformers` (`whisper-tiny` ONNX). 100% private, 0 API tokens spent, caching strictly within local project storage.

5. **Configurable Periodic Proactive Initiative**:
   - Configurable from system tray (`10m`, `25m`, `45m`, `1h`, `Disabled`, default: **25 minutes**).
   - Characters periodically take the initiative to comment in-character on your currently focused window title (`fgTitle` / `fgApp`) or suggest healthy breaks.

6. **Headless Multi-Brain Router (`BrainRouter`)**:
   - Headless CLI Providers (`windowsHide: true`, direct stdio pipes, 0 black console popups):
     - **Antigravity CLI (`agy`)**
     - **Claude Code (`claude`)**
   - Direct Cloud APIs & Local LLMs:
     - **Ollama Local** (`http://127.0.0.1:11434`)
     - **Google Gemini API** (`gemini-2.5-flash`)
     - **OpenAI API** (`gpt-4o-mini`)
     - **Anthropic Claude API** (`claude-3-5-sonnet-latest`)
   - Holographic settings modal to configure active provider, custom model names, and API keys.

7. **Two-Tier System Tools & Holographic Authorization (`ToolEngine`)**:
   - **Tier 1 (Safe Control, Auto-Approved)**:
     - `open_app_or_url`: launch installed applications, directory paths, or web links.
     - `media_and_volume`: volume control, mute, play/pause, track skipping, and native Windows notifications.
     - `search_files`: fast disk indexing and recursive search.
     - `read_clipboard` / `write_clipboard`: system clipboard reading and writing.
     - `capture_active_window`: active window reconnaissance and screen diagnostics.
     - `web_search`: instant web search queries.
   - **Tier 2 (Critical Operations, Visual & Acoustic Confirmation)**:
     - `run_shell_command` (hidden PowerShell/CMD), `write_or_edit_file`, and `kill_process`.
     - Companion flies to cursor with alarm audio displaying an interactive authorization modal:
       `[ APPROVE ]`, `[ ALWAYS ALLOW THIS PREFIX ]`, `[ DENY ]`.

8. **Compressed Token-Optimized AI-DSL Skills & User Memory**:
   - `skills/INDEX.ctx`: lightweight catalog injected into prompts to save ~75% of context tokens.
   - Built-in tools `load_skill`, `save_skill`, and `update_user_memory` for dynamic progressive skill learning.
   - `skills/user-memory.example.ctx`: clean template automatically initialized per user on first launch without polluting Git.

---

## ⌨ Global Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Alt + Space` | Toggle holographic tactical chat bar |
| `Ctrl + Space` | Toggle local speech-to-text voice recognition (Push-to-Talk) |
| `Ctrl + Alt + C` | Toggle *Stow* mode (send character to Bunker and keep sentry companion) |
| `Esc` | Close open HUD panels, modals, or chat bar |

---

## 🚀 Quick Start

### Prerequisites
- Windows 10 / 11 (64-bit)
- Node.js (v20 or higher installed in your system PATH)

### Direct Launch (Zero Console Windows)
Double-click `ZeroMate.exe` (or the shortcut `ZeroMate.lnk`) in the project root.

### Development Mode
```powershell
npm start

# Or in debug mode with detached DevTools console:
npm run dev
```

### Passive IDE Hook Bridge
From the system tray menu (ZeroMate icon in taskbar notification area):
- **Passive Hook Bridge -> Install Hooks into Antigravity (AGY)**
- **Passive Hook Bridge -> Install Hooks into Claude Code**

Or via terminal:
```powershell
npm run hooks:install:agy
npm run hooks:install
```

---

## 📁 Project Structure

```
zero-mate/
├── ZeroMate.exe             # Silent native subsystem launcher (winexe, no console window)
├── ZeroMate.lnk             # Windows desktop / start menu shortcut
├── hooks/                   # Lightweight passive event forwarders for AGY & Claude Code
├── skills/                  # Master skill index and compressed AI-DSL memory (.ctx)
│   ├── INDEX.ctx
│   └── user-memory.example.ctx
├── src/
│   ├── brains/              # Multi-provider brain router (Headless CLIs & Cloud/Local APIs)
│   ├── main/                # Electron main process, local Whisper STT & window watcher
│   ├── renderer/            # WebGL 2D rigging engine, GLSL shaders, audio bank & HUD
│   └── tools/               # 2-Tier PC control tool engine and permission handlers
├── themes/
│   └── nier-2b/             # Starter Theme: 2B & Pod 042 sprites, sounds & personality
└── tools/                   # Audio generators and native launcher compiler
```

---

*ZeroMate — Multi-Theme Desktop AI Companion Engine.*
