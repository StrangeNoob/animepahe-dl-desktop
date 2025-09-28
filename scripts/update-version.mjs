#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const NEWLINE = "\n";
const __dirname = fileURLToPath(new URL(".", import.meta.url));

async function main() {
  const [, , newVersion] = process.argv;
  if (!newVersion) {
    console.error("Usage: node scripts/update-version.mjs <new-version>");
    process.exit(1);
  }

  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?$/.test(newVersion)) {
    console.error(`Invalid version \"${newVersion}\". Use semver format (e.g. 1.2.3 or 1.2.3-beta).`);
    process.exit(1);
  }

  const projectRoot = resolve(__dirname, "..");

  await Promise.allSettled([
    updatePackageJson(projectRoot, newVersion),
    updatePackageLock(projectRoot, newVersion),
    updateCargoToml(projectRoot, newVersion),
    updateTauriConfig(projectRoot, newVersion),
  ]);

  console.log(`Updated project version to ${newVersion}`);
}

async function updatePackageJson(root, version) {
  const path = resolve(root, "package.json");
  const raw = await readFile(path, "utf8");
  const json = JSON.parse(raw);
  json.version = version;
  await writeFile(path, JSON.stringify(json, null, 2) + NEWLINE, "utf8");
}

async function updatePackageLock(root, version) {
  const path = resolve(root, "package-lock.json");
  if (!existsSync(path)) return;
  const raw = await readFile(path, "utf8");
  const json = JSON.parse(raw);
  json.version = version;
  if (json.packages && json.packages[""]) {
    json.packages[""] = {
      ...json.packages[""],
      version,
    };
  }
  await writeFile(path, JSON.stringify(json, null, 2) + NEWLINE, "utf8");
}

async function updateCargoToml(root, version) {
  const path = resolve(root, "src-tauri/Cargo.toml");
  const raw = await readFile(path, "utf8");
  const lines = raw.split(/\r?\n/);
  let inPackage = false;
  const updated = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) {
      inPackage = trimmed === "[package]";
      return line;
    }
    if (inPackage && trimmed.startsWith("version")) {
      return line.replace(/version\s*=\s*".*"/, `version = "${version}"`);
    }
    return line;
  });
  await writeFile(path, updated.join("\n"), "utf8");
}

async function updateTauriConfig(root, version) {
  const path = resolve(root, "src-tauri/tauri.conf.json");
  const raw = await readFile(path, "utf8");
  const json = JSON.parse(raw);
  json.version = version;
  await writeFile(path, JSON.stringify(json, null, 2) + NEWLINE, "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
