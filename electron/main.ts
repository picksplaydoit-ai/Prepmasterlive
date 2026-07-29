import { app, BrowserWindow, dialog } from "electron";
import * as path from "path";
import { fork, ChildProcess } from "child_process";
import { fileURLToPath } from "url";
import * as http from "http";
import * as fs from "fs";

// Get standard dir names since we are using esbuild to compile
const _dirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

let serverProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let backendStartTime: number = 0;

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

  backendStartTime = Date.now();
  console.log(`[${new Date(backendStartTime).toISOString()}] Hora de inicio del backend...`);

  // Prefer loading the compiled CJS server bundle if it exists (very fast & stable, no runtime TS compilation/Vite overhead)
  const compiledServerPath = path.join(_dirname, "../dist/server.cjs");
  if (fs.existsSync(compiledServerPath)) {
    console.log("Iniciando backend compilado CJS:", compiledServerPath);
    serverProcess = fork(compiledServerPath, [], { env });
  } else if (isDev) {
    // Fallback to tsx on the raw server.ts if not compiled yet
    console.log("Servidor compilado no encontrado, iniciando con tsx...");
    const serverPath = path.join(_dirname, "../server.ts");
    const tsxBin = path.join(_dirname, "../node_modules/tsx/dist/cli.mjs");
    serverProcess = fork(tsxBin, [serverPath], { env });
  } else {
    dialog.showErrorBox(
      "Error de Servidor",
      "No se encontró el archivo de servidor compilado en dist/server.cjs"
    );
    app.quit();
    return;
  }

  serverProcess.on("exit", (code, signal) => {
    console.log(`El servidor Express terminó con código: ${code} y señal: ${signal}`);
  });
}

function waitForServer(url: string, timeoutMs: number, serverProc: ChildProcess | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const intervalMs = 250; // Check every 250ms
    let timer: NodeJS.Timeout | null = null;
    let isFinished = false;

    const onExit = (code: number | null, signal: string | null) => {
      if (isFinished) return;
      isFinished = true;
      if (timer) clearTimeout(timer);
      reject(new Error(`El proceso del servidor backend terminó inesperadamente (código ${code}, señal ${signal}) antes de estar listo.`));
    };

    if (serverProc) {
      serverProc.on("exit", onExit);
    }

    function finish(err?: Error) {
      if (isFinished) return;
      isFinished = true;
      if (timer) clearTimeout(timer);
      if (serverProc) serverProc.removeListener("exit", onExit);
      
      if (err) reject(err);
      else resolve();
    }

    function check() {
      if (isFinished) return;

      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          finish();
        } else {
          if (Date.now() - startTime > timeoutMs) {
            finish(new Error(`Tiempo de espera agotado para el servidor local en ${url}: Respondió con código HTTP ${res.statusCode} en lugar de 200.`));
          } else {
            timer = setTimeout(check, intervalMs);
          }
        }
      });

      req.on("error", (err) => {
        if (isFinished) return;
        if (Date.now() - startTime > timeoutMs) {
          finish(new Error(`Tiempo de espera agotado (${timeoutMs}ms) intentando conectar a ${url}. Detalle: ${err.message}`));
        } else {
          timer = setTimeout(check, intervalMs);
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

  const startUrl = "http://localhost:3000";
  console.log("Intentando cargar frontend en:", startUrl);
  
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("Error cargando frontend:", errorCode, errorDescription);
  });

  mainWindow.loadURL(startUrl).catch((err) => {
    console.log("Fallo al cargar URL, reintentando...", err);
    setTimeout(() => {
      mainWindow?.loadURL(startUrl);
    }, 1000);
  });
  
  mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackend();

  const serverUrl = "http://localhost:3000";
  const timeoutLimit = 30000; // 30 seconds limit

  waitForServer(serverUrl, timeoutLimit, serverProcess)
    .then(() => {
      const respondedTime = Date.now();
      console.log(`[${new Date(respondedTime).toISOString()}] Hora en que el puerto respondió.`);
      console.log(`Tiempo total de arranque en milisegundos: ${respondedTime - backendStartTime}ms`);
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
