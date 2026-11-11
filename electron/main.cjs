const { app, BrowserWindow, Menu, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

// ---------- لاگ و نمایش خطا (قبل از هر چیز دیگر) ----------
// اگر برنامه روی سیستمی بالا نیاید، علتش در این فایل نوشته می‌شود:
//   %APPDATA%\GameNetManager\logs\main.log
let logFile = null;
function log(...parts) {
  try {
    if (!logFile) {
      const dir = path.join(app.getPath('userData'), 'logs');
      fs.mkdirSync(dir, { recursive: true });
      logFile = path.join(dir, 'main.log');
      if (fs.existsSync(logFile) && fs.statSync(logFile).size > 1024 * 1024) fs.renameSync(logFile, `${logFile}.old`);
    }
    const line = parts.map((p) => (p instanceof Error ? p.stack || p.message : String(p))).join(' ');
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${line}\n`);
  } catch { /* ignore */ }
}

let fatalShown = false;
function fatal(title, err) {
  log('FATAL', title, err);
  if (fatalShown) return;
  fatalShown = true;
  const msg = err && err.message ? err.message : String(err);
  try {
    dialog.showErrorBox('خطا در اجرای برنامه گیم‌نت', `${title}\n\n${msg}\n\nجزئیات در فایل:\n${logFile || '(لاگ ساخته نشد)'}`);
  } catch { /* ignore */ }
}
process.on('uncaughtException', (e) => fatal('خطای پیش‌بینی‌نشده', e));
process.on('unhandledRejection', (e) => log('unhandledRejection', e));

log('start', `v${app.getVersion()}`, `electron ${process.versions.electron}`, `${process.platform} ${process.arch}`, require('os').release());

// ---------- کارت گرافیک قدیمی / درایور خراب ----------
// اگر پردازش گرافیک یک بار کرش کند، از آن به بعد بدون شتاب سخت‌افزاری اجرا می‌شود.
const gpuFlag = path.join(app.getPath('userData'), 'disable-gpu');
if (fs.existsSync(gpuFlag) || process.argv.includes('--disable-gpu')) {
  log('hardware acceleration disabled');
  app.disableHardwareAcceleration();
}
app.on('child-process-gone', (_e, d) => {
  log('child-process-gone', d.type, d.reason, d.exitCode);
  if (d.type === 'GPU' && !['clean-exit', 'killed'].includes(d.reason) && !fs.existsSync(gpuFlag)) {
    try { fs.writeFileSync(gpuFlag, '1'); } catch { /* ignore */ }
    app.relaunch();
    app.exit(0);
  }
});

let startRemoteServer, createLicenseManager, createUpdater;
try {
  ({ startRemoteServer } = require('./remote-server.cjs'));
  ({ createLicenseManager } = require('./license.cjs'));
  ({ createUpdater } = require('./updater.cjs'));
} catch (e) {
  fatal('بارگذاری اجزای برنامه ناموفق بود', e);
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'سامانه هوشمند مدیریت گیم‌نت | GameNet Manager',
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    icon: path.join(__dirname, '../dist/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
      // DevTools فقط در حالت توسعه
      devTools: !app.isPackaged,
    },
    backgroundColor: '#0B0E14',
    show: false,
  });

  const showWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return;
    mainWindow.maximize();
    mainWindow.show();
  };
  mainWindow.once('ready-to-show', showWindow);
  // اگر ready-to-show نیامد (مثلاً مشکل گرافیک)، بعد از چند ثانیه به هر حال نشان بده
  setTimeout(showWindow, 5000);

  const wc = mainWindow.webContents;
  wc.on('did-fail-load', (_e, code, desc, url) => {
    log('did-fail-load', code, desc, url);
    showWindow();
    dialog.showErrorBox('خطا در باز شدن صفحه برنامه', `${desc} (${code})\n\nجزئیات در فایل:\n${logFile}`);
  });
  wc.on('render-process-gone', (_e, d) => {
    log('render-process-gone', d.reason, d.exitCode);
    if (d.reason === 'clean-exit') return;
    const r = dialog.showMessageBoxSync(mainWindow, {
      type: 'error',
      title: 'خطا',
      message: 'صفحه برنامه به‌طور ناگهانی بسته شد.',
      detail: `علت: ${d.reason}\nلاگ: ${logFile}`,
      buttons: ['بارگذاری دوباره', 'خروج'],
      defaultId: 0,
    });
    if (r === 0) wc.reload(); else app.quit();
  });
  wc.on('console-message', (_e, level, message) => { if (level >= 3) log('renderer error', message); });

  mainWindow.loadFile(path.join(__dirname, '../dist/index.html')).catch((err) => log('loadFile failed', err));

  mainWindow.removeMenu();
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock to prevent duplicate windows
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log('another instance is running; focusing it');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    try {
      const license = createLicenseManager({ getWindow: () => mainWindow });
      createWindow();
      // ریموت فقط با اشتراک فعالی که امکان ریموت دارد کار می‌کند
      startRemoteServer(() => mainWindow, {
        isAllowed: () => license.hasFeature('remote'),
        // لینک دانلود اپ اندروید روی سرور لایسنس (برای QR در تنظیمات ریموت)
        getApkUrl: () => { const base = license.servers()[0]; return base ? `${base}/remote.apk` : null; },
      });
      try {
        createUpdater({ license, getWindow: () => mainWindow, log });
      } catch (e) {
        log('updater init failed', e); // آپدیت نباید جلوی کار برنامه را بگیرد
      }
      log('ready');
    } catch (e) {
      fatal('راه‌اندازی برنامه ناموفق بود', e);
      if (!mainWindow) app.quit();
    }

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
