# نصب سرور لایسنس روی سرور خودتان (Ubuntu 24.04)

برای سرور ۲ گیگ رم و ۱۵ گیگ فضا کافی است. سرور لایسنس حدود ۸۰ مگابایت رم مصرف می‌کند و
اسکریپت برای مرحله بیلد ۲ گیگ swap می‌سازد. دیتابیس به صورت فایل JSON ذخیره می‌شود، پس
PostgreSQL لازم نیست و رم سرور آزاد می‌ماند.

## پیش‌نیاز: دامنه

برنامه نهایی فقط به آدرس **https** وصل می‌شود، پس یک دامنه یا زیردامنه لازم دارید
(مثلاً `license.yourdomain.ir`).

در پنل دامنه یک رکورد **A** بسازید که به IP سرور اشاره کند. اگر از Cloudflare استفاده
می‌کنید، موقع نصب ابر نارنجی (Proxy) را خاموش کنید تا گواهی HTTPS گرفته شود.

## نصب

با SSH وارد سرور شوید:

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/mrx-1132/game-net.git
cd game-net
sudo bash deploy/install-ubuntu.sh license.yourdomain.ir you@example.com
```

> اگر ریپازیتوری خصوصی است، موقع clone نام کاربری گیت‌هاب و یک
> Personal Access Token (به‌جای رمز) می‌خواهد.

اسکریپت این کارها را انجام می‌دهد:

1. ساخت ۲ گیگ swap (اگر نباشد)
2. نصب Node.js 22، Nginx، Certbot و فایروال
3. ساخت کاربر جدا `gamenet` (سرور با root اجرا نمی‌شود)
4. کپی برنامه به `/opt/gamenet-license` و بیلد پنل مدیریت
5. ساخت کلید امضا در `/var/lib/gamenet-license/keys`
6. پرسیدن رمز پنل مدیریت (حداقل ۱۰ کاراکتر) و ساخت `/etc/gamenet-license.env`
7. سرویس systemd که با ری‌استارت سرور خودکار بالا می‌آید
8. Nginx + گواهی رایگان HTTPS (Let's Encrypt)
9. فایروال: فقط SSH و وب باز است
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

1. از پنل مدیریت دکمه «بکاپ» را بزنید (یا آخرین فایل در `/var/backups/gamenet-license`).
2. روی سرور جدید **قبل از** اجرای اسکریپت نصب، کلید خصوصی قبلی را بگذارید:
   ```bash
   sudo mkdir -p /var/lib/gamenet-license/keys
   sudo nano /var/lib/gamenet-license/keys/license-private.pem   # محتوای کلید قبلی
   ```
   اسکریپت کلید موجود را نگه می‌دارد و کلید جدید نمی‌سازد.
3. اسکریپت نصب را اجرا کنید.
4. در پنل مدیریت سرور جدید دکمه «بازیابی» و انتخاب فایل بکاپ.
5. رکورد A دامنه را به IP سرور جدید عوض کنید.

برنامه‌ها چیزی حس نمی‌کنند؛ اگر چند ساعت هم طول بکشد، تا ۷ روز بدون سرور کار می‌کنند.
