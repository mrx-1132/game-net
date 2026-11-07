# نصب سرور لایسنس روی سرور خودتان (Ubuntu 24.04)

برای سرور ۲ گیگ رم و ۱۵ گیگ فضا کافی است. سرور لایسنس حدود ۸۰ مگابایت رم مصرف می‌کند و
اسکریپت برای مرحله بیلد ۲ گیگ swap می‌سازد. دیتابیس به صورت فایل JSON ذخیره می‌شود، پس
PostgreSQL لازم نیست و رم سرور آزاد می‌ماند.

## اگر روی سرور سایت یا اسکریپت دیگری دارید

اسکریپت طوری نوشته شده که کنار سایت فعلی شما کار کند:

| مورد | رفتار اسکریپت |
|---|---|
| سایت‌های فعلی Nginx | دست نمی‌خورند؛ فقط یک فایل جدا برای زیردامنه لایسنس اضافه می‌شود |
| پورت داخلی | اولین پورت آزاد از 3000 به بعد (فقط روی 127.0.0.1، از بیرون بسته) |
| Node.js سیستم | دست نمی‌خورد؛ اگر قدیمی‌تر از ۲۰ باشد، یک Node جدا در `/opt/gamenet-license-node` نصب می‌شود |
| فایروال | اگر خاموش است روشنش نمی‌کند؛ اگر روشن است فقط پورت وب را باز می‌کند |
| گواهی HTTPS | فقط برای همان زیردامنه گرفته می‌شود |

اگر خطای Nginx پیش بیاید، فقط سایت لایسنس غیرفعال می‌شود و بقیه سایت‌ها کار می‌کنند.

### اگر وب‌سرور دیگری دارید (Apache، Caddy، Docker روی پورت 80)
اسکریپت متوجه می‌شود و **بدون هیچ تغییری** متوقف می‌شود. در این حالت به من خبر بدهید چه وب‌سروری دارید
تا تنظیمش را برایتان بنویسم؛ کافی است وب‌سرور شما درخواست‌های زیردامنه لایسنس را به
`http://127.0.0.1:3000` بفرستد و سرور لایسنس را با `systemctl` اجرا کنید.

## تنظیمات ابر آروان (ArvanCloud)

اگر DNS دامنه شما روی ابر آروان است:

1. پنل آروان ← دامنه ← **DNS** ← **افزودن رکورد**
2. نوع: **A** — نام: `license` (یا هر زیردامنه‌ای که می‌خواهید) — مقدار: **IP سرور**
3. **ابر (پروکسی) را برای این رکورد خاموش کنید** (آیکون ابر خاکستری).
4. چند دقیقه صبر کنید تا DNS اعمال شود، بعد اسکریپت نصب را اجرا کنید.

چرا ابر خاموش؟
- گواهی HTTPS را سرور خودش از Let's Encrypt می‌گیرد؛ پشت CDN این کار پیچیده می‌شود.
- با ابر روشن، همه درخواست‌ها از IPهای آروان می‌آیند و محدودیت تعداد درخواست (ضد حمله حدس رمز)
  همه مشتری‌ها را با هم قاطی می‌کند.
- ترافیک سرور لایسنس خیلی کم است و به CDN نیازی ندارد.

سایت اصلی شما می‌تواند همچنان با ابر روشن بماند؛ این تنظیم فقط برای رکورد `license` است.

بررسی: از کامپیوتر خودتان `ping license.yourdomain.ir` باید IP خود سرور را نشان دهد (نه IP آروان).

## پیش‌نیاز: دامنه

برنامه نهایی فقط به آدرس **https** وصل می‌شود، پس یک دامنه یا زیردامنه لازم دارید
(مثلاً `license.yourdomain.ir`).

در پنل دامنه یک رکورد **A** بسازید که به IP سرور اشاره کند (ابر آروان/کلادفلر برای این رکورد خاموش؛
بخش «تنظیمات ابر آروان» بالا).

## نصب

با SSH وارد سرور شوید:

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/mrx-1132/game-net.git
cd game-net
sudo bash deploy/install-ubuntu.sh license.yourdomain.ir you@example.com
```

> ریپازیتوری خصوصی است: برای clone از Deploy Key استفاده کنید (مرحله ۳ فایل `SETUP-GUIDE.md`).

اسکریپت این کارها را انجام می‌دهد:

1. ساخت ۲ گیگ swap (اگر نباشد)
2. نصب Nginx (اگر نباشد)، Certbot، و Node.js 22 جدا (اگر Node سیستم قدیمی باشد)
3. ساخت کاربر جدا `gamenet` (سرور با root اجرا نمی‌شود)
4. کپی برنامه به `/opt/gamenet-license` و بیلد پنل مدیریت
5. ساخت کلید امضا در `/var/lib/gamenet-license/keys`
6. پرسیدن رمز پنل مدیریت (حداقل ۱۰ کاراکتر) و ساخت `/etc/gamenet-license.env`
7. سرویس systemd که با ری‌استارت سرور خودکار بالا می‌آید
8. Nginx + گواهی رایگان HTTPS (Let's Encrypt)
9. فایروال: اگر روشن است، پورت وب باز می‌شود
10. بکاپ خودکار روزانه در `/var/backups/gamenet-license` (۳۰ روز نگه داشته می‌شود)

بعد از نصب، پنل مدیریت: `https://license.yourdomain.ir/admin`

## بعد از نصب (مهم)

**۱. کلید عمومی را داخل برنامه بگذارید:**

```bash
sudo cat /var/lib/gamenet-license/keys/license-public.pem
```

محتوا را در پروژه روی کامپیوتر خودتان در فایل `electron/license-public.pem` بگذارید.

**۲. آدرس سرور را در برنامه بنویسید:** فایل `electron/license-config.cjs`:

```js
SERVERS: ['https://license.yourdomain.ir'],
```

بعد برنامه را بیلد کنید (`npm run electron:dist`).

**۳. از کلید خصوصی یک نسخه بیرون از سرور نگه دارید.** اگر سرور از بین برود و این کلید را
نداشته باشید، همه برنامه‌های نصب‌شده باید آپدیت شوند:

```bash
sudo cat /var/lib/gamenet-license/keys/license-private.pem
```

محتوا را در جای امن (مثلاً یک فایل رمزدار یا مدیر رمز) ذخیره کنید و جایی منتشر نکنید.

## آپدیت

```bash
cd game-net
git pull
sudo bash deploy/install-ubuntu.sh license.yourdomain.ir you@example.com
```

کلیدها، دیتابیس و رمز مدیر دست نمی‌خورند.

## دستورهای مفید

| کار | دستور |
|---|---|
| وضعیت سرویس | `systemctl status gamenet-license` |
| دیدن لاگ‌ها | `journalctl -u gamenet-license -f` |
| ری‌استارت | `sudo systemctl restart gamenet-license` |
| لیست بکاپ‌ها | `ls /var/backups/gamenet-license` |
| تغییر رمز مدیر | فایل `/etc/gamenet-license.env` را پاک کنید و اسکریپت نصب را دوباره اجرا کنید |

## انتقال از این سرور به سرور دیگر

ساده‌ترین راه: کل پوشه اطلاعات (کلیدها + دیتابیس + تنظیمات و رمز پنل) را منتقل کنید.

**روی سرور قدیم:**
```bash
sudo tar czf ~/gamenet-backup.tgz -C / var/lib/gamenet-license etc/gamenet-license.env
scp ~/gamenet-backup.tgz root@NEW_SERVER_IP:/root/
```

**در ابر آروان:** رکورد A زیردامنه `license` را به IP سرور جدید عوض کنید (ابر خاموش).

**روی سرور جدید** (اول Deploy Key جدید بسازید و در گیت‌هاب اضافه کنید، مثل نصب اول):
```bash
sudo tar xzf /root/gamenet-backup.tgz -C /
GIT_SSH_COMMAND="ssh -i ~/.ssh/gamenet_deploy -o IdentitiesOnly=yes" git clone git@github.com:mrx-1132/game-net.git
cd game-net && git config core.sshCommand "ssh -i ~/.ssh/gamenet_deploy -o IdentitiesOnly=yes"
git checkout feature/secure-licensing
sudo bash deploy/install-ubuntu.sh license.yourdomain.ir you@example.com
```
اسکریپت کلید و تنظیمات موجود را نگه می‌دارد، رمز نمی‌پرسد و کلید جدید نمی‌سازد.

**بعد از اطمینان، روی سرور قدیم:** `sudo systemctl disable --now gamenet-license`

راه جایگزین: در پنل مدیریت «بکاپ» بگیرید، فقط کلید خصوصی را قبل از نصب در
`/var/lib/gamenet-license/keys/license-private.pem` سرور جدید بگذارید، نصب کنید و در پنل جدید «بازیابی» بزنید.

برنامه‌ها چیزی حس نمی‌کنند؛ اگر انتقال چند ساعت هم طول بکشد، تا ۷ روز بدون سرور کار می‌کنند.
