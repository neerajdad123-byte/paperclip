# Paperclip Desktop

Desktop wrapper for [Paperclip](https://github.com/paperclipai/paperclip) — the control plane for AI agent companies.

## Quick Start (Dev Mode)

From the repo root:

```sh
pnpm install
pnpm desktop:dev
```

This builds the UI, bundles the server, and launches the Electron app.

## Build & Package

```sh
# Build only (no packaging)
pnpm desktop:build

# Package for Windows (creates installer in desktop/dist-electron/)
pnpm desktop:dist
```

## Architecture

```
desktop/
  main.js              Electron main process — spawns server, manages window + tray
  preload.js           Safe IPC bridge for renderer
  server-bundle.js     esbuild-bundled Paperclip server (generated)
  ui-dist/             Built React UI (generated, copied from ui/dist/)
  icons/               App and tray icons
  dist-electron/       Packaged output (generated)
```

### How It Works

1. `main.js` spawns `server-bundle.js` as a child process
2. Polls `http://127.0.0.1:3100/api/health` until the server is ready
3. Opens a BrowserWindow pointing at the server
4. System tray icon for minimize/restore/quit
5. On app quit, gracefully stops the server

### Data Location

All Paperclip data (DB, config, workspaces) is stored under:
- Windows: `%APPDATA%/Paperclip/paperclip-data/`
- macOS: `~/Library/Application Support/Paperclip/paperclip-data/`
- Linux: `~/.config/Paperclip/paperclip-data/`

### Single Instance

Only one Paperclip Desktop instance can run at a time. Opening the app again
focuses the existing window.

## Dev Notes

- The server bundle (`server-bundle.js`) is built with esbuild from `server/src/index.ts`
- All `@paperclipai/*` workspace packages are bundled; npm packages with native
  binaries (embedded-postgres, sharp) remain external in node_modules
- UI static files are served from `desktop/ui-dist/` (copied from Vite build output)
- The server listens on `127.0.0.1:3100` by default (loopback only)
