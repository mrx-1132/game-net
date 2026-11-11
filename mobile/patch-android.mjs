// اجازه HTTP روی شبکه داخلی + مجوز اثر انگشت + اعلان
import fs from 'fs';
const p = 'android/app/src/main/AndroidManifest.xml';
let x = fs.readFileSync(p, 'utf8');
if (!x.includes('usesCleartextTraffic')) x = x.replace('<application', '<application android:usesCleartextTraffic="true"');
if (!x.includes('USE_BIOMETRIC')) x = x.replace('</manifest>', '    <uses-permission android:name="android.permission.USE_BIOMETRIC" />\n</manifest>');
// اعلان پایان وقت سیستم‌ها (تایمر دلخواه) در زمان دقیق، حتی وقتی اپ بسته است
const perms = [
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" android:maxSdkVersion="32" />',
  '<uses-permission android:name="android.permission.USE_EXACT_ALARM" />',
  '<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />',
  '<uses-permission android:name="android.permission.VIBRATE" />',
];
for (const pm of perms) {
  const name = pm.match(/android:name="([^"]+)"/)[1];
  if (!x.includes(name)) x = x.replace('</manifest>', `    ${pm}\n</manifest>`);
}
fs.writeFileSync(p, x);
console.log('AndroidManifest patched');
