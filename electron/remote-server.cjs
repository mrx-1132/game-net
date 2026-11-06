// سرور ریموت شبکه داخلی: گوشی -> HTTP -> (IPC) -> پنجره برنامه
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, ipcMain } = require('electron');
const express = require('express');
const cors = require('cors');

const PORT = 4747;
const PAIR_TTL_MS = 5 * 60 * 1000;

function validate(b) {
  if (!b || typeof b !== 'object') return null;
  const str = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
  const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const METHODS = ['cash', 'card', 'debt'];
  const items = (v) =>
    Array.isArray(v) && v.length >= 1 && v.length <= 30 &&
    v.every((i) => i && str(i.id, 100) && Number.isInteger(i.quantity) && i.quantity >= 1 && i.quantity <= 99) &&
    new Set(v.map((i) => i.id)).size === v.length
      ? v.map((i) => ({ id: i.id, quantity: i.quantity }))
      : null;
  const opt = (v) => (typeof v === 'string' && v.length > 0 && v.length <= 100 ? v : undefined);
  switch (b.type) {
    case 'players':
      if (!str(b.systemId, 100) || ![1, 2, 3, 4].includes(b.playersCount)) return null;
      return { type: 'players', systemId: b.systemId, playersCount: b.playersCount };
    case 'adjustTime':
      if (!str(b.systemId, 100) || !Number.isInteger(b.minutes) || b.minutes < 0 || b.minutes > 1440) return null;
      return { type: 'adjustTime', systemId: b.systemId, minutes: b.minutes };
    case 'transfer':
      if (!str(b.sourceId, 100) || !str(b.targetId, 100) || b.sourceId === b.targetId) return null;
      return { type: 'transfer', sourceId: b.sourceId, targetId: b.targetId };
    case 'addBuffet': {
      const it = items(b.items);
      if (!str(b.systemId, 100) || !it) return null;
      return { type: 'addBuffet', systemId: b.systemId, items: it };
    }
    case 'settle':
      if (!str(b.systemId, 100) || !METHODS.includes(b.method)) return null;
      return { type: 'settle', systemId: b.systemId, method: b.method, cardReaderId: opt(b.cardReaderId), debtorId: opt(b.debtorId), round: b.round === true };
    case 'directSale': {
      const it = items(b.items);
      if (!it || !METHODS.includes(b.method)) return null;
      return { type: 'directSale', items: it, customerName: text(b.customerName, 60), method: b.method, cardReaderId: opt(b.cardReaderId), debtorId: opt(b.debtorId) };
    }
    case 'start':
      if (!str(b.systemId, 100) || ![1, 2, 3, 4].includes(b.playersCount)) return null;
      return { type: 'start', systemId: b.systemId, customerName: text(b.customerName, 60), playersCount: b.playersCount };
    case 'pause':
    case 'resume':
      if (!str(b.systemId, 100)) return null;
      return { type: b.type, systemId: b.systemId };
    case 'ledger':
      if (!str(b.debtorId, 100) || !['debt_added', 'payment_made'].includes(b.kind)) return null;
      if (!Number.isInteger(b.amount) || b.amount <= 0 || b.amount > 1e11) return null;
      return { type: 'ledger', debtorId: b.debtorId, kind: b.kind, amount: b.amount, description: text(b.description, 200) };
  }
  return null;
}

function safeEq(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function startRemoteServer(getWindow, { isAllowed = () => true } = {}) {
  const NOT_ALLOWED = 'ریموت موبایل در اشتراک فعلی این برنامه فعال نیست.';
  const devicesFile = path.join(app.getPath('userData'), 'remote-devices.json');
  let devices = [];
  try { devices = JSON.parse(fs.readFileSync(devicesFile, 'utf8')); } catch { /* first run */ }
  const saveDevices = () => {
    try { fs.writeFileSync(devicesFile, JSON.stringify(devices, null, 2)); } catch (e) { console.error('remote: save failed', e); }
  };
  const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

  let latestState = null;
  let pairing = null; // { code, expiresAt }
  let failedPairs = 0;
  let lockUntil = 0;
  const pending = new Map();
  const seen = new Map(); // requestId -> { result, at } (جلوگیری از ثبت دوباره با ارسال مجدد)

  ipcMain.on('remote:state', (_e, s) => { latestState = s; });
  ipcMain.on('remote:reply', (_e, r) => {
    const p = pending.get(r && r.id);
    if (p) { pending.delete(r.id); clearTimeout(p.timer); p.resolve(r); }
  });
  ipcMain.handle('remote:info', () => {
    const addresses = [];
    for (const list of Object.values(os.networkInterfaces())) {
      for (const i of list || []) if (i.family === 'IPv4' && !i.internal) addresses.push(i.address);
    }
    return { port: PORT, addresses };
  });
  ipcMain.handle('remote:pair-code', () => {
    if (!isAllowed()) throw new Error(NOT_ALLOWED);
    pairing = { code: String(crypto.randomInt(0, 1000000)).padStart(6, '0'), expiresAt: Date.now() + PAIR_TTL_MS };
    return pairing;
  });
  ipcMain.handle('remote:devices', () => devices.map(({ id, name, createdAt, lastSeen }) => ({ id, name, createdAt, lastSeen })));
  ipcMain.handle('remote:revoke', (_e, id) => {
    const before = devices.length;
    devices = devices.filter((d) => d.id !== id);
    saveDevices();
    return devices.length < before;
  });

  function sendCommand(cmd) {
    return new Promise((resolve) => {
      const win = getWindow();
      if (!win || win.isDestroyed()) return resolve({ ok: false, error: 'پنجره برنامه در دسترس نیست' });
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({ ok: false, error: 'پاسخی از برنامه دریافت نشد' });
      }, 5000);
      pending.set(id, { resolve, timer });
      win.webContents.send('remote:cmd', { ...cmd, id });
    });
  }

  const api = express();
  api.disable('x-powered-by');
  api.use(cors()); // احراز هویت با Bearer token است، نه کوکی
  api.use(express.json({ limit: '10kb' }));

  api.get('/api/ping', (_req, res) => res.json({ ok: true, app: 'gamenet-manager' }));

  api.use('/api', (req, res, next) => {
    if (req.path === '/ping' || isAllowed()) return next();
    res.status(403).json({ error: NOT_ALLOWED });
  });

  api.post('/api/pair', (req, res) => {
    const now = Date.now();
    if (now < lockUntil) return res.status(429).json({ error: 'تلاش بیش از حد؛ یک دقیقه بعد دوباره امتحان کنید' });
    const { code, deviceName } = req.body || {};
    if (!pairing || now > pairing.expiresAt || typeof code !== 'string' || !safeEq(code, pairing.code)) {
      if (++failedPairs >= 5) { lockUntil = now + 60000; failedPairs = 0; pairing = null; }
      return res.status(401).json({ error: 'کد نامعتبر یا منقضی شده است' });
    }
    pairing = null;
    failedPairs = 0;
    const token = crypto.randomBytes(32).toString('hex');
    const device = {
      id: crypto.randomUUID(),
      name: typeof deviceName === 'string' && deviceName.trim() ? deviceName.trim().slice(0, 40) : 'گوشی',
      tokenHash: hash(token),
      createdAt: new Date().toISOString(),
      lastSeen: null,
    };
    devices.push(device);
    saveDevices();
    res.json({ token, deviceId: device.id });
  });

  api.use('/api', (req, res, next) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    const h = m && hash(m[1]);
    const device = h && devices.find((d) => safeEq(d.tokenHash, h));
    if (!device) return res.status(401).json({ error: 'دسترسی نامعتبر' });
    device.lastSeen = new Date().toISOString();
    req.device = device;
    next();
  });

  api.get('/api/state', (_req, res) => res.json({ ok: true, serverTime: Date.now(), state: latestState }));

  api.post('/api/cmd', async (req, res) => {
    const cmd = validate(req.body);
    if (!cmd) return res.status(400).json({ error: 'درخواست نامعتبر' });
    const rid = typeof req.body.requestId === 'string' ? req.body.requestId.slice(0, 64) : null;
    for (const [k, v] of seen) if (Date.now() - v.at > 10 * 60 * 1000) seen.delete(k);
    if (rid && seen.has(rid)) return res.json(seen.get(rid).result);
    const r = await sendCommand({ ...cmd, device: req.device.name });
    const result = r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error || 'خطا' };
    if (r.ok && rid) seen.set(rid, { result, at: Date.now() });
    res.status(r.ok ? 200 : 400).json(result);
  });

  const server = api.listen(PORT, '0.0.0.0');
  server.on('error', (e) => console.error('remote server error:', e.message));
  return { port: PORT, stop: () => server.close() };
}

module.exports = { startRemoteServer };
