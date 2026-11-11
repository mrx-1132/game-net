// آپدیت آنلاین برنامه (فقط نسخه نصبی ویندوز)
// ۱) از سرور لایسنس می‌پرسد نسخه جدیدی برای این لایسنس هست یا نه (با همان توکن امضاشده لایسنس)
// ۲) امضای manifest را با کلید عمومی آپدیت (electron/update-public.pem) چک می‌کند؛
//    کلید خصوصی فقط روی کامپیوتر توسعه‌دهنده است، پس حتی سرور هک‌شده هم نمی‌تواند آپدیت جعلی بفرستد.
// ۳) فایل را دانلود (با قابلیت ادامه) و sha512 را با manifest تطبیق می‌دهد
// ۴) با تأیید اپراتور، یا موقع بستن برنامه، نصب بی‌صدا انجام می‌شود
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { app, ipcMain } = require('electron');

const TEST = process.env.GAMENET_UPDATER_TEST === '1';
const FIRST_CHECK_MS = TEST ? 2000 : 90 * 1000;
const CHECK_EVERY_MS = TEST ? 15000 : 6 * 3600 * 1000;

function compareVersions(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}

function loadKeys() {
  const keys = [];
  for (const f of fs.readdirSync(__dirname)) {
    if (!/^update-public.*\.pem$/.test(f)) continue;
    try { keys.push(crypto.createPublicKey(fs.readFileSync(path.join(__dirname, f), 'utf8'))); } catch { /* skip bad key */ }
  }
  return keys;
}

function sha512File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha512');
    fs.createReadStream(file).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('base64'))).on('error', reject);
  });
}

function createUpdater({ license, getWindow, log = () => {} }) {
  const keys = loadKeys();
  const dir = path.join(app.getPath('userData'), 'updates');
  const current = app.getVersion();
  let state = { status: 'idle', currentVersion: current };
  let checking = false;
  let installing = false;
  let readyFile = null;

  // چه زمانی آپدیت خودکار کار نمی‌کند
  let disabledReason = null;
  if (keys.length === 0) disabledReason = 'no_key';
  else if (process.env.PORTABLE_EXECUTABLE_DIR) disabledReason = 'portable';
  else if (!TEST && (!app.isPackaged || process.platform !== 'win32')) disabledReason = 'dev';
  if (disabledReason) state = { status: 'disabled', reason: disabledReason, currentVersion: current };
  log('updater', disabledReason ? `disabled (${disabledReason})` : 'enabled', `v${current}`);

  let lastSent = '';
  let lastProgressAt = 0;
  function set(patch, force) {
    state = { ...state, ...patch, currentVersion: current };
    const now = Date.now();
    if (!force && state.status === 'downloading' && now - lastProgressAt < 500) return;
    lastProgressAt = now;
    const json = JSON.stringify(state);
    if (json === lastSent) return;
    lastSent = json;
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('update:changed', state);
  }

  function verifySignature(raw, sigB64) {
    const sig = Buffer.from(String(sigB64 || ''), 'base64');
    return keys.some((k) => { try { return crypto.verify(null, Buffer.from(raw, 'utf8'), k, sig); } catch { return false; } });
  }

  async function download(base, urlPath, file, target) {
    const part = `${target}.part`;
    let have = 0;
    try { have = fs.statSync(part).size; } catch { /* new download */ }
    if (have > file.size) { fs.rmSync(part, { force: true }); have = 0; }
    const res = await fetch(base + urlPath, { headers: have ? { Range: `bytes=${have}-` } : {}, signal: AbortSignal.timeout(30 * 60 * 1000) });
    if (res.status === 200) have = 0; // سرور ادامه را قبول نکرد؛ از اول
    else if (res.status !== 206) throw new Error(`HTTP ${res.status}`);
    let got = have;
    const counter = new (require('stream').Transform)({
      transform(chunk, _enc, cb) {
        got += chunk.length;
        set({ status: 'downloading', progress: Math.min(99, Math.floor((got / file.size) * 100)) });
        cb(null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(res.body), counter, fs.createWriteStream(part, { flags: have ? 'a' : 'w' }));
    if (fs.statSync(part).size !== file.size) throw new Error('size mismatch');
    if ((await sha512File(part)) !== file.sha512) { fs.rmSync(part, { force: true }); throw new Error('sha512 mismatch'); }
    fs.renameSync(part, target);
  }

  async function check(manual) {
    if (disabledReason || checking || installing) return state;
    if (state.status === 'ready' && readyFile) return state;
    const token = license.getToken();
    if (!token || license.status().state !== 'active') return state;
    checking = true;
    if (manual) set({ status: 'checking', message: undefined }, true);
    try {
      for (const base of license.servers()) {
        let r;
        try {
          const res = await fetch(`${base}/api/update/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, deviceId: license.deviceId, version: current, arch: process.arch }),
            signal: AbortSignal.timeout(20000),
          });
          r = await res.json();
        } catch (e) {
          log('update check failed', base, e.message);
          continue; // سرور بعدی
        }
        if (!r || !r.available) { set({ status: 'idle', lastCheck: Date.now(), message: undefined }, true); return state; }

        // فقط به manifest امضاشده اعتماد می‌کنیم، نه به بقیه پاسخ سرور
        if (!verifySignature(r.manifest, r.signature)) throw new Error('امضای آپدیت نامعتبر است؛ نصب نمی‌شود.');
        const m = JSON.parse(r.manifest);
        const file = m.files && m.files[process.arch];
        if (m.app !== 'gamenet-manager' || m.version !== r.version || compareVersions(m.version, current) <= 0 || !file) {
          throw new Error('اطلاعات آپدیت با نسخه این برنامه نمی‌خواند.');
        }
        if (typeof r.url !== 'string' || !r.url.startsWith('/api/update/file/') || !/^[A-Za-z0-9._-]+$/.test(file.name)) {
          throw new Error('آدرس دانلود نامعتبر است.');
        }

        const vdir = path.join(dir, m.version);
        fs.mkdirSync(vdir, { recursive: true });
        // نسخه‌های قدیمی دانلودشده را پاک کن
        for (const d of fs.readdirSync(dir)) if (d !== m.version) fs.rmSync(path.join(dir, d), { recursive: true, force: true });
        const target = path.join(vdir, file.name);
        const already = fs.existsSync(target) && fs.statSync(target).size === file.size && (await sha512File(target)) === file.sha512;
        if (!already) {
          set({ status: 'downloading', version: m.version, notes: m.notes || '', progress: 0, message: undefined }, true);
          await download(base, r.url, file, target);
        }
        readyFile = target;
        log('update ready', m.version);
        set({ status: 'ready', version: m.version, notes: m.notes || '', progress: 100, message: undefined }, true);
        return state;
      }
      if (manual) set({ status: 'error', message: 'اتصال به سرور آپدیت برقرار نشد.' }, true);
    } catch (e) {
      log('update error', e);
      set({ status: 'error', message: e.message || 'خطا در دریافت آپدیت.' }, true);
    } finally {
      checking = false;
    }
    return state;
  }

  function runInstaller(relaunch) {
    if (!readyFile || installing) return false;
    installing = true;
    log('installing update', readyFile, relaunch ? '(relaunch)' : '(on quit)');
    if (TEST) return true;
    const args = ['/S'];
    if (relaunch) args.push('--force-run');
    spawn(readyFile, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    return true;
  }

  ipcMain.handle('update:status', () => state);
  ipcMain.handle('update:check', () => check(true));
  ipcMain.handle('update:install', () => {
    if (!runInstaller(true)) return false;
    setTimeout(() => app.quit(), 300);
    return true;
  });

  // اگر اپراتور «بعداً» زد، موقع بستن برنامه نصب می‌شود (بار بعد نسخه جدید باز می‌شود)
  app.on('before-quit', () => { if (state.status === 'ready') runInstaller(false); });

  if (!disabledReason) {
    setTimeout(() => check(false), FIRST_CHECK_MS);
    setInterval(() => check(false), CHECK_EVERY_MS).unref();
  }

  return { check, status: () => state };
}

module.exports = { createUpdater, compareVersions };
