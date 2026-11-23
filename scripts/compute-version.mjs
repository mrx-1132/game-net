// نسخه برنامه = major.minor (از version.json) + شماره patch.
// patch = تعداد کامیت‌ها بعد از آخرین کامیتی که version.json را تغییر داده است.
// یعنی با هر کامیت یکی بالا می‌رود (1.2.1، 1.2.2، ...) و وقتی خودت version.json را
// عوض کنی (مثلاً minor: 3) دوباره از 1.3.0 شروع می‌شود.
//
// استفاده: node scripts/compute-version.mjs   (نسخه را چاپ می‌کند)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const { major, minor } = JSON.parse(readFileSync(path.join(root, 'version.json'), 'utf8'));
if (!Number.isInteger(major) || !Number.isInteger(minor)) {
  console.error('version.json باید major و minor عددی داشته باشد.');
  process.exit(1);
}

const anchor = git('log', '-1', '--format=%H', '--', 'version.json');
const patch = anchor ? Number(git('rev-list', '--count', `${anchor}..HEAD`)) : Number(git('rev-list', '--count', 'HEAD'));

console.log(`${major}.${minor}.${patch}`);
