import { contextBridge, ipcRenderer } from "electron";

// Expose the backend port to the renderer process so the API client
// can build its base URL (e.g. http://localhost:8042/api).
contextBridge.exposeInMainWorld("__BACKEND_PORT__", undefined);

// The actual port value is injected via a <script> tag that Electron's
// main process writes into the HTML before loading it.  This preload
// script simply ensures contextIsolation is satisfied.
