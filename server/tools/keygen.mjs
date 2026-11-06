// ساخت جفت کلید امضای لایسنس (فقط یک بار)
//   کلید خصوصی  -> server/keys/license-private.pem  (محرمانه؛ حتماً جای امن بکاپ بگیرید)
//   کلید عمومی  -> electron/license-public.pem     (داخل برنامه قرار می‌گیرد)
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { keyIdOf, DEFAULT_PRIVATE_KEY_FILE } from '../license/keys.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const privFile = DEFAULT_PRIVATE_KEY_FILE;
const pubFile = path.join(root, 'electron', 'license-public.pem');

if (fs.existsSync(privFile) && !process.argv.includes('--force')) {
  console.error(`Key already exists: ${privFile}\nA new key would lock out every installed app. Use --force only if you really mean it.`);
  process.exit(1);
}

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
fs.mkdirSync(path.dirname(privFile), { recursive: true });
fs.writeFileSync(privFile, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
fs.writeFileSync(pubFile, publicKey.export({ type: 'spki', format: 'pem' }));

console.log(`✅ Private key: ${privFile}`);
console.log(`✅ Public key:  ${pubFile}`);
console.log(`   Key id: ${keyIdOf(publicKey)}`);
console.log('\nFor hosting panels, set LICENSE_PRIVATE_KEY to this one-line value:\n');
console.log(privateKey.export({ type: 'pkcs8', format: 'pem' }).trim().replace(/\n/g, '\\n'));
