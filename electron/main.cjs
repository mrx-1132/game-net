const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { startRemoteServer } = require('./remote-server.cjs');
const { createLicenseManager } = require('./license.cjs');

let mainWindow;

function createWindow() {
  // Determine icon path for window and taskbar
  const iconPath = path.join(__dirname, '../public/icon.png');

  mainWindow = new BrowserWindow({
    title: 'سامانه هوشمند مدیریت گیم‌نت | GameNet Manager',
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
      // DevTools فقط در حالت توسعه
      devTools: !app.isPackaged,
    },
    backgroundColor: '#0B0E14', // Match the app's dark background
    show: false,
  });

  // Load the built index.html from dist folder
  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(indexPath).catch((err) => {
    console.error('Failed to load index.html:', err);
  });

  // Once ready, show the window
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Auto hide administrative menu bar for production feel
  mainWindow.removeMenu();
  
  // Custom minimal menu (or none at all)
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock to prevent duplicate windows
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    const license = createLicenseManager({ getWindow: () => mainWindow });
    createWindow();
    // ریموت فقط با اشتراک فعالی که امکان ریموت دارد کار می‌کند
    startRemoteServer(() => mainWindow, { isAllowed: () => license.hasFeature('remote') });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
