/**
 * Paperclip Desktop — preload script.
 *
 * Exposes a minimal, safe API to the renderer process via contextBridge.
 * The Paperclip web UI runs inside a sandboxed renderer and communicates
 * with the Electron main process only through this bridge.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("paperclipDesktop", {
  /** App version from package.json */
  getVersion: () => ipcRenderer.invoke("get-version"),

  /** Get the server base URL */
  getServerUrl: () => ipcRenderer.invoke("get-server-url"),

  /** Platform info */
  platform: process.platform,

  /** Is the app running in packaged (production) mode? */
  isPackaged: !process.defaultApp,

  /**
   * Listen for main-process events.
   * @param {string} channel
   * @param {(...args: any[]) => void} callback
   */
  on: (channel, callback) => {
    const validChannels = ["server-status", "app-version"];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },

  /**
   * Remove a listener.
   * @param {string} channel
   * @param {(...args: any[]) => void} callback
   */
  off: (channel, callback) => {
    const validChannels = ["server-status", "app-version"];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  },
});
