// ساخت و امضای یک آپدیت برای انتشار آنلاین
//   npm run release -- 1.2.0 "توضیح کوتاه تغییرات"
// خروجی: پوشه release/<نسخه>/ شامل فایل‌های نصب (۶۴ و ۳۲ بیتی)، manifest.json و manifest.sig
// همه فایل‌های این پوشه را در پنل مدیریت ← آپدیت‌ها آپلود کنید.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = (msg) => { console.error(`\n❌ ${msg}`); process.exit(1); };
const run = (args, label) => {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) die(`${label} ناموفق بود.`);
};

// --- ورودی‌ها ---
const [versionArg, ...noteParts] = process.argv.slice(2);
const pkgFile = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
if (versionArg) {
  if (!/^\d{1,4}\.\d{1,4}\.\d{1,6}$/.test(versionArg)) die('نسخه باید به شکل 1.2.0 باشد.');
  pkg.version = versionArg;
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
}
const version = pkg.version;
const notes = noteParts.join(' ').slice(0, 500);

// --- کلیدها ---
const privFile = path.join(root, 'update-signing', 'update-private.pem');
const pubFile = path.join(root, 'electron', 'update-public.pem');
if (!fs.existsSync(privFile) || !fs.existsSync(pubFile)) die('کلید امضای آپدیت پیدا نشد. یک بار اجرا کنید:  npm run update:keygen');
const privateKey = crypto.createPrivateKey(fs.readFileSync(privFile, 'utf8'));
const pubDer = crypto.createPublicKey(fs.readFileSync(pubFile, 'utf8')).export({ type: 'spki', format: 'der' });
if (!crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).equals(pubDer)) {
  die('کلید خصوصی با electron/update-public.pem یکی نیست.');
}
if (!fs.readdirSync(path.join(root, 'electron')).some((f) => /^license-public.*\.pem$/.test(f))) {
  die('electron/license-public.pem پیدا نشد (کلید عمومی سرور لایسنس).');
}

// --- بیلد ---
const outDir = path.join(root, 'release', version);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
run([path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], 'بیلد رابط کاربری');

const builderCli = path.join(root, 'node_modules', 'electron-builder', 'cli.js');
const files = {};
for (const arch of ['x64', 'ia32']) {
  const buildDir = path.join(outDir, `build-${arch}`);
  const name = `GameNet-Manager-Setup-${version}-${arch}.exe`;
  run([builderCli, '--win', 'nsis', `--${arch}`, '--publish', 'never',
    `-c.directories.output=${buildDir}`, `-c.nsis.artifactName=${name}`], `ساخت نصب‌کننده ${arch}`);
  const src = path.join(buildDir, name);
  if (!fs.existsSync(src)) die(`فایل ${name} ساخته نشد.`);
  fs.renameSync(src, path.join(outDir, name));
  fs.rmSync(buildDir, { recursive: true, force: true });
  const buf = fs.readFileSync(path.join(outDir, name));
  files[arch] = { name, size: buf.length, sha512: crypto.createHash('sha512').update(buf).digest('base64') };
}

// --- manifest و امضا ---
const manifest = JSON.stringify({ app: 'gamenet-manager', version, date: new Date().toISOString(), notes, files }, null, 2);
fs.writeFileSync(path.join(outDir, 'manifest.json'), manifest);
fs.writeFileSync(path.join(outDir, 'manifest.sig'), crypto.sign(null, Buffer.from(manifest, 'utf8'), privateKey).toString('base64'));

console.log(`\n✅ آپدیت ${version} آماده است: ${outDir}`);
for (const f of fs.readdirSync(outDir)) console.log(`   - ${f}`);
console.log('\nحالا در پنل مدیریت ← «آپدیت‌ها» ← همه فایل‌های این پوشه را با هم انتخاب و آپلود کنید.');
