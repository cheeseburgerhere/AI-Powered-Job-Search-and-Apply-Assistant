import { app, BrowserWindow, screen } from "electron";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as net from "net";

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------
let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let backendPort: number = 8000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find a free TCP port on localhost. */
function findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const addr = server.address();
            if (addr && typeof addr === "object") {
                const port = addr.port;
                server.close(() => resolve(port));
            } else {
                reject(new Error("Could not determine port"));
            }
        });
    });
}

/** Resolve a path relative to the app resources directory. */
function resourcePath(...segments: string[]): string {
    // In production the backend binary lives inside the app's resources folder.
    // During development we fall back to the project root.
    const base = app.isPackaged
        ? path.join(process.resourcesPath)
        : path.join(__dirname, "..", "..");
    return path.join(base, ...segments);
}

// ---------------------------------------------------------------------------
// Backend lifecycle
// ---------------------------------------------------------------------------

function startBackend(port: number): void {
    const isWin = process.platform === "win32";
    const binaryName = isWin ? "ai-job-backend.exe" : "ai-job-backend";
    const binaryPath = resourcePath("backend-dist", "ai-job-backend", binaryName);

    console.log(`[electron] Starting backend at ${binaryPath} on port ${port}`);

    backendProcess = spawn(binaryPath, ["--port", String(port)], {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
    });

    backendProcess.stdout?.on("data", (data: Buffer) => {
        console.log(`[backend] ${data.toString().trim()}`);
    });

    backendProcess.stderr?.on("data", (data: Buffer) => {
        console.error(`[backend] ${data.toString().trim()}`);
    });

    backendProcess.on("close", (code) => {
        console.log(`[electron] Backend process exited with code ${code}`);
        backendProcess = null;
    });
}

function stopBackend(): void {
    if (backendProcess) {
        console.log("[electron] Stopping backend process…");
        backendProcess.kill();
        backendProcess = null;
    }
}

// ---------------------------------------------------------------------------
// Window lifecycle
// ---------------------------------------------------------------------------

async function createWindow(): Promise<void> {
    backendPort = await findFreePort();

    startBackend(backendPort);

    // Small delay to let uvicorn bind the port
    await new Promise((r) => setTimeout(r, 2500));

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: Math.min(1400, width),
        height: Math.min(900, height),
        title: "AI Job Assistant",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    // In development load the Vite dev server; in production load the built
    // index.html that lives next to this script.
    if (!app.isPackaged) {
        await mainWindow.loadURL("http://localhost:5173");
    } else {
        await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
    }

    // Inject the backend port into the renderer so the API client knows
    // which port to connect to.
    mainWindow.webContents.executeJavaScript(
        `window.__BACKEND_PORT__ = ${backendPort};`
    );

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

// ---------------------------------------------------------------------------
// App events
// ---------------------------------------------------------------------------

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    stopBackend();
    app.quit();
});

app.on("before-quit", () => {
    stopBackend();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
