// آپدیت آنلاین برنامه ویندوز
// - فایل‌های نصب و manifest امضاشده در LICENSE_UPDATES_DIR ذخیره می‌شوند (پیش‌فرض: کنار data/ → updates/)
// - هر نسخه می‌تواند برای «همه» یا «فقط لایسنس‌های انتخاب‌شده» باشد
// - امضا را برنامه مشتری با کلید عمومی خودش چک می‌کند؛ کلید خصوصی امضا روی سرور نیست
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { verifyTokenSignature } from './keys.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.LICENSE_DATA_DIR || path.join(__dirname, '..', 'data');
export const UPDATES_DIR = process.env.LICENSE_UPDATES_DIR || path.join(DATA_DIR, '..', 'updates');
const INDEX = path.join(UPDATES_DIR, 'releases.json');
const MAX_FILE_BYTES = 400 * 1024 * 1024;
const ARCHES = ['x64', 'ia32', 'arm64'];

const isVersion = (v) => typeof v === 'string' && /^\d{1,4}\.\d{1,4}\.\d{1,6}$/.test(v);
const isFileName = (n) => typeof n === 'string' && /^[A-Za-z0-9._-]{1,120}$/.test(n) && !n.startsWith('.');

export function compareVersions(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}

function readIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX, 'utf8')); } catch { return []; }
}
function writeIndex(list) {
  fs.mkdirSync(UPDATES_DIR, { recursive: true });
  const tmp = `${INDEX}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, INDEX);
}

function sha512File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha512');
    fs.createReadStream(file).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('base64'))).on('error', reject);
  });
}

function normalizeTarget(t) {
  if (t && t.type === 'licenses' && Array.isArray(t.ids)) {
    return { type: 'licenses', ids: [...new Set(t.ids.filter((x) => typeof x === 'string' && x.length <= 64))].slice(0, 500) };
  }
  return { type: 'all' };
}

const publicRelease = (r) => ({
  version: r.version,
  notes: r.notes,
  createdAt: r.createdAt,
  active: r.active,
  target: r.target,
  files: r.files,
  downloads: r.downloads || 0,
});

export function mountUpdateRoutes(router, { store, requireAdmin, licenseProblem, limiter }) {
  // ===== Admin: upload one file (raw body, streamed to disk) =====
  router.post('/admin/updates/upload', requireAdmin, (req, res) => {
    const { version, name } = req.query;
    if (!isVersion(version) || !isFileName(name)) return res.status(400).json({ success: false, message: 'نام فایل یا نسخه نامعتبر است.' });
    const dir = path.join(UPDATES_DIR, version);
    fs.mkdirSync(dir, { recursive: true });
    const part = path.join(dir, `${name}.part`);
    const out = fs.createWriteStream(part);
    let bytes = 0, failed = false;
    const fail = (code, message) => {
      if (failed) return; failed = true;
      out.destroy(); fs.rm(part, { force: true }, () => {});
      if (!res.headersSent) res.status(code).json({ success: false, message });
    };
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_FILE_BYTES) { fail(413, 'حجم فایل بیش از حد مجاز است.'); req.destroy(); }
    });
    req.on('aborted', () => fail(400, 'آپلود قطع شد.'));
    req.pipe(out);
    out.on('error', () => fail(500, 'خطا در ذخیره فایل.'));
    out.on('finish', () => {
      if (failed) return;
      fs.renameSync(part, path.join(dir, name));
      res.json({ success: true, name, size: bytes });
    });
  });

  // ===== Admin: register a release from its signed manifest =====
  router.post('/admin/updates', requireAdmin, express.json({ limit: '200kb' }), async (req, res) => {
    try {
      const raw = req.body?.manifest;
      const signature = req.body?.signature;
      if (typeof raw !== 'string' || raw.length > 100000 || typeof signature !== 'string' || !/^[A-Za-z0-9+/=]{40,200}$/.test(signature.trim())) {
        return res.status(400).json({ success: false, message: 'فایل manifest.json یا manifest.sig ارسال نشده یا نامعتبر است.' });
      }
      let m;
      try { m = JSON.parse(raw); } catch { return res.status(400).json({ success: false, message: 'manifest.json خراب است.' }); }
      if (m.app !== 'gamenet-manager' || !isVersion(m.version) || !m.files || typeof m.files !== 'object') {
        return res.status(400).json({ success: false, message: 'manifest.json مربوط به این برنامه نیست.' });
      }
      const files = {};
      for (const [arch, f] of Object.entries(m.files)) {
        if (!ARCHES.includes(arch) || !f || !isFileName(f.name)) return res.status(400).json({ success: false, message: `فایل نامعتبر در manifest: ${arch}` });
        const p = path.join(UPDATES_DIR, m.version, f.name);
        if (!fs.existsSync(p)) return res.status(400).json({ success: false, message: `فایل ${f.name} هنوز آپلود نشده است.` });
        const size = fs.statSync(p).size;
        if (size !== f.size || (await sha512File(p)) !== f.sha512) {
          return res.status(400).json({ success: false, message: `فایل ${f.name} با manifest یکی نیست (آپلود ناقص یا فایل اشتباه).` });
        }
        files[arch] = { name: f.name, size: f.size, sha512: f.sha512 };
      }
      if (!Object.keys(files).length) return res.status(400).json({ success: false, message: 'هیچ فایل نصبی در manifest نیست.' });

      const list = readIndex().filter((r) => r.version !== m.version);
      list.push({
        version: m.version,
        notes: typeof m.notes === 'string' ? m.notes.slice(0, 2000) : '',
        createdAt: new Date().toISOString(),
        active: true,
        target: normalizeTarget(req.body?.target),
        files,
        manifest: raw,
        signature: signature.trim(),
        downloads: 0,
      });
      list.sort((a, b) => compareVersions(b.version, a.version));
      writeIndex(list);
      console.log(`update ${m.version} published`);
      res.json({ success: true, message: `نسخه ${m.version} منتشر شد.` });
    } catch (e) {
      console.error('publish update error:', e);
      res.status(500).json({ success: false, message: 'خطای داخلی سرور.' });
    }
  });

  router.get('/admin/updates', requireAdmin, (_req, res) => {
    res.json({ success: true, releases: readIndex().map(publicRelease) });
  });

  router.patch('/admin/updates/:version', requireAdmin, (req, res) => {
    const list = readIndex();
    const r = list.find((x) => x.version === req.params.version);
    if (!r) return res.status(404).json({ success: false, message: 'نسخه پیدا نشد.' });
    if (typeof req.body?.active === 'boolean') r.active = req.body.active;
    if (req.body?.target) r.target = normalizeTarget(req.body.target);
    writeIndex(list);
    res.json({ success: true, message: 'ذخیره شد.', release: publicRelease(r) });
  });

  router.delete('/admin/updates/:version', requireAdmin, (req, res) => {
    const v = req.params.version;
    if (!isVersion(v)) return res.status(400).json({ success: false });
    writeIndex(readIndex().filter((x) => x.version !== v));
    fs.rmSync(path.join(UPDATES_DIR, v), { recursive: true, force: true });
    res.json({ success: true, message: `نسخه ${v} حذف شد.` });
  });

  // ===== Client: is there an update for this license? =====
  router.post('/update/check', limiter, async (req, res) => {
    try {
      const { token, deviceId, version, arch } = req.body || {};
      const payload = verifyTokenSignature(token);
      if (!payload || payload.did !== deviceId || !isVersion(version) || !ARCHES.includes(arch)) {
        return res.status(400).json({ success: false, available: false });
      }
      const lic = await store.getLicenseById(payload.lid);
      if (licenseProblem(lic) || !(await store.findDevice(lic.id, deviceId))) return res.json({ success: true, available: false });

      const rel = readIndex()
        .filter((r) => r.active && r.files[arch] && compareVersions(r.version, version) > 0)
        .filter((r) => r.target.type === 'all' || r.target.ids.includes(lic.id))
        .sort((a, b) => compareVersions(b.version, a.version))[0];
      if (!rel) return res.json({ success: true, available: false });

      const f = rel.files[arch];
      res.json({
        success: true,
        available: true,
        version: rel.version,
        notes: rel.notes,
        manifest: rel.manifest,
        signature: rel.signature,
        file: f,
        url: `/api/update/file/${rel.version}/${encodeURIComponent(f.name)}`,
      });
    } catch (e) {
      console.error('update check error:', e);
      res.status(500).json({ success: false, available: false });
    }
  });

  // ===== Client: download (supports resume via Range) =====
  router.get('/update/file/:version/:name', (req, res) => {
    const { version, name } = req.params;
    if (!isVersion(version) || !isFileName(name)) return res.status(404).end();
    const list = readIndex();
    const rel = list.find((r) => r.version === version && Object.values(r.files).some((f) => f.name === name));
    if (!rel) return res.status(404).end();
    if (!req.headers.range) {
      rel.downloads = (rel.downloads || 0) + 1;
      try { writeIndex(list); } catch { /* ignore */ }
    }
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(UPDATES_DIR, version, name), { acceptRanges: true });
  });
}

// ---------------------------------------------------------------------------
// اپ اندروید ریموت: یک فایل APK روی سرور با لینک ثابت /remote.apk
// (برنامه ویندوز QR همین لینک را نشان می‌دهد تا مشتری اپ را خودش دانلود کند)
// ---------------------------------------------------------------------------
const ANDROID_DIR = path.join(UPDATES_DIR, 'android');
const APK_FILE = path.join(ANDROID_DIR, 'GameNet-Remote.apk');
const APK_META = path.join(ANDROID_DIR, 'meta.json');
const MAX_APK_BYTES = 200 * 1024 * 1024;

function readApkMeta() {
  try { return fs.existsSync(APK_FILE) ? JSON.parse(fs.readFileSync(APK_META, 'utf8')) : null; } catch { return null; }
}

export function serveAndroidApk(_req, res) {
  if (!fs.existsSync(APK_FILE)) {
    return res.status(404).type('text/html; charset=utf-8')
      .send('<meta name="viewport" content="width=device-width"><p dir="rtl" style="font-family:sans-serif;padding:20px">اپ اندروید هنوز روی سرور قرار نگرفته است.</p>');
  }
  const meta = readApkMeta();
  if (meta) { meta.downloads = (meta.downloads || 0) + 1; try { fs.writeFileSync(APK_META, JSON.stringify(meta, null, 2)); } catch { /* ignore */ } }
  res.set('Cache-Control', 'no-cache');
  res.set('Content-Type', 'application/vnd.android.package-archive');
  res.set('Content-Disposition', 'attachment; filename="GameNet-Remote.apk"');
  res.sendFile(APK_FILE);
}

export function mountAndroidRoutes(router, { requireAdmin }) {
  router.get('/admin/android', requireAdmin, (_req, res) => res.json({ success: true, apk: readApkMeta() }));

  router.post('/admin/android/upload', requireAdmin, (req, res) => {
    const name = String(req.query.name || 'app.apk').replace(/[^A-Za-z0-9._ -]/g, '').slice(0, 120);
    const note = String(req.query.note || '').slice(0, 200);
    fs.mkdirSync(ANDROID_DIR, { recursive: true });
    const part = `${APK_FILE}.part`;
    const out = fs.createWriteStream(part);
    const hash = crypto.createHash('sha256');
    let bytes = 0, head = null, failed = false;
    const fail = (code, message) => {
      if (failed) return; failed = true;
      out.destroy(); fs.rm(part, { force: true }, () => {});
      if (!res.headersSent) res.status(code).json({ success: false, message });
    };
    req.on('data', (chunk) => {
      if (!head) head = chunk.subarray(0, 4);
      bytes += chunk.length;
      hash.update(chunk);
      if (bytes > MAX_APK_BYTES) { fail(413, 'حجم فایل بیش از حد مجاز است.'); req.destroy(); }
    });
    req.on('aborted', () => fail(400, 'آپلود قطع شد.'));
    req.pipe(out);
    out.on('error', () => fail(500, 'خطا در ذخیره فایل.'));
    out.on('finish', () => {
      if (failed) return;
      // APK در واقع یک فایل zip است (با PK شروع می‌شود)
      if (!head || head[0] !== 0x50 || head[1] !== 0x4b) return fail(400, 'این فایل APK اندروید نیست.');
      fs.renameSync(part, APK_FILE);
      const meta = { originalName: name, note, size: bytes, sha256: hash.digest('hex'), uploadedAt: new Date().toISOString(), downloads: 0 };
      fs.writeFileSync(APK_META, JSON.stringify(meta, null, 2));
      console.log(`android apk uploaded (${bytes} bytes)`);
      res.json({ success: true, message: 'اپ اندروید روی سرور قرار گرفت.', apk: meta });
    });
  });

  router.delete('/admin/android', requireAdmin, (_req, res) => {
    fs.rmSync(ANDROID_DIR, { recursive: true, force: true });
    res.json({ success: true, message: 'اپ اندروید از سرور حذف شد.' });
  });
}
