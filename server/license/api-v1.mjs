// API برای سیستم‌های بیرونی (مثلاً سایت فروش اشتراک)
// - احراز هویت: هدر Authorization: Bearer gnk_...  (کلید از پنل مدیریت ← امنیت ← کلیدهای API ساخته می‌شود)
// - فقط کارهای مربوط به اشتراک؛ به مدیریت، بکاپ و آپدیت‌ها دسترسی ندارد
// - هر حساب با externalId (مثلاً شناسه مشتری در سایت) شناخته می‌شود؛ برای هر externalId فقط یک لایسنس
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.LICENSE_DATA_DIR || path.join(__dirname, '..', 'data');
const KEYS_FILE = path.join(DATA_DIR, 'api-keys.json');
const LIFETIME_END = '2099-12-31T00:00:00.000Z';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---------- API keys ----------
function readKeys() {
  try { return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8')); } catch { return []; }
}
function writeKeys(keys) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${KEYS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(keys, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, KEYS_FILE);
}

export const apiKeys = {
  list() {
    return readKeys().map(({ hash, ...k }) => k);
  },
  create(name) {
    const raw = `gnk_${crypto.randomBytes(30).toString('base64url')}`;
    const keys = readKeys();
    const key = { id: crypto.randomUUID(), name: String(name || 'API').slice(0, 60), prefix: raw.slice(0, 10), hash: sha256(raw), createdAt: new Date().toISOString(), lastUsedAt: null, revoked: false };
    keys.push(key);
    writeKeys(keys);
    return { key: raw, id: key.id };
  },
  revoke(id) {
    const keys = readKeys();
    const k = keys.find((x) => x.id === id);
    if (!k) return false;
    k.revoked = true;
    writeKeys(keys);
    return true;
  },
  verify(raw) {
    if (typeof raw !== 'string' || !raw.startsWith('gnk_') || raw.length > 100) return null;
    const h = Buffer.from(sha256(raw));
    const keys = readKeys();
    const k = keys.find((x) => !x.revoked && crypto.timingSafeEqual(Buffer.from(x.hash), h));
    if (!k) return null;
    // آخرین استفاده را حداکثر هر یک دقیقه یک بار ذخیره کن
    if (!k.lastUsedAt || Date.now() - Date.parse(k.lastUsedAt) > 60000) {
      k.lastUsedAt = new Date().toISOString();
      try { writeKeys(keys); } catch { /* ignore */ }
    }
    return { id: k.id, name: k.name };
  },
};

// ---------- rules ----------
export const USERNAME_RULE = /^[A-Za-z][A-Za-z0-9_.-]{3,29}$/;
export function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
  if (pw.length > 64) return 'رمز عبور حداکثر ۶۴ کاراکتر است.';
  if (/\s/.test(pw)) return 'رمز عبور نباید فاصله داشته باشد.';
  if (!/[A-Z]/.test(pw)) return 'رمز عبور باید حداقل یک حرف بزرگ انگلیسی (A-Z) داشته باشد.';
  if (!/[a-z]/.test(pw)) return 'رمز عبور باید حداقل یک حرف کوچک انگلیسی (a-z) داشته باشد.';
  if (!/[0-9]/.test(pw)) return 'رمز عبور باید حداقل یک عدد داشته باشد.';
  return null;
}
const isExternalId = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function parseEnd(body) {
  if (body.lifetime === true) return { type: 'lifetime', end: LIFETIME_END };
  if (typeof body.endsAt !== 'string' || isNaN(Date.parse(body.endsAt))) return null;
  return { type: 'custom', end: new Date(body.endsAt).toISOString() };
}

export function mountApiV1(router, { store, toPublicLicense, rateLimit }) {
  const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
  const bad = (res, code, message, status = 400) => res.status(status).json({ success: false, code, message });

  const requireKey = (req, res, next) => {
    const m = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
    const k = m && apiKeys.verify(m[1]);
    if (!k) return bad(res, 'unauthorized', 'کلید API نامعتبر است.', 401);
    req.apiKey = k;
    next();
  };
  const log = (req, action, detail) => console.log(`api ${action} by "${req.apiKey.name}" ${detail || ''}`);
  const view = async (lic) => {
    const devices = await store.listDevices(lic.id);
    return { ...toPublicLicense(lic, devices.length), externalId: lic.external_id };
  };

  router.use('/v1', limiter, requireKey);

  router.get('/v1/ping', (req, res) => res.json({ success: true, key: req.apiKey.name, time: new Date().toISOString() }));

  router.get('/v1/rules', (_req, res) => res.json({
    success: true,
    username: 'از ۴ تا ۳۰ کاراکتر: با حرف انگلیسی شروع شود؛ فقط حروف انگلیسی، عدد و _ . -',
    password: 'حداقل ۸ کاراکتر، بدون فاصله، شامل حرف بزرگ و حرف کوچک انگلیسی و عدد',
  }));

  router.get('/v1/usernames/:username', async (req, res) => {
    const u = req.params.username;
    if (!USERNAME_RULE.test(u)) return res.json({ success: true, available: false, reason: 'invalid' });
    res.json({ success: true, available: !(await store.getLicenseByUsername(u)) });
  });

  // ساخت حساب
  router.post('/v1/licenses', async (req, res) => {
    const b = req.body || {};
    if (!isExternalId(b.externalId)) return bad(res, 'invalid_external_id', 'externalId نامعتبر است.');
    if (typeof b.username !== 'string' || !USERNAME_RULE.test(b.username)) {
      return bad(res, 'invalid_username', 'نام کاربری باید ۴ تا ۳۰ کاراکتر، با حرف انگلیسی شروع شود و فقط حروف انگلیسی، عدد و _ . - داشته باشد.');
    }
    const pwErr = passwordProblem(b.password);
    if (pwErr) return bad(res, 'invalid_password', pwErr);
    const businessName = str(b.businessName, 255);
    if (!businessName) return bad(res, 'invalid_business_name', 'نام مجموعه الزامی است.');
    const end = parseEnd(b);
    if (!end) return bad(res, 'invalid_end', 'endsAt (تاریخ پایان) یا lifetime لازم است.');

    const existing = await store.getLicenseByExternalId(b.externalId);
    if (existing) return res.status(409).json({ success: false, code: 'external_exists', message: 'برای این مشتری قبلاً حساب ساخته شده است.', license: await view(existing) });
    if (await store.getLicenseByUsername(b.username)) return bad(res, 'username_taken', 'این نام کاربری قبلاً گرفته شده است.', 409);

    const now = new Date();
    const lic = await store.saveLicense({
      id: `lic-${now.getTime()}-${crypto.randomBytes(3).toString('hex')}`,
      username: b.username,
      password_hash: await bcrypt.hash(b.password, 12),
      business_name: businessName,
      owner_name: str(b.ownerName, 255),
      phone_number: str(b.phoneNumber, 50),
      subscription_type: end.type,
      start_date: now.toISOString(),
      end_date: end.end,
      status: 'active',
      max_devices: Math.max(1, Math.min(20, Number(b.maxDevices) || 1)),
      features: { remote: b.remote !== false },
      external_id: b.externalId,
      created_at: now.toISOString(),
    });
    log(req, 'license.create', `${lic.username} ext=${b.externalId}`);
    res.status(201).json({ success: true, license: await view(lic) });
  });

  router.get('/v1/licenses/:externalId', async (req, res) => {
    if (!isExternalId(req.params.externalId)) return bad(res, 'invalid_external_id', 'externalId نامعتبر است.');
    const lic = await store.getLicenseByExternalId(req.params.externalId);
    if (!lic) return bad(res, 'not_found', 'حسابی برای این مشتری وجود ندارد.', 404);
    res.json({ success: true, license: await view(lic) });
  });

  // تغییر تاریخ پایان / وضعیت / مشخصات (سایت منبع اصلی تاریخ اشتراک است)
  router.patch('/v1/licenses/:externalId', async (req, res) => {
    if (!isExternalId(req.params.externalId)) return bad(res, 'invalid_external_id', 'externalId نامعتبر است.');
    const lic = await store.getLicenseByExternalId(req.params.externalId);
    if (!lic) return bad(res, 'not_found', 'حسابی برای این مشتری وجود ندارد.', 404);
    const b = req.body || {};
    if (b.lifetime === true || b.endsAt !== undefined) {
      const end = parseEnd(b);
      if (!end) return bad(res, 'invalid_end', 'endsAt نامعتبر است.');
      lic.subscription_type = end.type;
      lic.end_date = end.end;
    }
    if (b.status === 'active' || b.status === 'suspended') lic.status = b.status;
    if (typeof b.businessName === 'string' && b.businessName.trim()) lic.business_name = str(b.businessName, 255);
    if (typeof b.ownerName === 'string') lic.owner_name = str(b.ownerName, 255);
    if (typeof b.phoneNumber === 'string') lic.phone_number = str(b.phoneNumber, 50);
    if (b.maxDevices !== undefined) lic.max_devices = Math.max(1, Math.min(20, Number(b.maxDevices) || 1));
    if (typeof b.remote === 'boolean') lic.features = { ...lic.features, remote: b.remote };
    await store.saveLicense(lic);
    log(req, 'license.update', `${lic.username} ext=${lic.external_id} end=${lic.end_date} status=${lic.status}`);
    res.json({ success: true, license: await view(lic) });
  });

  router.put('/v1/licenses/:externalId/password', async (req, res) => {
    if (!isExternalId(req.params.externalId)) return bad(res, 'invalid_external_id', 'externalId نامعتبر است.');
    const lic = await store.getLicenseByExternalId(req.params.externalId);
    if (!lic) return bad(res, 'not_found', 'حسابی برای این مشتری وجود ندارد.', 404);
    const pwErr = passwordProblem(req.body?.password);
    if (pwErr) return bad(res, 'invalid_password', pwErr);
    lic.password_hash = await bcrypt.hash(req.body.password, 12);
    await store.saveLicense(lic);
    log(req, 'license.password', `${lic.username} ext=${lic.external_id}`);
    res.json({ success: true, message: 'رمز عبور تغییر کرد.' });
  });

  router.use('/v1', (_req, res) => bad(res, 'not_found', 'مسیر API پیدا نشد.', 404));
}
