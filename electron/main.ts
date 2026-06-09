import { app, BrowserWindow, dialog } from "electron";
import * as path from "path";
import { fork, ChildProcess } from "child_process";
import { fileURLToPath } from "url";
import * as http from "http";

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

function waitForServer(url: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = 250; // Check every 250ms

    function check() {
      const req = http.get(url, (res) => {
        // Any response (even 451, 404, etc.) means the server is online and responding!
        resolve();
      });

      req.on("error", (err) => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error(`Tiempo de espera agotado para el servidor local en ${url}: ${err.message}`));
        } else {
          setTimeout(check, interval);
        }
      });

      // Avoid TCP socket hanging infinitely
      req.setTimeout(1000, () => {
        req.destroy();
      });
    }

    check();
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

  const loadUrl = "http://localhost:3000";
  mainWindow.loadURL(loadUrl).catch((err) => {
    console.log("Fallo al cargar URL, reintentando...", err);
    setTimeout(() => {
      mainWindow?.loadURL(loadUrl);
    }, 1000);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackend();

  const serverUrl = "http://localhost:3000";
  const timeoutLimit = 15000; // 15 seconds limit

  waitForServer(serverUrl, timeoutLimit)
    .then(() => {
      createWindow();
    })
    .catch((err) => {
      console.error(err);
      dialog.showErrorBox(
        "Error de Inicio - Prepmaster Live",
        "No se pudo establecer conexión con el servidor interno de la aplicación.\n\nDetalle:\n" +
        err.message + 
        "\n\nPor favor, intenta reiniciar la aplicación o verifica que el puerto 3000 no se encuentre en uso por otro programa."
      );
      if (serverProcess) {
        serverProcess.kill();
      }
      app.quit();
    });

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
