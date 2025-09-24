# Architecture

## Purpose
Animepahe DL Desktop wraps the original CLI downloader in a cross-platform desktop experience. A Tauri 2 container embeds a React 18 user interface while delegating network scraping and video processing to a Rust backend. The two halves talk exclusively through Tauri commands/events, keeping the UI sandboxed from direct filesystem and process access.

## Runtime Topology
```
┌────────────┐        invoke/emit        ┌────────────────────┐
│ React/Vite │ ─────────────────────────▶│ Tauri Rust backend │
│ (TypeScript│◀───────────────────────── │  (Tokio runtime)    │
│  components)│        state/events       └────────────────────┘
└────────────┘                                │
      │                                     ┌──┴───────────────┐
      │  window DOM/CSS                    │External binaries │
      ▼                                     │(ffmpeg, node)    │
```
- Frontend runs in a webview served by Vite during development (`npm run dev`) and pre-bundled assets in production (`npm run build`).
- Backend registers Tauri commands in `src-tauri/src/commands.rs` and holds shared state (`AppState`) for settings + session cookie.
- Background jobs (downloads, scraping) run on the Tokio async runtime and stream progress back to the UI via window events (`download-status`, `download-progress`).

## Frontend Layer
- **Entry**: `src/main.tsx` boots React and mounts `<App/>`.
- **Shell component**: `src/App.tsx` orchestrates the complete workflow—loading settings, search debounce, episode selection, preview modal, dependency prompts, and download initiation.
- **API bridge**: `src/api.ts` wraps `@tauri-apps/api/core.invoke`, translating TypeScript models (`src/types.ts`) to Rust payloads (law-of-demeter for the UI).
- **UI toolkit**: Tailwind CSS + shadcn/ui + Radix primitives power consistent controls. The `components/ui` directory holds thin wrappers (buttons, select, dialog, progress, etc.).
- **Autocomplete/search**: `components/ui/autocomplete.tsx` renders a floating portal dropdown and keyboard navigation, feeding throttled search queries back to App state.
- **Onboarding tour**: `components/tour` maintains a context provider, overlay spotlight, and tooltip placement logic. Steps are defined declaratively in `tourSteps.ts` and are toggled via user actions or the first-run default.
- **Requirements dialog**: `components/RequirementsDialog.tsx` displays dependency checks, provides install-guide links, and lets users rerun detection without restarting.

### React State Flow
1. **Startup**: `loadSettings` populates default preferences; dark/light theme toggles update the root element classes.
2. **Search**: Debounced `searchAnime` updates `searchResults`; selecting a result stores slug and resets downstream selections.
3. **Fetch Episodes**: `fetchEpisodes` fills cached episode metadata used across preview/download.
4. **Preview Sources**: `previewSources` requests detailed audio/resolution combinations and opens a modal table.
5. **Download**: `startDownload` kicks off backend processing while the UI subscribes to status/progress events to paint the right-hand panel.

## Backend Layer
- **Entry**: `src-tauri/src/main.rs` wires plugins (dialog) and registers command handlers.
- **State management**: `settings.rs` handles JSON persistence under the OS config directory and tracks a generated Animepahe cookie for consistent sessions.
- **HTTP API wrapper**: `api.rs` uses `reqwest` to call Animepahe endpoints, expand episode specs, and resolve playlist metadata.
- **Scraper**: `scrape.rs` parses the play page, filters AV1 streams, and uses an embedded QuickJS runtime to deobfuscate the playlist without needing external binaries.
- **Downloader**: `download.rs` implements both single-thread (`ffmpeg` copy) and multi-thread segment download/decrypt pipelines. Progress is surfaced through shared atomics and emitted as `download-progress` events.
- **Command orchestration**: `commands.rs` stitches everything together: preflight dependency checks, fetching, previewing, and the download loop that handles errors per episode while streaming user-facing status.

### Download Pipeline
1. **Validation**: `check_requirements` asserts `node` and `ffmpeg` exist; failures short-circuit with a descriptive error the UI can surface.
2. **Episode resolution**: Selected numbers or spec patterns expand to concrete episode IDs, reusing cached release data where possible.
3. **Source selection**: `scrape::extract_candidates` scrapes candidate streams; `select_candidate` prefers requested audio/resolution, favouring kwik hosts.
4. **Playlist extraction**: `scrape::extract_m3u8_from_link` runs the obfuscated JavaScript inside the bundled QuickJS engine to uncover the `.m3u8` URL.
5. **Transfer**:
   - *Single-thread*: Launch `ffmpeg` with custom headers; parse stderr to infer duration-based progress.
   - *Multi-thread*: Download playlist + TS chunks concurrently, optionally decrypt each segment with OpenSSL, then concatenate via `ffmpeg -f concat`.
6. **Status events**: Each phase emits a `download-status` update (fetching link, downloading, done/failed) and progress percentages when available.

## Settings & Persistence
- Stored as JSON at `$CONFIG_DIR/animepahe-dl/settings.json` with fields for download directory, theme preference, base host URL, and tour completion.
- `normalize_host` ensures URLs remain normalized when saved or read.
- The same settings struct is shared across frontend and backend to prevent drift.

## External Dependencies
- **Animepahe endpoints**: `/api?m=search`, `/api?m=release`, and anime pages for title resolution.
- **System binaries**: `ffmpeg` (HLS mux). Presence is checked dynamically using `which`.
- **Tokio runtime**: Powers async tasks, downloads, and timed operations.

## Build & Packaging
- Frontend: `npm run build` generates static assets in `dist/` with Vite.
- Desktop bundling: `npm run tauri build` invokes Rust `cargo build` and Tauri bundlers (DMG, MSI, AppImage, etc.) per `tauri.conf.json`.
- Dev loop: `npm run tauri dev` kicks off Vite (port 5173) and Tauri in watch mode.
- Shell scripts in the repo automate distribution packaging (`build.sh`, `generate-app.sh`, `generate-dmg.sh`), and the legacy CLI `animepahe-dl.sh` remains for reference/testing.

## Extension Guidelines
- Add new backend capabilities as Tauri commands in `commands.rs`, exposing lightweight wrappers in `src/api.ts`.
- Keep UI state changes localized to `AppContent` or custom hooks to maintain predictable flows.
- When adding new dependencies, update `check_requirements` and surface clear messaging in the requirements dialog.
- For download pipeline modifications, ensure progress events remain consistent to avoid breaking frontend rendering.
