# Architecture

## Purpose
Animepahe DL Desktop is a universal desktop application that combines anime discovery, downloading, library management, and playback in a single cohesive experience. Built on Tauri 2 with React 18, it features a screen-based architecture with responsive navigation, state management via Zustand, and a powerful Rust backend for network operations and video processing.

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

## Frontend Architecture

### Directory Structure
```
src/
├── screens/           # Screen-level components (routes)
│   ├── home/         # HomeScreen - Dashboard and trending
│   ├── search/       # SearchScreen - Anime search
│   ├── title/        # TitleScreen - Anime details
│   ├── episodes/     # EpisodesScreen - Episode selection
│   ├── player/       # PlayerScreen - Video playback
│   ├── download/     # DownloadScreen - Download queue
│   ├── library/      # LibraryScreen - Local collection
│   ├── settings/     # SettingsScreen - App preferences
│   └── history/      # HistoryScreen - Watch history
├── ui/               # UI layer components
│   ├── components/   # Reusable UI components
│   │   ├── base/     # Basic elements (Button, Input, etc.)
│   │   ├── content/  # Content components (VideoPlayer, EpisodeRow, etc.)
│   │   ├── navigation/ # Navigation (BottomNav, DesktopHeader, MobileTopBar)
│   │   ├── filters/  # Filter components
│   │   ├── library/  # Library-specific components
│   │   └── queue/    # Download queue components
│   ├── layouts/      # Layout components (AppChrome)
│   ├── hooks/        # Custom React hooks
│   └── contexts/     # React contexts (ChromeSlots)
├── core/             # Core business logic
│   ├── animepahe/    # Animepahe API integration
│   ├── queue/        # Download queue manager
│   ├── store/        # Zustand stores
│   ├── types/        # TypeScript types
│   └── utils/        # Utility functions
└── App.tsx           # Root component with routing
```

### Navigation System

**Responsive Navigation**
- **Mobile (< md breakpoint)**:
  - `BottomNav` component with 5 tabs (Home, Search, Downloads, Library, Settings)
  - `MobileTopBar` with automatic back button detection for nested routes
  - Back button shows when route depth > 1 (e.g., `/title/:slug`)

- **Desktop (≥ md breakpoint)**:
  - `DesktopHeader` with horizontal navigation
  - Automatic back button appears before logo for nested routes
  - Route detection: `location.pathname.split('/').filter(Boolean).length > 1`

**Chrome Slots Pattern**
The `ChromeSlots` context provides dynamic UI injection:
- `setMobileTopBarTitle()` - Set screen title
- `setContextBar()` - Show context-sensitive actions (e.g., download bar)
- `clearSlots()` - Clean up on unmount

### State Management (Zustand)

**Core Stores**:
- `preference-store.ts` - User preferences (download dir, host URL, theme, threads)
- `library-store.ts` - Downloaded episodes, library metadata
- `player-store.ts` - Video player state, playback queue, PiP settings
- `history-store.ts` - Watch history, progress tracking
- `network-store.ts` - Network state, connectivity

All stores use Zustand with persistence middleware for automatic state saving.

### Screen Flow
1. **Home** → Browse trending/recent → Navigate to Title
2. **Search** → Find anime → Navigate to Title
3. **Title** → View details → Navigate to Episodes or Play episode
4. **Episodes** → Select episodes → Add to download queue → Navigate to Downloads
5. **Downloads** → Monitor progress → Auto-add to Library on completion
6. **Library** → Browse collection → Play episode → Navigate to Player
7. **Player** → Watch video → Save progress to History
8. **Settings** → Configure app preferences

## Backend Layer

### Core Modules
- **Entry**: `src-tauri/src/main.rs` - Wires plugins, registers command handlers, initializes video server
- **State management**: `settings.rs` - JSON persistence under OS config directory, session cookie tracking
- **HTTP API wrapper**: `api.rs` - Animepahe endpoints, episode resolution, playlist metadata
- **Scraper**: `scrape.rs` - Play page parsing, stream filtering, JavaScript execution via `boa_engine`
- **Downloader**: `download.rs` - Single/multi-threaded pipelines, progress tracking, state persistence
- **Video Server**: `video_server.rs` - Local HTTP server for library playback with proxy support
- **Watch History**: `watch_history.rs` - Track playback progress, resume positions
- **Player Integration**: `player.rs` - Video validation, local/remote source management
- **Command orchestration**: `commands.rs` - Tauri command handlers for all frontend operations

### New Backend Commands
- `validate_video_file` - Check if local file exists and is readable
- `get_local_video_url` - Generate localhost URL for library playback
- `get_library_entry` - Fetch library metadata for downloaded episode
- `check_episode_downloaded` - Verify if episode exists in library
- `resolve_video_url` - Extract HLS stream URL from embed page

### Download Pipeline
1. **Validation**: `check_requirements` asserts `node` and `ffmpeg` exist; failures short-circuit with a descriptive error the UI can surface.
2. **Episode resolution**: Selected numbers or spec patterns expand to concrete episode IDs, reusing cached release data where possible.
3. **Source selection**: `scrape::extract_candidates` scrapes candidate streams; `select_candidate` prefers requested audio/resolution, favouring kwik hosts.
4. **Playlist extraction**: `scrape::extract_m3u8_from_link` executes the obfuscated JavaScript with `boa_engine` to uncover the `.m3u8` URL without relying on system compilers.
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

## Video Playback Architecture

### Player Modes
1. **Local Playback**:
   - Files served via `video_server.rs` on localhost
   - Direct file access with proxy support for CORS
   - Automatic format detection and validation

2. **Remote Streaming**:
   - HLS stream resolution from embed URLs
   - Quality/audio source selection
   - Progressive loading with buffering

### Player Store Flow
```
playEpisode(episode) → Validate source → Update player state →
→ VideoPlayer component renders → Track progress → Save to history
```

## Extension Guidelines

### Adding New Screens
1. Create screen component in `src/screens/<name>/`
2. Add route in `App.tsx` with React Router
3. Update navigation components (`BottomNav`, `DesktopHeader`)
4. Use `ChromeSlots` context for dynamic UI (mobile top bar title, context bar)
5. Create or update relevant Zustand store for state management

### Adding Backend Capabilities
1. Define Tauri command in `src-tauri/src/commands.rs`
2. Create wrapper function in `src/core/animepahe/api.ts`
3. Define TypeScript types in `src/core/types/index.ts`
4. Update `check_requirements` if adding new dependencies
5. Emit progress events for long-running operations

### State Management Best Practices
- Use Zustand stores for cross-screen state
- Enable persistence for user preferences and session data
- Keep component state local when not needed elsewhere
- Use Chrome Slots for context-specific UI injection
- Clean up effects and slots on component unmount

### Navigation Patterns
- Automatic back button shows for nested routes (depth > 1)
- Use `navigate(-1)` for back navigation
- Use `navigate('/path')` for forward navigation
- Mobile and desktop navigation stay in sync via shared route state
