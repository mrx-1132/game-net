// ورود دومرحله‌ای پنل مدیریت (TOTP، استاندارد RFC 6238 — Google/Microsoft Authenticator)
// کلید مخفی در LICENSE_DATA_DIR/admin-security.json ذخیره می‌شود (کنار دیتابیس، با دسترسی 600).
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.LICENSE_DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'admin-security.json');
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PENDING_TTL_MS = 10 * 60 * 1000;

export function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0; const out = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export function totpAt(secretB32, counter) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', base32Decode(secretB32)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

// counter معتبر را برمی‌گرداند (با تحمل ±۳۰ ثانیه) یا null
function matchCounter(secretB32, code, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code || ''))) return null;
  const c = Math.floor(now / 30000);
  for (const d of [0, -1, 1]) {
    const a = Buffer.from(totpAt(secretB32, c + d));
    const b = Buffer.from(String(code));
    if (crypto.timingSafeEqual(a, b)) return c + d;
  }
  return null;
}

function read() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}
function write(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}

export const adminTotp = {
  enabled() {
    return !!read().secret;
  },
  // تأیید کد هنگام ورود؛ هر کد فقط یک بار قابل استفاده است
  verify(code) {
    const s = read();
    if (!s.secret) return true;
    const counter = matchCounter(s.secret, code);
    if (counter === null || counter <= (s.lastCounter || 0)) return false;
    s.lastCounter = counter;
    write(s);
    return true;
  },
  startSetup(account, issuer) {
    const s = read();
    const secret = base32Encode(crypto.randomBytes(20));
    s.pending = { secret, at: Date.now() };
    write(s);
    const label = encodeURIComponent(`${issuer}:${account}`);
    const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    return { secret, uri };
  },
  confirmSetup(code) {
    const s = read();
    if (!s.pending || Date.now() - s.pending.at > PENDING_TTL_MS) return false;
    const counter = matchCounter(s.pending.secret, code);
    if (counter === null) return false;
    s.secret = s.pending.secret;
    s.lastCounter = 0;
    s.enabledAt = new Date().toISOString();
    delete s.pending;
    write(s);
    return true;
  },
  disable() {
    write({});
  },
};
