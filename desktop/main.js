/**
 * Paperclip Desktop — Electron main process.
 * Runs the Paperclip server in-process (dynamic import), then opens the window.
 */

import { app, BrowserWindow, Tray, Menu, dialog, nativeImage, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const REPO_ROOT = isDev ? path.resolve(__dirname, "..") : process.resourcesPath;
const TRAY_ICON = path.join(__dirname, "icons", "tray-icon.png");

let mainWindow = null;
let tray = null;
let serverPort = 3100;
let isQuitting = false;

// ── Server ──────────────────────────────────────────────────────────

async function startServer() {
  // Find the server bundle
  let bundle;
  for (const c of [
    path.join(process.resourcesPath, "server-bundle.js"),
    path.join(__dirname, "server-bundle.js"),
  ]) {
    if (fs.existsSync(c)) { bundle = c; break; }
  }
  if (!bundle) {
    const d = path.join(REPO_ROOT, "server", "dist", "index.js");
    if (fs.existsSync(d)) bundle = d;
  }
  if (!bundle) {
    throw new Error("Server bundle not found. Build with: pnpm install && node scripts/build-desktop.mjs");
  }

  console.log("[desktop] Loading server:", bundle);

  process.env.PORT = String(serverPort);
  process.env.HOST = "127.0.0.1";
  process.env.PAPERCLIP_HOME = path.join(app.getPath("userData"), "paperclip-data");
  process.env.PAPERCLIP_INSTANCE_ID = "desktop";
  process.env.PAPERCLIP_DEPLOYMENT_MODE = "local_trusted";
  process.env.PAPERCLIP_MIGRATION_AUTO_APPLY = "true";
  process.env.PAPERCLIP_BIND = "loopback";
  process.env.PAPERCLIP_LOG_PLAIN = "true";
  process.env.NODE_ENV = "production";
  // pino transport workers need cwd where node_modules is reachable
  process.chdir(path.dirname(bundle));
  const bundleUrl = pathToFileURL(bundle).href;

  const m = await import(bundleUrl);
  const started = await m.startServer();
  serverPort = started.listenPort;
  console.log(`[desktop] Server ready on ${serverPort}`);
  return started;
}

// ── Window ──────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    title: "Paperclip",
    icon: path.join(__dirname, "icons", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting && tray) { event.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}

// ── Tray ────────────────────────────────────────────────────────────

function createTray() {
  let icon;
  try {
    icon = nativeImage.createFromPath(TRAY_ICON);
    if (!icon.isEmpty()) icon = icon.resize({ width: 16, height: 16 });
    else throw new Error("empty");
  } catch { icon = nativeImage.createEmpty(); }

  tray = new Tray(icon);
  tray.setToolTip("Paperclip");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show Paperclip", click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: "separator" },
    { label: "Quit Paperclip", click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on("double-click", () => { mainWindow?.show(); mainWindow?.focus(); });
}

// ── App ─────────────────────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const d = path.join(__dirname, "icons");
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

    createTray();

    try {
      await startServer();
      createWindow();
    } catch (err) {
      console.error("[desktop] Startup failed:", err);
      dialog.showErrorBox("Paperclip Startup Failed", err.message || String(err));
      app.quit();
    }
  });

  app.on("before-quit", () => { isQuitting = true; });
  app.on("activate", () => {
    if (!mainWindow) createWindow(); else mainWindow.show();
  });
}
