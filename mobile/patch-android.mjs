// اجازه HTTP روی شبکه داخلی + مجوز اثر انگشت
import fs from 'fs';
const p = 'android/app/src/main/AndroidManifest.xml';
let x = fs.readFileSync(p, 'utf8');
if (!x.includes('usesCleartextTraffic')) x = x.replace('<application', '<application android:usesCleartextTraffic="true"');
if (!x.includes('USE_BIOMETRIC')) x = x.replace('</manifest>', '    <uses-permission android:name="android.permission.USE_BIOMETRIC" />\n</manifest>');
fs.writeFileSync(p, x);
console.log('AndroidManifest patched');
