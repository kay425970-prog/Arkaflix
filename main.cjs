/**
 * Electron main process for the Arkaflix Windows/Linux desktop build.
 *
 * electron-builder looks for this file via the "main" field in package.json.
 * It loads the already-built front-end from dist/ and opens it in a
 * frameless-ish native window. Nothing else — no telemetry, no auto-update
 * until you opt in by installing electron-updater.
 */
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 420,
    minHeight: 560,
    backgroundColor: "#050505",
    autoHideMenuBar: true,
    title: "Arkaflix",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Open external links (IMDb, subtitle sites, embed providers) in the real
  // browser rather than navigating the app window away from the UI.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    // macOS: re-create the window when the dock icon is clicked.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
