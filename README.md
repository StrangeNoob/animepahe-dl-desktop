# Animepahe DL Desktop

Animepahe DL Desktop is now a Tauri + React application with a Rust backend. It modernises the original `animepahe-dl.sh` experience, keeping the fast downloader pipeline while delivering a polished desktop UI. This GUI is heavily based on the excellent CLI tool [KevCui/animepahe-dl](https://github.com/KevCui/animepahe-dl/), reusing its ergonomics while layering on a desktop-first experience.

![Animepahe DL Desktop showing the episode grid, filters, and download status](Screenshot.png)

## Highlights

- 🔍 Guided discovery: search Animepahe, review matches, and apply slugs instantly.
- 🎯 Precision controls: filter by resolution/audio, enter specs (`1,3-5,*`), or tick episodes from a checklist.
- 📦 Source preview modal: inspect audio/resolution blends before downloading.
- 🚀 Robust pipeline: ffmpeg single-thread mode with stderr progress plus multi-thread segment download/decrypt/concat.
- 🔄 Smart resume downloads: auto-detect incomplete downloads on startup, validate file integrity, and resume from where you left off.
- 🗂️ Persistent settings: theme, base URL, and download folder stored in the OS config dir.
- 🛠️ CI-ready: GitHub Actions produces installers/archives for macOS, Windows, and Linux.

## Tech Stack

- React 18 + Vite front end bundled inside a Tauri shell
- Tailwind CSS and shadcn/ui (Radix primitives) for styling and components
- Neon-glassmorphism desktop UI with gradient accents and vector icons
- Rust 2021 backend with `tokio`, `reqwest`, `scraper`, and `regex`
- Embedded JavaScript evaluation via pure-Rust `boa_engine` for playlist deobfuscation across macOS/Windows/Linux
- macOS crash fix via `winit` ≥ 0.30.12 and `objc2` + `objc2-foundation` built with the `relax-sign-encoding` feature
- External binaries: `ffmpeg`, `node` (detected at runtime)

## Prerequisites

Install on your machine before building:

- [Rust toolchain](https://rustup.rs/) (stable channel)
- [Node.js](https://nodejs.org/) 18+ and npm/pnpm/yarn
- [ffmpeg](https://ffmpeg.org/)

### Detailed Installation Guides

For detailed, OS-specific installation instructions for each requirement:

- **[Node.js Installation Guide](requirements/NodeJS.md)** - Required for the React/Vite build tooling during development
- **[FFmpeg Installation Guide](requirements/FFMPEG.md)** - Required for video processing
- **[OpenSSL Installation Guide](requirements/OpenSSL.md)** - Required for encrypted content (multi-threaded downloads only)

At runtime the desktop app only depends on `ffmpeg`; Node.js is needed solely for local development/build steps.

### Bundled ffmpeg binaries

The Tauri bundle looks for a platform-specific `ffmpeg` executable under `src-tauri/resources/ffmpeg/<platform>/` (copied into the app bundle at build time):

- macOS: `src-tauri/resources/ffmpeg/macos/ffmpeg`
- Windows: `src-tauri/resources/ffmpeg/windows/ffmpeg.exe`
- Linux: `src-tauri/resources/ffmpeg/linux/ffmpeg`

If you place the appropriate binary in these folders before running `npm run tauri build`, the packaged app will prefer the bundled copy. When the folder is empty the app automatically falls back to the system `ffmpeg` on `PATH`.

## Quick Start

```bash
git clone https://github.com/<your-account>/animepahe-dl.git
cd animepahe-dl
npm install # installs tailwind, shadcn/ui dependencies, radix primitives
npm run tauri dev
```

This spins up the Vite dev server with hot reload inside the Tauri shell.

### Build & Package

```bash
npm run build          # bundles the React front end
npm run tauri build    # produces installers/archives per platform
```

Output goes to `src-tauri/target/release/` (DMG/ZIP on macOS, MSI/EXE on Windows, AppImage/deb/tar on Linux depending on target).

### Backend-only

```bash
cargo fmt -p animepahe-tauri
cargo check -p animepahe-tauri --locked
cargo build -p animepahe-tauri --release --locked
```

## Using the App

1. **Search** – enter a title and click "Search".
2. **Apply** – select a result to fill the slug automatically.
3. **Fetch** – pull the episode catalogue, then tick entries or type a spec (`1,3-5,*`).
4. **Preview** – open "Preview sources" to inspect audio/resolution streams.
5. **Download** – adjust threads, choose the output folder, and start. Progress events stream live to the UI.
6. **Resume** – if downloads are interrupted, the app auto-detects them on next launch and shows a notification banner. Click "Resume Downloads" to see all incomplete downloads, validate files, and continue from where you left off.

Theme, base URL, and output directory are editable on the toolbar and persist between runs.

### Download State Persistence

All download progress is automatically tracked and saved to `~/.config/animepahe-dl/download_state.json` (or equivalent OS config directory). This includes:

- Download status (in-progress, completed, failed, cancelled)
- Progress tracking (downloaded bytes, file size, timestamps)
- Episode metadata (anime name, slug, audio/resolution settings)
- Error messages for failed downloads

The app automatically detects incomplete downloads on startup and offers to resume them. You can also manually access the resume dialog via the toolbar button.

## Analytics & Privacy

Animepahe DL Desktop includes **optional, privacy-conscious analytics** to help us improve the app. Analytics are **enabled by default** but can be disabled at any time.

### What We Track

We collect **anonymous usage data** to understand how the app is used and identify areas for improvement:

- **User Actions**: Search, selection, and download events (counts and durations only)
- **App Usage**: Launch, session duration, settings changes
- **Feature Usage**: Tour interactions, requirements checks
- **Performance**: Search speed, download speed, startup time (all categorized)
- **Errors**: Error types only (no messages, stack traces, or personal data)

### What We DON'T Track

We take your privacy seriously and **never collect**:

- ❌ Anime titles or search queries
- ❌ File names or paths
- ❌ Personal information
- ❌ IP addresses (PostHog anonymization)
- ❌ Exact error messages or stack traces
- ❌ System specifications beyond OS type

### How to Disable Analytics

**In the App:**
1. Toggle off "Share anonymous usage data" in the settings section
2. Click "View Details" to see exactly what's tracked
3. Use the Analytics Dashboard to reset your ID or clear data

**Via Environment Variables:**

Create a `.env` file in the project root:

```env
# Disable analytics completely
VITE_ENABLE_ANALYTICS=false

# Or configure PostHog (optional)
VITE_POSTHOG_KEY=your_posthog_key_here
VITE_POSTHOG_HOST=https://app.posthog.com
```

**For Developers:**

If you're building from source, analytics are automatically disabled in development mode unless explicitly configured.

### Learn More

For complete details about data collection and your rights:
- View the [Privacy Policy](PRIVACY.md)
- Check the in-app Analytics Dashboard (Settings → View Details)

## Packaging & Releases

- `npm run tauri build` bundles the front end and emits cross-platform artifacts.
- The GitHub workflow in `.github/workflows/release.yml` runs on pushes to the `release` branch, builds installers for macOS (Intel + Apple Silicon), Windows, and Linux, and drafts the corresponding GitHub Release.

## Development Checklist

```bash
cargo fmt -p animepahe-tauri
cargo check -p animepahe-tauri --locked
npm run lint   # add ESLint/Prettier if desired
```

## License

MIT – see [`LICENSE`](LICENSE).
