process.env.DEBUG = ""; // Desactiva mensajes de depuración

const { app, BrowserWindow } = require('electron');
require('@electron/remote/main').initialize()

function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 600,
        resizable: false,
        maximizable: false,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            contextIsolation: false,
        }
    });

    require("@electron/remote/main").enable(win.webContents)
    win.loadFile('index.html');

    // Open the DevTools.
    // win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
