// لایه ذخیره‌سازی لایسنس‌ها و دستگاه‌ها
// PostgreSQL (اگر DATABASE_URL تنظیم شده باشد) یا فایل JSON محلی.
// خروجی بکاپ هر دو یکسان است، پس می‌شود بین سرورها و بین این دو حالت جابه‌جا شد.
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.LICENSE_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const LEGACY_FILE = path.join(DATA_DIR, 'licenses.json');

export const BACKUP_FORMAT = 'gamenet-license-backup';
export const BACKUP_VERSION = 1;

const iso = (v) => (v == null ? null : typeof v === 'string' ? v : new Date(v).toISOString());

function normalizeLicense(r) {
  let features = r.features;
  if (typeof features === 'string') {
    try { features = JSON.parse(features); } catch { features = null; }
  }
  return {
    id: String(r.id),
    username: String(r.username),
    password_hash: String(r.password_hash),
    business_name: r.business_name || '',
    owner_name: r.owner_name || '',
    phone_number: r.phone_number || '',
    subscription_type: r.subscription_type || '6months',
    start_date: iso(r.start_date),
    end_date: iso(r.end_date),
    status: r.status === 'suspended' ? 'suspended' : 'active',
    max_devices: Number.isInteger(Number(r.max_devices)) && Number(r.max_devices) > 0 ? Number(r.max_devices) : 1,
    features: features && typeof features === 'object' ? { remote: features.remote !== false } : { remote: true },
    // شناسه حساب در سیستم بیرونی (مثلاً سایت فروش) — برای ساخت/تمدید از طریق API
    external_id: r.external_id ? String(r.external_id) : null,
    created_at: iso(r.created_at) || new Date().toISOString(),
  };
}

function normalizeDevice(r) {
  return {
    id: String(r.id),
    license_id: String(r.license_id),
    device_hash: String(r.device_hash),
    name: r.name || '',
    activated_at: iso(r.activated_at) || new Date().toISOString(),
    last_seen: iso(r.last_seen),
    last_ip: r.last_ip || '',
  };
}

// ---------- JSON file store ----------
class FileStore {
  constructor() {
    this.kind = 'json-file';
    this.data = { licenses: [], devices: [] };
  }

  async init() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      this.data = {
        licenses: (parsed.licenses || []).map(normalizeLicense),
        devices: (parsed.devices || []).map(normalizeDevice),
      };
    } else if (fs.existsSync(LEGACY_FILE)) {
      // مهاجرت از فرمت قدیمی (آرایه لایسنس‌ها)
      const legacy = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8'));
      this.data = { licenses: (Array.isArray(legacy) ? legacy : []).map(normalizeLicense), devices: [] };
      this.flush();
      console.log('ℹ️ Migrated legacy licenses.json to db.json');
    } else {
      this.flush();
    }
  }

  flush() {
    // نوشتن اتمیک: اول فایل موقت، بعد rename
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, DB_FILE);
  }

  async listLicenses() {
    return [...this.data.licenses].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
  async getLicenseById(id) {
    return this.data.licenses.find((l) => l.id === id) || null;
  }
  async getLicenseByUsername(username) {
    const u = String(username || '').trim().toLowerCase();
    return this.data.licenses.find((l) => l.username.toLowerCase() === u) || null;
  }
  async getLicenseByExternalId(externalId) {
    return this.data.licenses.find((l) => l.external_id && l.external_id === String(externalId)) || null;
  }
  async saveLicense(lic) {
    const l = normalizeLicense(lic);
    const i = this.data.licenses.findIndex((x) => x.id === l.id);
    if (i >= 0) this.data.licenses[i] = l; else this.data.licenses.push(l);
    this.flush();
    return l;
  }
  async deleteLicense(id) {
    const before = this.data.licenses.length;
    this.data.licenses = this.data.licenses.filter((l) => l.id !== id);
    this.data.devices = this.data.devices.filter((d) => d.license_id !== id);
    this.flush();
    return this.data.licenses.length < before;
  }
  async listDevices(licenseId) {
    return this.data.devices.filter((d) => d.license_id === licenseId);
  }
  async countDevicesByLicense() {
    const m = {};
    for (const d of this.data.devices) m[d.license_id] = (m[d.license_id] || 0) + 1;
    return m;
  }
  async findDevice(licenseId, deviceHash) {
    return this.data.devices.find((d) => d.license_id === licenseId && d.device_hash === deviceHash) || null;
  }
  async saveDevice(dev) {
    const d = normalizeDevice(dev);
    const i = this.data.devices.findIndex((x) => x.id === d.id);
    if (i >= 0) this.data.devices[i] = d; else this.data.devices.push(d);
    this.flush();
    return d;
  }
  async deleteDevice(id) {
    const before = this.data.devices.length;
    this.data.devices = this.data.devices.filter((d) => d.id !== id);
    this.flush();
    return this.data.devices.length < before;
  }
  async replaceAll({ licenses, devices }) {
    this.data = { licenses: licenses.map(normalizeLicense), devices: devices.map(normalizeDevice) };
    this.flush();
  }
}

// ---------- PostgreSQL store ----------
const LICENSE_COLS = ['id', 'username', 'password_hash', 'business_name', 'owner_name', 'phone_number',
  'subscription_type', 'start_date', 'end_date', 'status', 'max_devices', 'features', 'external_id', 'created_at'];
const DEVICE_COLS = ['id', 'license_id', 'device_hash', 'name', 'activated_at', 'last_seen', 'last_ip'];

function upsertSql(table, cols) {
  const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
  const set = cols.filter((c) => c !== 'id').map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  return `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${ph}) ON CONFLICT (id) DO UPDATE SET ${set}`;
}
const licenseValues = (l) => LICENSE_COLS.map((c) => (c === 'features' ? JSON.stringify(l.features) : l[c]));
const deviceValues = (d) => DEVICE_COLS.map((c) => d[c]);

class PgStore {
  constructor(url) {
    this.kind = 'postgresql';
    this.pool = new pg.Pool({
      connectionString: url,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: process.env.DATABASE_SSL_STRICT === 'true' } : false,
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }

  async init() {
    await this.pool.query(`
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
      ALTER TABLE licenses ADD COLUMN IF NOT EXISTS max_devices INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE licenses ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{"remote": true}';
      ALTER TABLE licenses ADD COLUMN IF NOT EXISTS external_id VARCHAR(64);
      CREATE UNIQUE INDEX IF NOT EXISTS licenses_external_id_key ON licenses (external_id) WHERE external_id IS NOT NULL;
      CREATE TABLE IF NOT EXISTS license_devices (
        id VARCHAR(64) PRIMARY KEY,
        license_id VARCHAR(64) NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
        device_hash VARCHAR(128) NOT NULL,
        name VARCHAR(100) DEFAULT '',
        activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen TIMESTAMPTZ,
        last_ip VARCHAR(64) DEFAULT '',
        UNIQUE (license_id, device_hash)
      );
    `);
  }

  async listLicenses() {
    return (await this.pool.query('SELECT * FROM licenses ORDER BY created_at DESC')).rows.map(normalizeLicense);
  }
  async getLicenseById(id) {
    const r = await this.pool.query('SELECT * FROM licenses WHERE id = $1', [id]);
    return r.rows[0] ? normalizeLicense(r.rows[0]) : null;
  }
  async getLicenseByUsername(username) {
    const r = await this.pool.query('SELECT * FROM licenses WHERE LOWER(username) = $1', [String(username || '').trim().toLowerCase()]);
    return r.rows[0] ? normalizeLicense(r.rows[0]) : null;
  }
  async getLicenseByExternalId(externalId) {
    const r = await this.pool.query('SELECT * FROM licenses WHERE external_id = $1', [String(externalId)]);
    return r.rows[0] ? normalizeLicense(r.rows[0]) : null;
  }
  async saveLicense(lic) {
    const l = normalizeLicense(lic);
    await this.pool.query(upsertSql('licenses', LICENSE_COLS), licenseValues(l));
    return l;
  }
  async deleteLicense(id) {
    return ((await this.pool.query('DELETE FROM licenses WHERE id = $1', [id])).rowCount || 0) > 0;
  }
  async listDevices(licenseId) {
    return (await this.pool.query('SELECT * FROM license_devices WHERE license_id = $1 ORDER BY activated_at', [licenseId])).rows.map(normalizeDevice);
  }
  async countDevicesByLicense() {
    const r = await this.pool.query('SELECT license_id, COUNT(*)::int AS n FROM license_devices GROUP BY license_id');
    return Object.fromEntries(r.rows.map((x) => [x.license_id, x.n]));
  }
  async findDevice(licenseId, deviceHash) {
    const r = await this.pool.query('SELECT * FROM license_devices WHERE license_id = $1 AND device_hash = $2', [licenseId, deviceHash]);
    return r.rows[0] ? normalizeDevice(r.rows[0]) : null;
  }
  async saveDevice(dev) {
    const d = normalizeDevice(dev);
    await this.pool.query(upsertSql('license_devices', DEVICE_COLS), deviceValues(d));
    return d;
  }
  async deleteDevice(id) {
    return ((await this.pool.query('DELETE FROM license_devices WHERE id = $1', [id])).rowCount || 0) > 0;
  }
  async replaceAll({ licenses, devices }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM license_devices');
      await client.query('DELETE FROM licenses');
      for (const l of licenses.map(normalizeLicense)) await client.query(upsertSql('licenses', LICENSE_COLS), licenseValues(l));
      for (const d of devices.map(normalizeDevice)) await client.query(upsertSql('license_devices', DEVICE_COLS), deviceValues(d));
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

// ---------- backup helpers ----------
export async function exportBackup(store) {
  const licenses = await store.listLicenses();
  const devices = [];
  for (const l of licenses) devices.push(...(await store.listDevices(l.id)));
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    licenses,
    devices,
  };
}

export async function importBackup(store, backup) {
  if (!backup || backup.format !== BACKUP_FORMAT || !Array.isArray(backup.licenses) || !Array.isArray(backup.devices)) {
    throw new Error('فایل بکاپ معتبر نیست');
  }
  if (backup.version > BACKUP_VERSION) throw new Error('نسخه فایل بکاپ از این سرور جدیدتر است');
  const ids = new Set(backup.licenses.map((l) => String(l.id)));
  const devices = backup.devices.filter((d) => ids.has(String(d.license_id)));
  await store.replaceAll({ licenses: backup.licenses, devices });
  return { licenses: backup.licenses.length, devices: devices.length };
}

export async function createStore() {
  const url = process.env.DATABASE_URL;
  const store = url ? new PgStore(url) : new FileStore();
  await store.init();
  return store;
}
