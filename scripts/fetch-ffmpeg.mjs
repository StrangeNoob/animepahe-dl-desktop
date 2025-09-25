#!/usr/bin/env node
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';

const require = createRequire(import.meta.url);
let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (error) {
  console.warn('[ffmpeg] Skipping bundle: ffmpeg-static not available for this platform.');
  process.exit(0);
}

if (!ffmpegPath) {
  console.warn('[ffmpeg] Skipping bundle: resolved path is empty.');
  process.exit(0);
}

const PLATFORM_MAP = {
  win32: { dir: 'windows', binary: 'ffmpeg.exe' },
  darwin: { dir: 'macos', binary: 'ffmpeg' },
  linux: { dir: 'linux', binary: 'ffmpeg' },
};

const platformInfo = PLATFORM_MAP[process.platform];
if (!platformInfo) {
  console.warn(`[ffmpeg] Unsupported platform: ${process.platform}. Skipping bundle.`);
  process.exit(0);
}

const repoRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(repoRoot, '..');
const targetDir = join(projectRoot, 'src-tauri', 'resources', 'ffmpeg', platformInfo.dir);
const targetPath = join(targetDir, platformInfo.binary);

async function bundle() {
  await fs.mkdir(targetDir, { recursive: true });
  await fs.copyFile(ffmpegPath, targetPath);
  if (process.platform !== 'win32') {
    await fs.chmod(targetPath, 0o755);
  }
  console.log(`[ffmpeg] Bundled binary copied to ${targetPath}`);
}

bundle().catch((error) => {
  console.warn(`[ffmpeg] Failed to bundle binary: ${error.message}`);
  process.exit(0);
});
