// ساخت کلید امضای آپدیت (فقط یک بار، روی کامپیوتر خودتان)
//   update-signing/update-private.pem  ← محرمانه؛ هرگز روی سرور یا گیت‌هاب نگذارید. بکاپ بگیرید.
//   electron/update-public.pem         ← داخل برنامه قرار می‌گیرد (کامیت کنید)
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const priv = path.join(root, 'update-signing', 'update-private.pem');
const pub = path.join(root, 'electron', 'update-public.pem');

if (fs.existsSync(priv) && !process.argv.includes('--force')) {
  console.error(`کلید از قبل وجود دارد: ${priv}\nکلید جدید یعنی برنامه‌های نصب‌شده دیگر آپدیت نمی‌گیرند. فقط اگر مطمئنید با --force اجرا کنید.`);
  process.exit(1);
}
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
fs.mkdirSync(path.dirname(priv), { recursive: true });
fs.writeFileSync(priv, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
fs.writeFileSync(pub, publicKey.export({ type: 'spki', format: 'pem' }));
console.log(`✅ کلید خصوصی: ${priv}   (از این فایل بکاپ بگیرید)`);
console.log(`✅ کلید عمومی:  ${pub}   (کامیت کنید و برنامه را بیلد کنید)`);
