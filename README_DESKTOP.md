Animepahe DL Desktop (Tauri + React + Rust)

Overview
- Cross-platform Tauri shell with a React front end and a Rust backend.
- Mirrors the capabilities of `animepahe-dl.sh` while providing a modern UI, taking cues from the original CLI project [KevCui/animepahe-dl](https://github.com/KevCui/animepahe-dl/).

Features
- Search Animepahe by title and auto-fill the slug.
- Enter episode specs (`1,3-5,*`) or tick checkboxes for precise selection.
- Filter by resolution/audio, preview available sources per episode.
- Download through ffmpeg (threads = 1) or parallel segment mode (threads > 1) with AES-128 decryption and concat.
- Persist theme, host URL, and download directory across launches.

Requirements
- Node.js (18+) – used for the React front end and for unpacking the obfuscated player script.
- Rust toolchain – builds the Tauri backend.
- ffmpeg – required for both streaming and concatenation.
- macOS note: the project depends on `winit` ≥ 0.30.12 with `objc2`’s `relax-sign-encoding` feature to avoid Sonoma monitor enumeration crashes.

Build
1. Install dependencies: `npm install`.
2. Launch dev shell: `npm run tauri dev`.
3. Produce installers: `npm run tauri build`.

Notes
- Cookie: the backend generates a random `__ddg2_` cookie for each session.
- Host URL: configurable in the toolbar; persisted to the OS config dir.
- Parallel decrypt assumes IV=0 (matching the shell script behaviour).
- Without Node on PATH the m3u8 unpacking step will fail; future work could embed a JS engine to remove this dependency.

Troubleshooting
- Ensure `ffmpeg` and `node` binaries are discoverable on PATH.
- If downloads appear stalled, watch the console: decrypt and concat phases now log progress so you can confirm the job is still running.

Distribution
- Run `npm run tauri build` on each target OS. Artifacts are emitted under `src-tauri/target/release/bundle/`.
- The GitHub workflow `.github/workflows/release.yml` builds the same bundles for Linux/macOS/Windows on tag pushes or manual dispatch.
