const fs = require('fs');

let code = fs.readFileSync('electron/main.ts', 'utf8');

const replacement = `function createWindow() {
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
}`;

code = code.replace(/function createWindow\(\) \{[\s\S]*?mainWindow = null;\n  \}\);\n\}/, replacement);

fs.writeFileSync('electron/main.ts', code);
