# Animepahe DL Desktop

A cross-platform Rust/egui desktop client for Animepahe. The app modernises the original `animepahe-dl.sh` script with a responsive, production-ready UI and is structured to showcase full-stack engineering skills in a portfolio or CV.

## Highlights

- 🔍 Guided discovery: search Animepahe, review matches, and apply slugs instantly.
- 🎯 Precision controls: filter by resolution/audio, enter episode specs (`1,3-5,*`), or tick episodes from a checklist.
- 📦 Source preview modal: inspect audio/resolution variants before committing to a download.
- 🚀 Robust pipeline: ffmpeg-based single-thread mode with live progress parsing; multi-thread mode parallelises segment fetch/decrypt/concat.
- 🗂️ Persistent settings: theme, base URL, and download directory are stored in the user's config directory.
- 🛠️ CI-ready: GitHub Actions workflow produces packaged artifacts for macOS, Windows, and Linux.

<p align="center"><em>Screenshot of the refreshed interface, featuring grouped panels, search results, and progress trackers.</em></p>

## Tech Stack

- Rust 2021 + `tokio` runtime for async orchestration
- `egui` / `eframe` for cross-platform desktop UI
- `reqwest`, `scraper`, `regex` for HTTP and HTML processing
- External tools: `ffmpeg`, `node`, `openssl` (detected at runtime)

## Prerequisites

Install these tools on the machine where you run or build the app:

- [Rust toolchain](https://rustup.rs/) (stable)
- [ffmpeg](https://ffmpeg.org/)
- [Node.js](https://nodejs.org/)
- [OpenSSL CLI](https://www.openssl.org/) (only required when Threads > 1)

## Quick Start

```bash
git clone https://github.com/<your-account>/animepahe-dl.git
cd animepahe-dl
cargo run --release
```

The optimised binary is written to `target/release/animepahe-dl-desktop`. Launch it directly or package it with the licence/readme.

## Run & Build Locally

```bash
cargo run             # debug build + launches the GUI
cargo build --release # optimised binary at target/release/
```

Use `cargo install --path .` if you want a globally available binary.

## Using the App

1. **Search** – enter an anime name and click “Search by name”.
2. **Apply** – highlight a result and choose “Use selection” to populate the slug/UUID.
3. **Fetch** – fetch episodes, then either type an episode spec (`1,3-5,*`) or tick entries from the list.
4. **Preview** – open “Preview sources” to verify available audio/resolution streams.
5. **Download** – set thread count, choose the output folder, and start. Progress bars display ffmpeg timing or segment completion.

Theme, base URL, and download directory live in the toolbar and persist between sessions.

## Packaging & Releases

- **Manual build** – run `cargo build --release` on each OS. Distribute the binary with `README_DESKTOP.md` and `LICENSE` (zip/tar as desired).
- **Automated workflow** – `.github/workflows/release.yml` builds Linux (`.tar.gz`), macOS (`.zip`), and Windows (`.zip`) archives. Trigger it with a `v*` tag or via the GitHub “Run workflow” button.

## Development Checklist

```bash
cargo fmt        # formatting
cargo check      # fast type/lint pass
cargo build --release
```

The legacy shell script remains for reference, but the desktop app is the primary experience.

## License

MIT – see [`LICENSE`](LICENSE).
