import { app, BrowserWindow } from "electron";
import * as path from "path";
import { fork, ChildProcess } from "child_process";
import { fileURLToPath } from "url";

// Get standard dir names since we are using esbuild to compile
const _dirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

let serverProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

function startBackend() {
  const dbPath = path.join(app.getPath("userData"), "prepmaster.db");
  const parentDir = path.dirname(dbPath);
  
  console.log("Directorio persistente SQLite:", parentDir);
  console.log("Archivo SQLite:", dbPath);

  const env = {
    ...process.env,
    NODE_ENV: isDev ? "development" : "production",
    IS_ELECTRON: "true",
    PREPMASTER_DB_PATH: dbPath,
    PORT: "3000"
  };

  if (isDev) {
    // In dev, the dev server is run concurrently or spawned.
    // Let's spawn tsx server.ts
    const serverPath = path.join(_dirname, "../server.ts");
    const tsxBin = path.join(_dirname, "../node_modules/tsx/dist/cli.mjs");
    serverProcess = fork(tsxBin, [serverPath], { env });
  } else {
    // In production, load the compiled dist/server.cjs
    const serverPath = path.join(_dirname, "../dist/server.cjs");
    serverProcess = fork(serverPath, [], { env });
  }

  serverProcess.on("exit", (code) => {
    console.log(`El servidor Express terminó con código: ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    title: "Prepmaster Live",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Remove default menus, keep reload etc. in development
  if (!isDev) {
    mainWindow.setMenuBarVisibility(false);
  }

  // Poll server or simply wait 2 seconds before loading
  const loadUrl = "http://localhost:3000";
  setTimeout(() => {
    mainWindow?.loadURL(loadUrl).catch((err) => {
      console.log("Fallo al cargar URL, reintentando...", err);
      setTimeout(() => {
        mainWindow?.loadURL(loadUrl);
      }, 2000);
    });
  }, isDev ? 3500 : 2000);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
