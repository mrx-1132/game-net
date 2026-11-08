// اگر گوشی (برنامه Authenticator) گم شد: غیرفعال کردن ورود دومرحله‌ای از روی خود سرور
//   sudo bash -c 'set -a; . /etc/gamenet-license.env; cd /opt/gamenet-license && node server/tools/admin-2fa.mjs disable'
import 'dotenv/config';
import { adminTotp } from '../license/totp.mjs';

const cmd = process.argv[2];
if (cmd === 'status') {
  console.log(adminTotp.enabled() ? '2FA: enabled' : '2FA: disabled');
} else if (cmd === 'disable') {
  adminTotp.disable();
  console.log('✅ 2FA disabled. Log in with the password and enable it again from the panel.');
} else {
  console.log('Usage: node server/tools/admin-2fa.mjs status|disable');
  process.exit(1);
}
