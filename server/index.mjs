import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration from Environment Variables
const DEFAULT_PORT = parseInt(process.env.APP_PORT || process.env.PORT || process.env.LICENSE_PORT || '3000', 10);
const DEFAULT_JWT_SECRET = 'gamenet_default_super_secret_jwt_key_2026_change_in_production';
const JWT_SECRET = process.env.LICENSE_JWT_SECRET || DEFAULT_JWT_SECRET;
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || (JWT_SECRET + '_admin_dedicated_salt_2026');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
// Default hash for 'admin123' if not provided in env:
const DEFAULT_ADMIN_HASH = '$2b$10$T8zcDCcxmLqJB4fMjOQXUOeTPzM3qFgAoneJfd89qYnhaFeI3gq5W';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_HASH;

const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_SSL = process.env.DATABASE_SSL === 'true';

// Setup Database Layer (PostgreSQL with JSON File fallback for zero-config runs)
let pgPool = null;
let usePostgres = false;
const DATA_DIR = path.join(__dirname, 'data');
const LOCAL_DB_PATH = path.join(DATA_DIR, 'licenses.json');

if (DATABASE_URL) {
  try {
    pgPool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_SSL ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
    });
    usePostgres = true;
    console.log('✅ Connecting to PostgreSQL central database...');
  } catch (err) {
    console.warn('⚠️ Failed to initialize PostgreSQL pool, falling back to persistent file store:', err.message);
    usePostgres = false;
  }
} else {
  console.log('ℹ️ DATABASE_URL not set. Running with local persistent file store (server/data/licenses.json).');
}

// Ensure local fallback store directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Seed Data for local fallback
async function getInitialSeedLicenses() {
  const hash123456 = await bcrypt.hash('123456', 10);
  const hashDemo = await bcrypt.hash('demo', 10);
  const now = Date.now();

  return [
    {
      id: 'lic-1',
      username: 'game_user1',
      password_hash: hash123456,
      business_name: 'گیم نت کهکشان (اشتراک ۶ ماهه)',
      owner_name: 'حمید محمدی',
      phone_number: '09123456789',
      subscription_type: '6months',
      start_date: new Date(now).toISOString(),
      end_date: new Date(now + 180 * 24 * 3600 * 1000).toISOString(),
      status: 'active',
      created_at: new Date(now).toISOString(),
    },
    {
      id: 'lic-2',
      username: 'game_user2',
      password_hash: hash123456,
      business_name: 'کلوپ پرشین (اشتراک ۱۲ ماهه)',
      owner_name: 'سعید رضایی',
      phone_number: '09187654321',
      subscription_type: '12months',
      start_date: new Date(now).toISOString(),
      end_date: new Date(now + 365 * 24 * 3600 * 1000).toISOString(),
      status: 'active',
      created_at: new Date(now).toISOString(),
    },
    {
      id: 'lic-3',
      username: 'game_user3',
      password_hash: hash123456,
      business_name: 'گیم آریانا (اشتراک نامحدود / Lifetime)',
      owner_name: 'آرش علوی',
      phone_number: '09012223344',
      subscription_type: 'lifetime',
      start_date: new Date(now).toISOString(),
      end_date: new Date(now + 9999 * 24 * 3600 * 1000).toISOString(),
      status: 'active',
      created_at: new Date(now).toISOString(),
    },
    {
      id: 'lic-4',
      username: 'game_expired',
      password_hash: hashDemo,
      business_name: 'گیم‌سنتر طوفان (منقضی شده جهت تست)',
      owner_name: 'رضا یوسفی',
      phone_number: '09351112233',
      subscription_type: '6months',
      start_date: new Date(now - 190 * 24 * 3600 * 1000).toISOString(),
      end_date: new Date(now - 10 * 24 * 3600 * 1000).toISOString(),
      status: 'active',
      created_at: new Date(now - 190 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'lic-5',
      username: 'game_suspended',
      password_hash: hashDemo,
      business_name: 'کلوب فردا (مسدود شده جهت تست)',
      owner_name: 'مهرداد قاسمی',
      phone_number: '09154445566',
      subscription_type: '12months',
      start_date: new Date(now).toISOString(),
      end_date: new Date(now + 300 * 24 * 3600 * 1000).toISOString(),
      status: 'suspended',
      created_at: new Date(now).toISOString(),
    }
  ];
}

// Initialize Database Schema or Local Seed
export async function initDb() {
  if (usePostgres && pgPool) {
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS licenses (
          id VARCHAR(64) PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          business_name VARCHAR(255) NOT NULL,
          owner_name VARCHAR(255) NOT NULL,
          phone_number VARCHAR(50) DEFAULT '',
          subscription_type VARCHAR(50) NOT NULL DEFAULT '6months',
          start_date TIMESTAMPTZ NOT NULL,
          end_date TIMESTAMPTZ NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      console.log('✅ PostgreSQL "licenses" table initialized successfully.');

      // Check if table is empty and seed initial demo accounts
      const countRes = await pgPool.query('SELECT COUNT(*) FROM licenses');
      if (parseInt(countRes.rows[0].count, 10) === 0) {
        console.log('🌱 Seeding initial demo licenses into PostgreSQL...');
        const seeds = await getInitialSeedLicenses();
        for (const s of seeds) {
          await pgPool.query(
            `INSERT INTO licenses (id, username, password_hash, business_name, owner_name, phone_number, subscription_type, start_date, end_date, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [s.id, s.username, s.password_hash, s.business_name, s.owner_name, s.phone_number, s.subscription_type, s.start_date, s.end_date, s.status, s.created_at]
          );
        }
      }
    } catch (err) {
      console.warn('⚠️ PostgreSQL schema initialization warning:', err.message);
      usePostgres = false;
    }
  }

  // If local file store is used, ensure it has data
  if (!usePostgres) {
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      const seeds = await getInitialSeedLicenses();
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(seeds, null, 2), 'utf8');
      console.log('🌱 Initialized local licenses store at server/data/licenses.json');
    }
  }
}

// Data Access Helpers
async function getAllLicenses() {
  if (usePostgres && pgPool) {
    const res = await pgPool.query('SELECT * FROM licenses ORDER BY created_at DESC');
    return res.rows;
  }
  try {
    const content = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function findLicenseByUsername(username) {
  if (!username) return null;
  const clean = username.trim().toLowerCase();
  if (usePostgres && pgPool) {
    const res = await pgPool.query('SELECT * FROM licenses WHERE LOWER(username) = $1 LIMIT 1', [clean]);
    return res.rows[0] || null;
  }
  const all = await getAllLicenses();
  return all.find(l => l.username.toLowerCase() === clean) || null;
}

async function findLicenseById(id) {
  if (!id) return null;
  if (usePostgres && pgPool) {
    const res = await pgPool.query('SELECT * FROM licenses WHERE id = $1 LIMIT 1', [id]);
    return res.rows[0] || null;
  }
  const all = await getAllLicenses();
  return all.find(l => l.id === id) || null;
}

async function saveLicense(license) {
  if (usePostgres && pgPool) {
    await pgPool.query(
      `INSERT INTO licenses (id, username, password_hash, business_name, owner_name, phone_number, subscription_type, start_date, end_date, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         username = EXCLUDED.username,
         password_hash = EXCLUDED.password_hash,
         business_name = EXCLUDED.business_name,
         owner_name = EXCLUDED.owner_name,
         phone_number = EXCLUDED.phone_number,
         subscription_type = EXCLUDED.subscription_type,
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         status = EXCLUDED.status`,
      [
        license.id,
        license.username,
        license.password_hash,
        license.business_name,
        license.owner_name,
        license.phone_number || '',
        license.subscription_type,
        license.start_date,
        license.end_date,
        license.status,
        license.created_at || new Date().toISOString()
      ]
    );
    return license;
  }

  const all = await getAllLicenses();
  const idx = all.findIndex(l => l.id === license.id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...license };
  } else {
    all.unshift(license);
  }
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(all, null, 2), 'utf8');
  return license;
}

async function deleteLicenseById(id) {
  if (usePostgres && pgPool) {
    const res = await pgPool.query('DELETE FROM licenses WHERE id = $1', [id]);
    return (res.rowCount || 0) > 0;
  }

  const all = await getAllLicenses();
  const filtered = all.filter(l => l.id !== id);
  if (filtered.length !== all.length) {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(filtered, null, 2), 'utf8');
    return true;
  }
  return false;
}

// Convert DB Model to Public Client Representation (Never leak password_hash)
function toPublicLicenseUser(row) {
  if (!row) return null;
  const now = new Date();
  const endDate = new Date(row.end_date);
  const isExpired = endDate < now;

  let computedStatus = row.status;
  if (row.status === 'active' && isExpired) {
    computedStatus = 'expired';
  }

  return {
    id: row.id,
    username: row.username,
    businessName: row.business_name,
    ownerName: row.owner_name,
    phoneNumber: row.phone_number || '',
    subscriptionType: row.subscription_type,
    startDateISO: typeof row.start_date === 'string' ? row.start_date : new Date(row.start_date).toISOString(),
    endDateISO: typeof row.end_date === 'string' ? row.end_date : new Date(row.end_date).toISOString(),
    status: computedStatus,
    rawStatus: row.status,
    isExpired,
    createdAtISO: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString()
  };
}

// Authentication Middlewares
export async function authenticateClient(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'توکن احراز هویت لایسنس ارسال نشده است.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'client') {
      return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز (نقش مشتری نیاز است).' });
    }

    // Real-time verification against the database to catch suspension or revocation immediately
    const user = await findLicenseById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'کاربر لایسنس در سیستم یافت نشد یا حذف شده است.' });
    }
    if (user.status === 'suspended' || user.status === 'disabled') {
      return res.status(403).json({
        success: false,
        status: user.status,
        message: 'حساب لایسنس شما مسدود یا غیرفعال شده است. لطفاً با پشتیبانی تماس بگیرید.'
      });
    }

    // Real-time expiration check per requirement 5
    if (user.subscription_type !== 'lifetime') {
      const endDate = new Date(user.end_date);
      if (endDate < new Date()) {
        return res.status(403).json({
          success: false,
          status: 'expired',
          message: 'اعتبار اشتراک لایسنس شما منقضی شده است. لطفاً جهت تمدید اشتراک اقدام نمایید.'
        });
      }
    }

    req.client = decoded;
    req.licenseUser = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'توکن لایسنس منقضی شده یا نامعتبر است.' });
  }
}

export function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'توکن احراز هویت مدیریت ارسال نشده است.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز (نیازمند سطح مدیر سیستم).' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'توکن نشست مدیریت منقضی شده یا نامعتبر است.' });
  }
}

// Express Router Factory
export function createLicenseRouter() {
  const router = express.Router();

  // Enable CORS on the router for cross-origin or iframe requests
  router.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'x-api-key']
  }));

  // Health check
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'GameNet Central License Server',
      database: usePostgres ? 'PostgreSQL' : 'Local Persistent JSON',
      time: new Date().toISOString()
    });
  });

  // 1. Client Login: POST /api/license/login
  router.post('/license/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'نام کاربری و رمز عبور لایسنس الزامی است.' });
      }

      const user = await findLicenseByUsername(username);
      if (!user) {
        return res.status(401).json({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' });
      }

      const isPasswordValid = await bcrypt.compare(String(password), user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' });
      }

      if (user.status === 'suspended' || user.status === 'disabled') {
        return res.status(403).json({
          success: false,
          status: user.status,
          message: 'حساب لایسنس شما توسط مدیر سیستم مسدود (Suspended) شده است. لطفاً با پشتیبانی تماس بگیرید.'
        });
      }

      // Requirement 4: Reject login if expired! Return HTTP 403. No JWT token issued!
      if (user.subscription_type !== 'lifetime') {
        const endDate = new Date(user.end_date);
        if (endDate < new Date()) {
          return res.status(403).json({
            success: false,
            status: 'expired',
            message: 'اعتبار اشتراک لایسنس شما به پایان رسیده و منقضی شده است. امکان ورود به نرم‌افزار وجود ندارد؛ جهت تمدید اشتراک اقدام نمایید.'
          });
        }
      }

      const publicUser = toPublicLicenseUser(user);

      // Sign JWT session token only for valid, active, non-expired license
      const token = jwt.sign(
        {
          role: 'client',
          id: user.id,
          username: user.username,
          businessName: user.business_name
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        message: 'ورود موفق به سامانه لایسنس.',
        token,
        user: publicUser
      });
    } catch (error) {
      console.error('License login error:', error);
      res.status(500).json({ success: false, message: 'خطای داخلی سرور در تایید لایسنس.' });
    }
  });

  // 2. Client Subscription Status: GET /api/license/me
  router.get('/license/me', authenticateClient, async (req, res) => {
    try {
      const publicUser = toPublicLicenseUser(req.licenseUser);
      return res.json({
        success: true,
        user: publicUser
      });
    } catch (error) {
      console.error('License me error:', error);
      res.status(500).json({ success: false, message: 'خطای بررسی اشتراک لایسنس.' });
    }
  });

  // 3. Admin Login: POST /api/admin/login
  router.post('/admin/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'نام کاربری و رمز عبور مدیر الزامی است.' });
      }

      if (username.trim().toLowerCase() !== ADMIN_USERNAME.trim().toLowerCase()) {
        return res.status(401).json({ success: false, message: 'اطلاعات ورود مدیر صحیح نیست.' });
      }

      let isMatch = false;
      if (ADMIN_PASSWORD_HASH.startsWith('$2a$') || ADMIN_PASSWORD_HASH.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(String(password), ADMIN_PASSWORD_HASH);
      } else {
        isMatch = String(password) === ADMIN_PASSWORD_HASH;
      }

      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'اطلاعات ورود مدیر صحیح نیست.' });
      }

      const token = jwt.sign(
        { role: 'admin', username: ADMIN_USERNAME },
        ADMIN_JWT_SECRET,
        { expiresIn: '4h' }
      );

      return res.json({
        success: true,
        message: 'ورود مدیر کل با موفقیت انجام شد.',
        token,
        role: 'admin'
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ success: false, message: 'خطای ورود مدیریت.' });
    }
  });

  // 4. Admin Get Licenses: GET /api/admin/licenses
  router.get('/admin/licenses', authenticateAdmin, async (req, res) => {
    try {
      const all = await getAllLicenses();
      const safeLicenses = all.map(toPublicLicenseUser);
      return res.json({
        success: true,
        licenses: safeLicenses
      });
    } catch (error) {
      console.error('Admin get licenses error:', error);
      res.status(500).json({ success: false, message: 'خطا در دریافت لیست لایسنس‌ها.' });
    }
  });

  // 5. Admin Create License: POST /api/admin/licenses
  router.post('/admin/licenses', authenticateAdmin, async (req, res) => {
    try {
      const {
        username,
        password,
        businessName,
        ownerName,
        phoneNumber,
        subscriptionType = '6months',
        customDays = 30,
        status = 'active'
      } = req.body || {};

      if (!username || !password || !businessName) {
        return res.status(400).json({ success: false, message: 'تکمیل نام کاربری، رمز عبور و نام مجموعه الزامی است.' });
      }

      const existing = await findLicenseByUsername(username);
      if (existing) {
        return res.status(400).json({ success: false, message: 'این نام کاربری قبلاً در سامانه ثبت شده است.' });
      }

      const password_hash = await bcrypt.hash(String(password), 10);
      const now = Date.now();
      let days = 180;
      if (subscriptionType === '12months') days = 365;
      else if (subscriptionType === 'lifetime') days = 9999;
      else if (subscriptionType === 'custom') days = Number(customDays) || 30;

      const newLicense = {
        id: `lic-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        username: username.trim(),
        password_hash,
        business_name: businessName.trim(),
        owner_name: (ownerName || '').trim(),
        phone_number: (phoneNumber || '').trim(),
        subscription_type: subscriptionType,
        start_date: new Date(now).toISOString(),
        end_date: new Date(now + days * 24 * 3600 * 1000).toISOString(),
        status: status === 'suspended' ? 'suspended' : 'active',
        created_at: new Date(now).toISOString()
      };

      await saveLicense(newLicense);
      return res.status(201).json({
        success: true,
        message: 'لایسنس جدید با موفقیت ایجاد گردید.',
        license: toPublicLicenseUser(newLicense)
      });
    } catch (error) {
      console.error('Admin create license error:', error);
      res.status(500).json({ success: false, message: 'خطا در ثبت لایسنس جدید.' });
    }
  });

  // 6. Admin Update License: PATCH /api/admin/licenses/:id
  router.patch('/admin/licenses/:id', authenticateAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await findLicenseById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'لایسنس مورد نظر یافت نشد.' });
      }

      const updates = req.body || {};
      if (updates.businessName) existing.business_name = updates.businessName.trim();
      if (updates.ownerName !== undefined) existing.owner_name = updates.ownerName.trim();
      if (updates.phoneNumber !== undefined) existing.phone_number = updates.phoneNumber.trim();
      if (updates.status) existing.status = updates.status;
      if (updates.subscriptionType) existing.subscription_type = updates.subscriptionType;
      if (updates.endDateISO) existing.end_date = updates.endDateISO;
      if (updates.startDateISO) existing.start_date = updates.startDateISO;

      if (updates.password && String(updates.password).trim().length > 0) {
        existing.password_hash = await bcrypt.hash(String(updates.password).trim(), 10);
      }

      await saveLicense(existing);
      return res.json({
        success: true,
        message: 'اطلاعات لایسنس با موفقیت به‌روزرسانی شد.',
        license: toPublicLicenseUser(existing)
      });
    } catch (error) {
      console.error('Admin update license error:', error);
      res.status(500).json({ success: false, message: 'خطا در ویرایش لایسنس.' });
    }
  });

  // 7. Admin Delete License: DELETE /api/admin/licenses/:id
  router.delete('/admin/licenses/:id', authenticateAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await deleteLicenseById(id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'لایسنس برای حذف یافت نشد.' });
      }
      return res.json({ success: true, message: 'لایسنس با موفقیت حذف گردید.' });
    } catch (error) {
      console.error('Admin delete license error:', error);
      res.status(500).json({ success: false, message: 'خطا در حذف لایسنس.' });
    }
  });

  return router;
}

// Standalone Server Execution
let isServerStarted = false;
export async function startStandaloneServer() {
  if (isServerStarted) return;
  isServerStarted = true;
  await initDb();
  const app = express();

  const corsOrigin = process.env.CORS_ORIGIN || '*';
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Electron file://, curl, desktop apps)
      if (!origin || origin === 'null' || origin.startsWith('file://')) return callback(null, true);
      if (corsOrigin === '*' || corsOrigin.split(',').map(s => s.trim()).includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'x-api-key']
  }));
  app.use(express.json());

  // Health check endpoints for Cloud Run / Load Balancers
  app.get(['/health', '/api/health'], (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  // Proxy for SMS.ir API (allows unified backend proxy in production)
  app.all('/api/sms-ir*', async (req, res) => {
    const targetPath = req.url.replace(/^\/api\/sms-ir/, '') || '/';
    const targetUrl = `https://api.sms.ir/v1${targetPath}`;
    try {
      const headers = { 'Accept': 'application/json' };
      if (req.headers['x-api-key']) headers['x-api-key'] = String(req.headers['x-api-key']);
      if (req.headers['content-type']) headers['content-type'] = String(req.headers['content-type']);

      const apiRes = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: (req.method === 'POST' || req.method === 'PUT') ? JSON.stringify(req.body) : undefined,
      });

      const resData = await apiRes.text();
      res.status(apiRes.status)
        .set('Content-Type', 'application/json; charset=utf-8')
        .send(resData);
    } catch (err) {
      res.status(502).json({
        status: 0,
        message: `خطای اتصال به سرور SMS.ir: ${err?.message || err}`
      });
    }
  });

  const licenseRouter = createLicenseRouter();
  app.use('/api', licenseRouter);

  // Serve static frontend assets from dist
  const distPath = path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));

    // Admin Portal entry
    app.get(['/admin', '/admin/', '/admin.html'], (req, res) => {
      const adminPath = path.join(distPath, 'admin.html');
      if (fs.existsSync(adminPath)) {
        return res.sendFile(adminPath);
      }
      return res.sendFile(path.join(distPath, 'index.html'));
    });

    // SPA fallback for all frontend client-side routes
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      res.status(404).send('Application build not found.');
    });
  } else {
    // If running as a standalone API-only service without dist build
    app.get('/', (req, res) => {
      res.json({
        status: 'active',
        service: 'GameNet Central License Server',
        database: usePostgres ? 'PostgreSQL Central Database' : 'Local Persistent Storage'
      });
    });
  }

  // Gracefully listen on the preferred port, falling back to 3000 if the port is already bound
  function listenOnPort(targetPort) {
    const server = app.listen(targetPort, '0.0.0.0', () => {
      console.log(`🚀 GameNet Server is running on http://0.0.0.0:${targetPort}`);
      console.log(`📡 Endpoints:`);
      console.log(`   - GET   /health`);
      console.log(`   - POST  /api/license/login`);
      console.log(`   - GET   /api/license/me`);
      console.log(`   - POST  /api/admin/login`);
      console.log(`   - GET   /api/admin/licenses`);
      console.log(`   - POST  /api/admin/licenses`);
      console.log(`   - PATCH /api/admin/licenses/:id`);
      console.log(`   - DELETE /api/admin/licenses/:id`);
      console.log(`🔐 Database: ${usePostgres ? 'PostgreSQL Central Database' : 'Local Persistent File Store'}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && targetPort !== 3000) {
        console.warn(`⚠️ Port ${targetPort} is already in use, trying fallback port 3000...`);
        listenOnPort(3000);
      } else {
        console.error('Server failed to start:', err);
        process.exit(1);
      }
    });
  }

  listenOnPort(DEFAULT_PORT);
}

// Automatically start if executed directly via "node server/index.mjs" or "node server.js"
if (process.argv[1] && (process.argv[1].endsWith('server/index.mjs') || process.argv[1].endsWith('server.js'))) {
  startStandaloneServer();
}
