// کلید امضای لایسنس (Ed25519)
// کلید خصوصی فقط روی سرور است؛ برنامه کلاینت فقط کلید عمومی را دارد.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PRIVATE_KEY_FILE = path.join(__dirname, '..', 'keys', 'license-private.pem');

const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function keyIdOf(publicKey) {
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(der).digest('hex').slice(0, 16);
}

function readPrivatePem() {
  if (process.env.LICENSE_PRIVATE_KEY) {
    // در پنل‌های هاست معمولاً خط جدید به صورت \n ذخیره می‌شود
    return process.env.LICENSE_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
  const file = process.env.LICENSE_PRIVATE_KEY_FILE || DEFAULT_PRIVATE_KEY_FILE;
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  return null;
}

let cached = null;
export function loadSigningKey() {
  if (cached) return cached;
  const pem = readPrivatePem();
  if (!pem) return null;
  const privateKey = crypto.createPrivateKey(pem);
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('LICENSE_PRIVATE_KEY must be an Ed25519 key (run: npm run license:keygen)');
  }
  const publicKey = crypto.createPublicKey(privateKey);
  cached = { privateKey, publicKey, kid: keyIdOf(publicKey) };
  return cached;
}

export function signToken(payload) {
  const key = loadSigningKey();
  if (!key) throw new Error('signing key not configured');
  const body = b64url(JSON.stringify({ ...payload, kid: key.kid }));
  const sig = crypto.sign(null, Buffer.from(body), key.privateKey);
  return `${body}.${b64url(sig)}`;
}

// امضا را بررسی می‌کند ولی تاریخ انقضا را نه (برای تمدید توکن‌های منقضی‌شده)
export function verifyTokenSignature(token) {
  const key = loadSigningKey();
  if (!key || typeof token !== 'string' || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const ok = crypto.verify(null, Buffer.from(parts[0]), key.publicKey, Buffer.from(parts[1], 'base64url'));
    if (!ok) return null;
    return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}
