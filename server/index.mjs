// سرور مرکزی لایسنس گیم‌نت
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createStore } from './license/store.mjs';
import { createLicenseRouter } from './license/routes.mjs';
import { loadSigningKey } from './license/keys.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || process.env.APP_PORT || process.env.LICENSE_PORT || '3000', 10);
// پشت Nginx فقط روی 127.0.0.1 گوش بدهید (HOST=127.0.0.1)
const HOST = process.env.HOST || '0.0.0.0';

export async function startStandaloneServer() {
  const key = loadSigningKey();
  if (!key) {
    console.error('❌ License signing key not found. Run "npm run license:keygen" or set LICENSE_PRIVATE_KEY.');
    process.exit(1);
  }
  const store = await createStore();

  const app = express();
  app.disable('x-powered-by');
  // پشت پروکسی (Railway، Nginx، Cloudflare) برای تشخیص درست IP در محدودکننده درخواست
  if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);

  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });

  // برنامه دسکتاپ Origin ندارد؛ پنل ادمین از همین سرور سرو می‌شود.
  // احراز هویت با هدر Bearer است (نه کوکی)، پس CORS باز خطر CSRF ندارد.
  const allowed = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || origin === 'null' || allowed.includes('*') || allowed.includes(origin)),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  }));

  const json = express.json({ limit: '100kb' });
  app.use((req, res, next) => (req.path === '/api/admin/restore' ? next() : json(req, res, next)));

  app.get(['/health', '/api/health'], (_req, res) => res.json({ status: 'ok', database: store.kind === 'postgresql' ? 'PostgreSQL' : 'JSON File', uptime: process.uptime() }));

  // پروکسی SMS.ir (برای نسخه وب)
  app.all('/api/sms-ir*', async (req, res) => {
    const targetPath = req.url.replace(/^\/api\/sms-ir/, '') || '/';
    try {
      const headers = { Accept: 'application/json' };
      if (req.headers['x-api-key']) headers['x-api-key'] = String(req.headers['x-api-key']);
      if (req.headers['content-type']) headers['content-type'] = String(req.headers['content-type']);
      const apiRes = await fetch(`https://api.sms.ir/v1${targetPath}`, {
        method: req.method,
        headers,
        body: req.method === 'POST' || req.method === 'PUT' ? JSON.stringify(req.body) : undefined,
      });
      res.status(apiRes.status).set('Content-Type', 'application/json; charset=utf-8').send(await apiRes.text());
    } catch (err) {
      res.status(502).json({ status: 0, message: `خطای اتصال به سرور SMS.ir: ${err?.message || err}` });
    }
  });

  app.use('/api', createLicenseRouter(store));
  app.use('/api', (_req, res) => res.status(404).json({ success: false, message: 'مسیر پیدا نشد.' }));

  const distPath = path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get(['/admin', '/admin/'], (_req, res) => res.sendFile(path.join(distPath, 'admin.html')));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  } else {
    app.get('/', (_req, res) => res.json({ status: 'active', service: 'GameNet License Server' }));
  }

  app.listen(PORT, HOST, () => {
    console.log(`🚀 GameNet License Server on http://${HOST}:${PORT}`);
    console.log(`🔐 Storage: ${store.kind} | signing key id: ${key.kid}`);
  });
}

if (process.argv[1] && /server[\\/]index\.mjs$/.test(process.argv[1])) {
  startStandaloneServer().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
