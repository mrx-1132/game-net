// بکاپ و بازیابی دیتابیس لایسنس از خط فرمان
//   node server/tools/backup.mjs export backup.json
//   node server/tools/backup.mjs import backup.json --yes
// از همان DATABASE_URL (یا فایل JSON محلی) که سرور استفاده می‌کند می‌خواند/می‌نویسد.
import 'dotenv/config';
import fs from 'fs';
import { createStore, exportBackup, importBackup } from '../license/store.mjs';

const [cmd, file] = process.argv.slice(2);
if (!['export', 'import'].includes(cmd) || !file) {
  console.log('Usage:\n  node server/tools/backup.mjs export <file.json>\n  node server/tools/backup.mjs import <file.json> --yes');
  process.exit(1);
}

const store = await createStore();
if (cmd === 'export') {
  const backup = await exportBackup(store);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2), { mode: 0o600 });
  console.log(`✅ Exported ${backup.licenses.length} licenses and ${backup.devices.length} devices from ${store.kind} to ${file}`);
} else {
  if (!process.argv.includes('--yes')) {
    console.error('This REPLACES all licenses on this server. Re-run with --yes to confirm.');
    process.exit(1);
  }
  const r = await importBackup(store, JSON.parse(fs.readFileSync(file, 'utf8')));
  console.log(`✅ Imported ${r.licenses} licenses and ${r.devices} devices into ${store.kind}`);
}
if (store.pool) await store.pool.end();
