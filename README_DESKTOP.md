Animepahe DL Desktop (Rust/egui)

Overview
- Desktop app that mirrors features of `animepahe-dl.sh` using Rust.
- GUI built with egui/eframe; async networking via reqwest/tokio.

Features
- Search by name (fills slug) and/or enter slug manually.
- Pick episodes via text spec: `1,3-5,*`.
- Filter by resolution (e.g., `1080`) and audio (e.g., `eng`, `jpn`).
- List m3u8 only (no download) toggle.
- Download via ffmpeg (single-thread) or parallel segment download (set Threads > 1) with OpenSSL decrypt + ffmpeg concat.

Requirements
- Node.js: used to unpack obfuscated script to extract the `.m3u8` link.
- ffmpeg: required for HLS download and final concatenation.
- openssl (CLI): required when Threads > 1 for AES-128-CBC decrypt.

Build
1. Ensure Rust toolchain is installed (rustup + cargo).
2. Build and run: `cargo run --release`.

Notes
- Cookie: app generates a random `__ddg2_` like the script and sends it with requests.
- Host: configurable from the toolbar; updates persist between launches.
- Parallel decrypt: replicates script behavior using IV=0. Some HLS streams may specify IV differently; support can be extended.
- If Node is not available, m3u8 extraction will fail. A future enhancement is embedding a JS engine (e.g., `boa`) to avoid the Node dependency.

Troubleshooting
- If you get "node not found" or "ffmpeg not found", install those binaries and ensure they are on PATH.
- If downloads stall, try single-thread mode (Threads = 1) to let ffmpeg handle HLS.

Distribution
- Local: run `cargo build --release` on the target OS. The optimized binary will be in `target/release/`. Package it together with `README_DESKTOP.md` and `LICENSE` for distribution.
- CI workflow: the repository includes `.github/workflows/release.yml` which builds release archives for Linux (`.tar.gz`), macOS (`.zip`), and Windows (`.zip`). Trigger it via a `v*` tag push or manually through the GitHub “Run workflow” button. Resulting artifacts are uploaded under the workflow run.
