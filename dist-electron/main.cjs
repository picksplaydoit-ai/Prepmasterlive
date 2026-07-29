var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var path = __toESM(require("path"), 1);
var import_child_process = require("child_process");
var import_url = require("url");
var http = __toESM(require("http"), 1);
var fs = __toESM(require("fs"), 1);
var import_meta = {};
var _dirname = typeof __dirname !== "undefined" ? __dirname : path.dirname((0, import_url.fileURLToPath)(import_meta.url));
var serverProcess = null;
var mainWindow = null;
var backendStartTime = 0;
var isDev = process.env.NODE_ENV === "development" || !import_electron.app.isPackaged;
function startBackend() {
  const dbPath = path.join(import_electron.app.getPath("userData"), "prepmaster.db");
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
  const compiledServerPath = path.join(_dirname, "../dist/server.cjs");
  if (fs.existsSync(compiledServerPath)) {
    console.log("Iniciando backend compilado CJS:", compiledServerPath);
    serverProcess = (0, import_child_process.fork)(compiledServerPath, [], { env });
  } else if (isDev) {
    console.log("Servidor compilado no encontrado, iniciando con tsx...");
    const serverPath = path.join(_dirname, "../server.ts");
    const tsxBin = path.join(_dirname, "../node_modules/tsx/dist/cli.mjs");
    serverProcess = (0, import_child_process.fork)(tsxBin, [serverPath], { env });
  } else {
    import_electron.dialog.showErrorBox(
      "Error de Servidor",
      "No se encontr\xF3 el archivo de servidor compilado en dist/server.cjs"
    );
    import_electron.app.quit();
    return;
  }
  serverProcess.on("exit", (code, signal) => {
    console.log(`El servidor Express termin\xF3 con c\xF3digo: ${code} y se\xF1al: ${signal}`);
  });
}
function waitForServer(url, timeoutMs, serverProc) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const intervalMs = 250;
    let timer = null;
    let isFinished = false;
    const onExit = (code, signal) => {
      if (isFinished) return;
      isFinished = true;
      if (timer) clearTimeout(timer);
      reject(new Error(`El proceso del servidor backend termin\xF3 inesperadamente (c\xF3digo ${code}, se\xF1al ${signal}) antes de estar listo.`));
    };
    if (serverProc) {
      serverProc.on("exit", onExit);
    }
    function finish(err) {
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
            finish(new Error(`Tiempo de espera agotado para el servidor local en ${url}: Respondi\xF3 con c\xF3digo HTTP ${res.statusCode} en lugar de 200.`));
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
      req.setTimeout(1e3, () => {
        req.destroy();
      });
    }
    check();
  });
}
function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1240,
    height: 820,
    title: "Prepmaster Live",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (!isDev) {
    mainWindow.setMenuBarVisibility(false);
  }
  const loadUrl = "http://localhost:3000";
  mainWindow.loadURL(loadUrl).catch((err) => {
    console.log("Fallo al cargar URL, reintentando...", err);
    setTimeout(() => {
      mainWindow?.loadURL(loadUrl);
    }, 1e3);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
import_electron.app.whenReady().then(() => {
  startBackend();
  const serverUrl = "http://localhost:3000";
  const timeoutLimit = 3e4;
  waitForServer(serverUrl, timeoutLimit, serverProcess).then(() => {
    const respondedTime = Date.now();
    console.log(`[${new Date(respondedTime).toISOString()}] Hora en que el puerto respondi\xF3.`);
    console.log(`Tiempo total de arranque en milisegundos: ${respondedTime - backendStartTime}ms`);
    createWindow();
  }).catch((err) => {
    console.error(err);
    import_electron.dialog.showErrorBox(
      "Error de Inicio - Prepmaster Live",
      "No se pudo establecer conexi\xF3n con el servidor interno de la aplicaci\xF3n.\n\nDetalle:\n" + err.message + "\n\nPor favor, intenta reiniciar la aplicaci\xF3n o verifica que el puerto 3000 no se encuentre en uso por otro programa."
    );
    if (serverProcess) {
      serverProcess.kill();
    }
    import_electron.app.quit();
  });
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
import_electron.app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== "darwin") {
    import_electron.app.quit();
  }
});
import_electron.app.on("will-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
