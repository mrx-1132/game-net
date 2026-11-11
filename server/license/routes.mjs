// API لایسنس: فعال‌سازی/تمدید برای برنامه، و مدیریت برای پنل ادمین
import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { signToken, verifyTokenSignature, loadSigningKey } from './keys.mjs';
import { exportBackup, importBackup } from './store.mjs';
import { adminTotp } from './totp.mjs';
import { mountUpdateRoutes, mountAndroidRoutes } from './updates.mjs';

const DAY = 24 * 3600 * 1000;
const TOKEN_TTL_DAYS = Math.max(1, Math.min(30, Number(process.env.LICENSE_TOKEN_TTL_DAYS) || 7));
const SUB_DAYS = { '6months': 180, '12months': 365 };
const LIFETIME_END = '2099-12-31T00:00:00.000Z';
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// آدرس‌های سرور که داخل توکن امضاشده به برنامه داده می‌شود (برای جابه‌جایی سرور)
const SERVER_URLS = (process.env.LICENSE_SERVER_URLS || '')
  .split(',').map((s) => s.trim().replace(/\/+$/, '')).filter((s) => /^https?:\/\//.test(s)).slice(0, 5);

// ---------- admin auth ----------
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
// اگر تنظیم نشده باشد، یک کلید تصادفی ساخته می‌شود (نشست‌ها با ری‌استارت باطل می‌شوند)
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || crypto.randomBytes(48).toString('hex');

if (!/^\$2[aby]\$/.test(ADMIN_PASSWORD_HASH)) {
  console.warn('⚠️ ADMIN_PASSWORD_HASH (bcrypt) is not set — admin login is disabled until you set it.');
}
if (!process.env.ADMIN_JWT_SECRET) {
  console.warn('ℹ️ ADMIN_JWT_SECRET not set — using a random secret; admin sessions end on restart.');
}

// ---------- tiny in-memory rate limiter ----------
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  }, windowMs).unref();
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    let e = hits.get(key);
    if (!e || now > e.reset) { e = { n: 0, reset: now + windowMs }; hits.set(key, e); }
    if (++e.n > max) {
      res.set('Retry-After', String(Math.ceil((e.reset - now) / 1000)));
      return res.status(429).json({ success: false, message: 'تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.' });
    }
    next();
  };
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isDeviceId = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const isLifetime = (l) => l.subscription_type === 'lifetime';
const isExpired = (l) => !isLifetime(l) && new Date(l.end_date).getTime() < Date.now();

export function toPublicLicense(l, deviceCount) {
  const expired = isExpired(l);
  return {
    id: l.id,
    username: l.username,
    businessName: l.business_name,
    ownerName: l.owner_name,
    phoneNumber: l.phone_number,
    subscriptionType: l.subscription_type,
    startDateISO: l.start_date,
    endDateISO: l.end_date,
    status: l.status === 'suspended' ? 'suspended' : expired ? 'expired' : 'active',
    rawStatus: l.status,
    isExpired: expired,
    maxDevices: l.max_devices,
    features: l.features,
    deviceCount: deviceCount ?? undefined,
    createdAtISO: l.created_at,
  };
}

function issueToken(l, deviceHash) {
  const now = Date.now();
  let exp = now + TOKEN_TTL_DAYS * DAY;
  if (!isLifetime(l)) exp = Math.min(exp, new Date(l.end_date).getTime());
  return signToken({
    v: 1,
    lid: l.id,
    did: deviceHash,
    usr: l.username,
    bn: l.business_name,
    own: l.owner_name,
    ph: l.phone_number,
    plan: l.subscription_type,
    start: l.start_date,
    end: isLifetime(l) ? null : l.end_date,
    feat: { remote: !!(l.features && l.features.remote) },
    iat: now,
    exp,
    srv: SERVER_URLS,
  });
}

// علت رد شدن لایسنس، یا null اگر مشکلی نیست
function licenseProblem(l) {
  if (!l) return { code: 404, status: 'not_found', message: 'لایسنس پیدا نشد.' };
  if (l.status === 'suspended') return { code: 403, status: 'suspended', message: 'این لایسنس مسدود شده است. با پشتیبانی تماس بگیرید.' };
  if (isExpired(l)) return { code: 403, status: 'expired', message: 'اشتراک شما تمام شده است. برای تمدید با پشتیبانی تماس بگیرید.' };
  return null;
}

export function createLicenseRouter(store) {
  const router = express.Router();
  const clientLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
  const refreshLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 60 });
  const adminLoginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
  const sendProblem = (res, p) => res.status(p.code).json({ success: false, status: p.status, message: p.message });

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', database: store.kind, signing: !!loadSigningKey(), time: new Date().toISOString() });
  });

  // ===== Client: activate on this device =====
  router.post('/license/activate', clientLimiter, async (req, res) => {
    try {
      const username = str(req.body?.username, 100);
      const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 200) : '';
      const deviceId = req.body?.deviceId;
      if (!username || !password || !isDeviceId(deviceId)) {
        return res.status(400).json({ success: false, message: 'نام کاربری، رمز عبور و شناسه دستگاه الزامی است.' });
      }
      const lic = await store.getLicenseByUsername(username);
      // مقایسه bcrypt حتی وقتی کاربر وجود ندارد، تا زمان پاسخ چیزی لو ندهد
      const ok = await bcrypt.compare(password, lic ? lic.password_hash : DUMMY_HASH);
      if (!lic || !ok) return res.status(401).json({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' });

      const problem = licenseProblem(lic);
      if (problem) return sendProblem(res, problem);

      let device = await store.findDevice(lic.id, deviceId);
      if (!device) {
        const devices = await store.listDevices(lic.id);
        if (devices.length >= lic.max_devices) {
          return res.status(403).json({
            success: false,
            status: 'device_limit',
            message: `این لایسنس روی حداکثر تعداد دستگاه مجاز (${lic.max_devices}) فعال است. برای انتقال به این سیستم با پشتیبانی تماس بگیرید.`,
          });
        }
        device = { id: crypto.randomUUID(), license_id: lic.id, device_hash: deviceId, activated_at: new Date().toISOString() };
      }
      device.name = str(req.body?.deviceName, 100) || device.name || 'کامپیوتر';
      device.last_seen = new Date().toISOString();
      device.last_ip = String(req.ip || '').slice(0, 64);
      await store.saveDevice(device);

      res.json({ success: true, token: issueToken(lic, deviceId), license: toPublicLicense(lic), serverTime: Date.now() });
    } catch (e) {
      console.error('activate error:', e);
      res.status(500).json({ success: false, message: 'خطای داخلی سرور.' });
    }
  });

  // ===== Client: refresh token (works with an expired-but-genuine token) =====
  router.post('/license/refresh', refreshLimiter, async (req, res) => {
    try {
      const payload = verifyTokenSignature(req.body?.token);
      const deviceId = req.body?.deviceId;
      if (!payload || !isDeviceId(deviceId) || payload.did !== deviceId) {
        return res.status(401).json({ success: false, status: 'invalid', message: 'توکن لایسنس نامعتبر است.' });
      }
      const lic = await store.getLicenseById(payload.lid);
      const problem = licenseProblem(lic);
      if (problem) return sendProblem(res, problem);

      const device = await store.findDevice(lic.id, deviceId);
      if (!device) {
        return res.status(403).json({ success: false, status: 'device_revoked', message: 'دسترسی این دستگاه توسط مدیر لغو شده است.' });
      }
      device.last_seen = new Date().toISOString();
      device.last_ip = String(req.ip || '').slice(0, 64);
      await store.saveDevice(device);

      res.json({ success: true, token: issueToken(lic, deviceId), license: toPublicLicense(lic), serverTime: Date.now() });
    } catch (e) {
      console.error('refresh error:', e);
      res.status(500).json({ success: false, message: 'خطای داخلی سرور.' });
    }
  });

  // ===== Client: release this device's slot =====
  router.post('/license/deactivate', refreshLimiter, async (req, res) => {
    try {
      const payload = verifyTokenSignature(req.body?.token);
      if (!payload || payload.did !== req.body?.deviceId) return res.status(401).json({ success: false });
      const device = await store.findDevice(payload.lid, payload.did);
      if (device) await store.deleteDevice(device.id);
      res.json({ success: true });
    } catch (e) {
      console.error('deactivate error:', e);
      res.status(500).json({ success: false });
    }
  });

  // ===== Admin =====
  router.post('/admin/login', adminLoginLimiter, async (req, res) => {
    if (!/^\$2[aby]\$/.test(ADMIN_PASSWORD_HASH)) {
      return res.status(503).json({ success: false, message: 'رمز مدیر روی سرور تنظیم نشده است (ADMIN_PASSWORD_HASH).' });
    }
    const username = str(req.body?.username, 100).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 200) : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.replace(/\D/g, '').slice(0, 6) : '';
    const twoFactor = adminTotp.enabled();
    // اگر ورود دومرحله‌ای فعال است و کد نیامده، قبل از بررسی رمز کد را بخواه (تا درستی رمز لو نرود)
    if (twoFactor && !code) {
      return res.status(401).json({ success: false, needCode: true, message: 'کد ۶ رقمی برنامه Authenticator را وارد کنید.' });
    }
    const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if (!ok || username !== ADMIN_USERNAME || (twoFactor && !adminTotp.verify(code))) {
      console.warn(`admin login failed from ${req.ip}`);
      return res.status(401).json({ success: false, needCode: twoFactor, message: 'اطلاعات ورود مدیر صحیح نیست.' });
    }
    console.log(`admin login from ${req.ip}`);
    const token = jwt.sign({ role: 'admin' }, ADMIN_JWT_SECRET, { expiresIn: '4h' });
    res.json({ success: true, token, role: 'admin' });
  });

  const requireAdmin = (req, res, next) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    try {
      const decoded = m && jwt.verify(m[1], ADMIN_JWT_SECRET);
      if (decoded && decoded.role === 'admin') return next();
    } catch { /* fallthrough */ }
    res.status(401).json({ success: false, message: 'نشست مدیریت نامعتبر یا منقضی شده است.' });
  };

  // ===== Online updates for the desktop app =====
  mountUpdateRoutes(router, {
    store,
    requireAdmin,
    licenseProblem,
    limiter: rateLimit({ windowMs: 60 * 60 * 1000, max: 120 }),
  });

  mountAndroidRoutes(router, { requireAdmin });

  // ===== Two-factor login (TOTP) =====
  router.get('/admin/2fa', requireAdmin, (_req, res) => res.json({ success: true, enabled: adminTotp.enabled() }));

  router.post('/admin/2fa/setup', requireAdmin, (req, res) => {
    if (adminTotp.enabled()) return res.status(400).json({ success: false, message: 'ورود دومرحله‌ای از قبل فعال است.' });
    const { secret, uri } = adminTotp.startSetup(ADMIN_USERNAME, 'GameNet');
    res.json({ success: true, secret, uri });
  });

  router.post('/admin/2fa/enable', requireAdmin, adminLoginLimiter, (req, res) => {
    const code = String(req.body?.code || '').replace(/\D/g, '');
    if (!adminTotp.confirmSetup(code)) {
      return res.status(400).json({ success: false, message: 'کد درست نیست یا زمان تنظیم تمام شده؛ دوباره امتحان کنید.' });
    }
    console.log('admin 2FA enabled');
    res.json({ success: true, message: 'ورود دومرحله‌ای فعال شد.' });
  });

  router.post('/admin/2fa/disable', requireAdmin, adminLoginLimiter, async (req, res) => {
    const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 200) : '';
    const code = String(req.body?.code || '').replace(/\D/g, '');
    const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if (!ok || !adminTotp.verify(code)) {
      return res.status(400).json({ success: false, message: 'رمز یا کد درست نیست.' });
    }
    adminTotp.disable();
    console.log('admin 2FA disabled');
    res.json({ success: true, message: 'ورود دومرحله‌ای غیرفعال شد.' });
  });

  router.get('/admin/licenses', requireAdmin, async (_req, res) => {
    const counts = await store.countDevicesByLicense();
    const list = await store.listLicenses();
    res.json({ success: true, licenses: list.map((l) => toPublicLicense(l, counts[l.id] || 0)) });
  });

  router.post('/admin/licenses', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const username = str(b.username, 100);
      const password = typeof b.password === 'string' ? b.password : '';
      const businessName = str(b.businessName, 255);
      if (!/^[A-Za-z0-9_.-]{3,100}$/.test(username)) {
        return res.status(400).json({ success: false, message: 'نام کاربری باید حداقل ۳ حرف انگلیسی/عدد باشد.' });
      }
      if (password.length < 8) return res.status(400).json({ success: false, message: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' });
      if (!businessName) return res.status(400).json({ success: false, message: 'نام مجموعه الزامی است.' });
      if (await store.getLicenseByUsername(username)) {
        return res.status(400).json({ success: false, message: 'این نام کاربری قبلاً ثبت شده است.' });
      }
      const type = ['6months', '12months', 'custom', 'lifetime'].includes(b.subscriptionType) ? b.subscriptionType : '6months';
      const days = type === 'custom' ? Math.max(1, Math.min(3650, Number(b.customDays) || 30)) : SUB_DAYS[type];
      const now = Date.now();
      const lic = await store.saveLicense({
        id: `lic-${now}-${crypto.randomBytes(3).toString('hex')}`,
        username,
        password_hash: await bcrypt.hash(password, 12),
        business_name: businessName,
        owner_name: str(b.ownerName, 255),
        phone_number: str(b.phoneNumber, 50),
        subscription_type: type,
        start_date: new Date(now).toISOString(),
        end_date: type === 'lifetime' ? LIFETIME_END : new Date(now + days * DAY).toISOString(),
        status: b.status === 'suspended' ? 'suspended' : 'active',
        max_devices: Math.max(1, Math.min(20, Number(b.maxDevices) || 1)),
        features: { remote: b.features?.remote !== false },
        created_at: new Date(now).toISOString(),
      });
      res.status(201).json({ success: true, message: 'لایسنس ساخته شد.', license: toPublicLicense(lic, 0) });
    } catch (e) {
      console.error('create license error:', e);
      res.status(500).json({ success: false, message: 'خطا در ثبت لایسنس.' });
    }
  });

  router.patch('/admin/licenses/:id', requireAdmin, async (req, res) => {
    try {
      const lic = await store.getLicenseById(req.params.id);
      if (!lic) return res.status(404).json({ success: false, message: 'لایسنس پیدا نشد.' });
      const u = req.body || {};
      if (typeof u.businessName === 'string' && u.businessName.trim()) lic.business_name = str(u.businessName, 255);
      if (typeof u.ownerName === 'string') lic.owner_name = str(u.ownerName, 255);
      if (typeof u.phoneNumber === 'string') lic.phone_number = str(u.phoneNumber, 50);
      if (u.status === 'active' || u.status === 'suspended') lic.status = u.status;
      if (['6months', '12months', 'custom', 'lifetime'].includes(u.subscriptionType)) {
        lic.subscription_type = u.subscriptionType;
        if (u.subscriptionType === 'lifetime') lic.end_date = LIFETIME_END;
      }
      if (u.endDateISO && !isNaN(Date.parse(u.endDateISO))) lic.end_date = new Date(u.endDateISO).toISOString();
      if (u.startDateISO && !isNaN(Date.parse(u.startDateISO))) lic.start_date = new Date(u.startDateISO).toISOString();
      if (u.maxDevices != null) lic.max_devices = Math.max(1, Math.min(20, Number(u.maxDevices) || 1));
      if (u.features && typeof u.features.remote === 'boolean') lic.features = { ...lic.features, remote: u.features.remote };
      if (typeof u.password === 'string' && u.password.trim()) {
        if (u.password.trim().length < 8) return res.status(400).json({ success: false, message: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' });
        lic.password_hash = await bcrypt.hash(u.password.trim(), 12);
      }
      await store.saveLicense(lic);
      const counts = await store.countDevicesByLicense();
      res.json({ success: true, message: 'تغییرات ذخیره شد.', license: toPublicLicense(lic, counts[lic.id] || 0) });
    } catch (e) {
      console.error('update license error:', e);
      res.status(500).json({ success: false, message: 'خطا در ویرایش لایسنس.' });
    }
  });

  router.delete('/admin/licenses/:id', requireAdmin, async (req, res) => {
    const ok = await store.deleteLicense(req.params.id);
    res.status(ok ? 200 : 404).json({ success: ok, message: ok ? 'لایسنس حذف شد.' : 'لایسنس پیدا نشد.' });
  });

  router.get('/admin/licenses/:id/devices', requireAdmin, async (req, res) => {
    const devices = await store.listDevices(req.params.id);
    res.json({
      success: true,
      devices: devices.map((d) => ({ id: d.id, name: d.name, activatedAt: d.activated_at, lastSeen: d.last_seen, lastIp: d.last_ip })),
    });
  });

  router.delete('/admin/devices/:id', requireAdmin, async (req, res) => {
    const ok = await store.deleteDevice(req.params.id);
    res.status(ok ? 200 : 404).json({ success: ok, message: ok ? 'دسترسی دستگاه لغو شد.' : 'دستگاه پیدا نشد.' });
  });

  // ===== Backup / restore (for moving to a new server) =====
  router.get('/admin/backup', requireAdmin, async (_req, res) => {
    const backup = await exportBackup(store);
    const name = `gamenet-licenses-${backup.exportedAt.slice(0, 10)}.json`;
    res.set('Content-Disposition', `attachment; filename="${name}"`);
    res.json(backup);
  });

  router.post('/admin/restore', requireAdmin, express.json({ limit: '25mb' }), async (req, res) => {
    try {
      if (req.body?.confirm !== 'REPLACE_ALL') {
        return res.status(400).json({ success: false, message: 'تأیید جایگزینی کامل ارسال نشده است.' });
      }
      const result = await importBackup(store, req.body.backup);
      res.json({ success: true, message: `بازیابی انجام شد: ${result.licenses} لایسنس، ${result.devices} دستگاه.`, ...result });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message || 'خطا در بازیابی بکاپ.' });
    }
  });

  return router;
}
