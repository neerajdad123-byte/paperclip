/**
 * Paperclip Desktop — build pipeline.
 *
 * Usage: node scripts/build-desktop.mjs [dev|build|pack|dist]
 *
 * The desktop app uses the existing paperclipai CLI to start the server.
 * No custom server bundle needed.
 *
 * Steps:
 *   1. Build UI (Vite)            → ui/dist/
 *   2. Copy UI to desktop/        → desktop/ui-dist/
 *   3. (optional) Package with electron-builder
 */

import { execSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const desktopDir = resolve(repoRoot, "desktop");
const uiDist = resolve(repoRoot, "ui", "dist");
const desktopUiDist = resolve(desktopDir, "ui-dist");

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, {
    cwd: repoRoot,
    stdio: "inherit",
    ...opts,
  });
}

function step(label) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("=".repeat(60));
}

// ── Step 1: Build UI ────────────────────────────────────────────────
step("Building UI (Vite)");
run("pnpm --filter @paperclipai/ui build");

if (!existsSync(resolve(uiDist, "index.html"))) {
  console.error("ERROR: UI build failed — index.html not found in ui/dist/");
  process.exit(1);
}

// ── Step 2: Copy UI to desktop ──────────────────────────────────────
step("Copying UI to desktop/ui-dist/");
if (existsSync(desktopUiDist)) {
  rmSync(desktopUiDist, { recursive: true });
}
cpSync(uiDist, desktopUiDist, { recursive: true });
console.log("  Done.");

// ── Step 3: Package (optional) ──────────────────────────────────────
const command = process.argv[2] || "build";

if (command === "pack" || command === "dist") {
  step("Packaging with electron-builder");
  const target = command === "dist" ? "--win" : "--win --dir";
  run("npx electron-builder " + target, { cwd: desktopDir });
  console.log(`\n  Output: ${resolve(desktopDir, "dist-electron")}`);
  // Post-build: create node_modules junction so Electron resolves externals
  const unpacked = resolve(desktopDir, "dist-electron", "win-unpacked");
  const resourcesNm = resolve(unpacked, "resources", "node_modules");
  if (existsSync(unpacked) && !existsSync(resourcesNm)) {
    try {
      execSync(`cmd /c "mklink /J \\"${resourcesNm}\\" \\"${desktopNm}\\""`, { stdio: "pipe" });
      console.log("  Created resources/node_modules junction");
    } catch { /* junction may already exist */ }
  }
  // Copy package.json so server finds its version
  const pkgJson = resolve(desktopDir, "package.json");
  const targetPkgJson = resolve(unpacked, "package.json");
  if (existsSync(unpacked) && existsSync(pkgJson)) {
    cpSync(pkgJson, targetPkgJson);
    console.log("  Copied package.json to win-unpacked/");
  }
} else {
  console.log(`\n  Build complete. To run in dev mode:`);
  console.log(`    cd desktop && npx electron .`);
}

console.log(`\n${"=".repeat(60)}`);
console.log("  Paperclip Desktop build finished.");
console.log("=".repeat(60));
