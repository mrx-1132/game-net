// بررسی لایسنس در main process الکترون (نه در React، چون آن‌جا با DevTools قابل دستکاری است)
// - توکن با Ed25519 امضا شده؛ برنامه فقط کلید عمومی را دارد و امضا را آفلاین چک می‌کند.
// - توکن به شناسه سخت‌افزار این کامپیوتر گره خورده است.
// - هر چند ساعت با سرور تمدید می‌شود؛ بدون اینترنت تا پایان اعتبار توکن (پیش‌فرض ۷ روز) کار می‌کند.
// - عقب کشیدن ساعت سیستم تشخیص داده می‌شود.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { app, ipcMain, safeStorage } = require('electron');
const config = require('./license-config.cjs');

const CLOCK_SKEW_MS = 10 * 60 * 1000; // ده دقیقه تحمل
const MAX_CLOCK_DIFF_MS = 24 * 3600 * 1000; // اختلاف مجاز ساعت سیستم با سرور
const REFRESH_EVERY_MS = 6 * 3600 * 1000;
const RETRY_EVERY_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15000;

const MESSAGES = {
  none: 'برنامه هنوز فعال نشده است. با نام کاربری و رمز اشتراک وارد شوید.',
  invalid: 'فایل لایسنس معتبر نیست. دوباره وارد شوید.',
  device_mismatch: 'این لایسنس متعلق به کامپیوتر دیگری است.',
  clock: 'ساعت یا تاریخ سیستم عقب کشیده شده است. ساعت ویندوز را درست کنید و برنامه را دوباره باز کنید.',
  offline_expired: 'برای ادامه کار، برنامه باید یک بار به اینترنت وصل شود تا اشتراک بررسی شود.',
  expired: 'اشتراک شما تمام شده است. برای تمدید با پشتیبانی تماس بگیرید.',
  suspended: 'این لایسنس مسدود شده است. با پشتیبانی تماس بگیرید.',
  device_revoked: 'دسترسی این کامپیوتر توسط مدیر لغو شده است.',
  no_public_key: 'کلید عمومی لایسنس داخل برنامه قرار نگرفته است (electron/license-public.pem).',
};

// ---------- public keys ----------
function loadPublicKeys() {
  const keys = new Map();
  for (const f of fs.readdirSync(__dirname)) {
    if (!/^license-public.*\.pem$/.test(f)) continue;
    try {
      const k = crypto.createPublicKey(fs.readFileSync(path.join(__dirname, f), 'utf8'));
      const kid = crypto.createHash('sha256').update(k.export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 16);
      keys.set(kid, k);
    } catch (e) {
      console.error('license: bad public key file', f, e.message);
    }
  }
  return keys;
}

function verifyToken(token, keys) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const key = keys.get(payload.kid);
    if (!key) return null;
    if (!crypto.verify(null, Buffer.from(parts[0]), key, Buffer.from(parts[1], 'base64url'))) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- device fingerprint ----------
function readMachineId() {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', windowsHide: true });
      const m = /MachineGuid\s+REG_\w+\s+([\w-]+)/i.exec(out);
      if (m) return m[1];
    } else if (process.platform === 'darwin') {
      const out = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], { encoding: 'utf8' });
      const m = /"IOPlatformUUID" = "([^"]+)"/.exec(out);
      if (m) return m[1];
    } else {
      for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
        if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
      }
    }
  } catch (e) {
    console.error('license: machine id read failed', e.message);
  }
  return null;
}

function getDeviceId(dataDir) {
  let raw = readMachineId();
  if (!raw) {
    // آخرین راه: شناسه تصادفی ذخیره‌شده (ضعیف‌تر، ولی برنامه از کار نمی‌افتد)
    const f = path.join(dataDir, 'device-id');
    try { raw = fs.readFileSync(f, 'utf8').trim(); } catch { /* none */ }
    if (!raw) { raw = crypto.randomUUID(); fs.writeFileSync(f, raw); }
  }
  const cpu = (os.cpus()[0] && os.cpus()[0].model) || '';
  return crypto.createHash('sha256').update(`gamenet-device-v1|${raw}|${cpu}|${os.arch()}`).digest('hex');
}

// ---------- encrypted local state ----------
function createVault(file) {
  const canEncrypt = () => { try { return safeStorage.isEncryptionAvailable(); } catch { return false; } };
  return {
    read() {
      try {
        const buf = fs.readFileSync(file);
        const text = buf[0] === 0x7b ? buf.toString('utf8') : safeStorage.decryptString(buf);
        return JSON.parse(text);
      } catch {
        return {};
      }
    },
    write(obj) {
      const text = JSON.stringify(obj);
      const data = canEncrypt() ? safeStorage.encryptString(text) : Buffer.from(text, 'utf8');
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, data);
      fs.renameSync(tmp, file);
    },
  };
}

// ---------- manager ----------
function createLicenseManager({ getWindow }) {
  const dataDir = app.getPath('userData');
  const vault = createVault(path.join(dataDir, 'license.dat'));
  const keys = loadPublicKeys();
  const deviceId = getDeviceId(dataDir);
  let state = vault.read(); // { token, lastSeen, lastSync, blocked, clockBad }
  let lastAttempt = 0;
  let lastStatusJson = '';

  const save = () => vault.write(state);

  function touchClock() {
    const now = Date.now();
    const last = Number(state.lastSeen) || 0;
    if (last && now + CLOCK_SKEW_MS < last) return false;
    if (now > last) { state.lastSeen = now; save(); }
    return true;
  }

  function status() {
    if (keys.size === 0) return { state: 'no_public_key', message: MESSAGES.no_public_key };
    if (!state.token) return { state: 'none', message: MESSAGES.none };
    const p = verifyToken(state.token, keys);
    if (!p) return { state: 'invalid', message: MESSAGES.invalid };
    const info = toLicenseInfo(p);
    if (state.blocked) return { state: state.blocked, message: state.blockedMessage || MESSAGES[state.blocked], license: info };
    if (p.did !== deviceId) return { state: 'device_mismatch', message: MESSAGES.device_mismatch, license: info };
    if (state.clockBad || !touchClock()) return { state: 'clock', message: MESSAGES.clock, license: info };
    const now = Date.now();
    if (now > p.exp) {
      const subEnded = p.end && now > Date.parse(p.end);
      const s = subEnded ? 'expired' : 'offline_expired';
      return { state: s, message: MESSAGES[s], license: info };
    }
    return {
      state: 'active',
      license: info,
      features: { remote: !!(p.feat && p.feat.remote) },
      tokenExpiresAt: new Date(p.exp).toISOString(),
      lastSync: state.lastSync || null,
    };
  }

  function toLicenseInfo(p) {
    return {
      id: p.lid,
      username: p.usr,
      businessName: p.bn,
      ownerName: p.own || '',
      phoneNumber: p.ph || '',
      subscriptionType: p.plan,
      startDateISO: p.start,
      endDateISO: p.end || '2099-12-31T00:00:00.000Z',
    };
  }

  function servers() {
    const p = state.token && verifyToken(state.token, keys);
    // آدرس‌های داخل توکن امضاشده اول، بعد آدرس‌های داخل برنامه
    const list = [...((p && Array.isArray(p.srv)) ? p.srv : []), ...(state.servers || []), ...config.SERVERS];
    return [...new Set(list.filter((u) => /^https:\/\//.test(u) || (!app.isPackaged && /^http:\/\//.test(u))))];
  }

  async function call(pathname, body) {
    let lastErr = null;
    for (const base of servers()) {
      try {
        const res = await fetch(`${base}/api${pathname}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        const data = await res.json().catch(() => ({}));
        return { http: res.status, data };
      } catch (e) {
        lastErr = e; // سرور بعدی را امتحان کن
      }
    }
    return { http: 0, error: lastErr ? lastErr.message : 'no server configured' };
  }

  function accept(data) {
    const p = verifyToken(data.token, keys);
    if (!p || p.did !== deviceId) return false;
    state.token = data.token;
    state.lastSync = Date.now();
    if (p.srv && p.srv.length) state.servers = p.srv;
    // ساعت سرور مرجع است
    const serverTime = Number(data.serverTime) || 0;
    if (serverTime) {
      state.clockBad = Math.abs(Date.now() - serverTime) > MAX_CLOCK_DIFF_MS;
      state.lastSeen = Math.max(serverTime, Date.now());
    }
    delete state.blocked;
    delete state.blockedMessage;
    save();
    return true;
  }

  // پاسخ رد از سرور: مسدود/منقضی/لغو دستگاه -> قفل (با تمدید بعدی خودکار باز می‌شود)
  function block(data) {
    const s = data.status;
    if (['expired', 'suspended', 'device_revoked'].includes(s)) {
      state.blocked = s;
      state.blockedMessage = data.message;
    } else if (s === 'invalid' || s === 'not_found') {
      delete state.token;
      delete state.blocked;
    } else {
      return;
    }
    save();
  }

  function notify() {
    const s = status();
    const json = JSON.stringify(s);
    if (json === lastStatusJson) return s;
    lastStatusJson = json;
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('license:changed', s);
    return s;
  }

  async function refresh() {
    lastAttempt = Date.now();
    if (!state.token) return { ok: false, status: status() };
    const r = await call('/license/refresh', { token: state.token, deviceId });
    if (r.http === 200 && r.data.success && accept(r.data)) return { ok: true, status: notify() };
    if (r.http >= 400 && r.http < 500 && r.http !== 429) block(r.data || {});
    return { ok: false, offline: r.http === 0, message: r.data && r.data.message, status: notify() };
  }

  async function activate(username, password) {
    if (typeof username !== 'string' || typeof password !== 'string') return { ok: false, message: 'ورودی نامعتبر' };
    const r = await call('/license/activate', {
      username: username.trim().slice(0, 100),
      password: password.slice(0, 200),
      deviceId,
      deviceName: os.hostname().slice(0, 60),
    });
    if (r.http === 0) return { ok: false, message: 'اتصال به سرور لایسنس برقرار نشد. اینترنت را بررسی کنید.' };
    if (r.http === 200 && r.data.success) {
      delete state.blocked;
      if (!accept(r.data)) return { ok: false, message: 'پاسخ سرور قابل تأیید نیست (امضا نامعتبر).' };
      return { ok: true, status: notify() };
    }
    return { ok: false, status: r.data.status, message: r.data.message || 'فعال‌سازی ناموفق بود.' };
  }

  async function logout() {
    if (state.token) await call('/license/deactivate', { token: state.token, deviceId }).catch(() => {});
    state = { lastSeen: state.lastSeen };
    save();
    return notify();
  }

  ipcMain.handle('license:status', () => notify());
  ipcMain.handle('license:activate', (_e, u, p) => activate(u, p));
  ipcMain.handle('license:refresh', () => refresh());
  ipcMain.handle('license:logout', () => logout());

  // تمدید دوره‌ای در پس‌زمینه
  const tick = () => {
    const s = notify();
    const due = Date.now() - lastAttempt > (s.state === 'active' ? REFRESH_EVERY_MS : RETRY_EVERY_MS);
    if (state.token && due) refresh().catch(() => {});
  };
  setTimeout(tick, 3000);
  setInterval(tick, 60 * 1000).unref();

  return {
    status,
    hasFeature: (name) => {
      const s = status();
      return s.state === 'active' && !!(s.features && s.features[name]);
    },
  };
}

module.exports = { createLicenseManager };
