# سرور مرکزی لایسنس و مدیریت اشتراک گیم‌نت (GameNet License Server)

این ماژول معماری لایسنسینگ را به یک **License Server مستقل و امن** مبتنی بر **Node.js / Express**، دیتابیس مرکزی **PostgreSQL**، هشینگ **bcrypt** و توکن‌های **JWT** ارتقا می‌دهد.

---

## 🔒 ویژگی‌های کلیدی و امنیتی

1. **حذف وابستگی به localStorage به عنوان منبع اصلی:** تمامی استعلام‌ها و تایید هویت‌ها از سمت سرور مرکزی انجام می‌شود.
2. **هشینگ رمز عبور مشتریان با bcrypt:** کلمه عبور به صورت خام (Plaintext) در هیچ‌کجا ذخیره یا ارسال نمی‌شود.
3. **عدم قرارگیری رمز مدیر یا Master Password در سورس React:** رمزهای دسترسی به محیط مدیریت به صورت متغیرهای محیطی در سرور نگهداری می‌شوند.
4. **کنترل وضعیت انقضا و مسدودسازی (Suspended) در سرور:** تصمیم‌گیری معتبر بودن اشتراک منحصراً توسط سرور انجام می‌پذیرد.
5. **نشست‌های مبتنی بر JWT:** فرانت‌اند تنها توکن Bearer کوتاه‌مدت/میان‌مدت و اطلاعات عمومی را نگهداری می‌کند.

---

## 🗄️ ساختار دیتابیس (PostgreSQL)

جدول `licenses` به طور خودکار در اولین استارت سرور ایجاد می‌شود:

```sql
CREATE TABLE IF NOT EXISTS licenses (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50) DEFAULT '',
  subscription_type VARCHAR(50) NOT NULL DEFAULT '6months',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

*نکته: در صورتی که متغیر `DATABASE_URL` خالی باشد، سرور به طور خودکار از ذخیره‌سازی محلی پایدار (`server/data/licenses.json`) جهت تست سریع و بدون نیاز به کانفیگ استفاده خواهد کرد.*

---

## 🚀 نحوه راه‌اندازی و اجرا

### ۱. تنظیم متغیرهای محیطی
یک فایل `.env` بر اساس `.env.license.example` بسازید:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/gamenet_db
DATABASE_SSL=false
LICENSE_JWT_SECRET=your_super_secret_jwt_key_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2a$10$w8.t871yZ08W0mZtV5BZe.Z39D6c3nI5sF55i7T5O5lqgY9P0iCey
LICENSE_PORT=4000
CORS_ORIGIN=*
```

#### تولید هش پسورد bcrypt برای ادمین:
```bash
node -e "console.log(require('bcryptjs').hashSync('رمز_دلخواه_مدیر', 10))"
```

### ۲. اجرای سرور لایسنس
```bash
npm run license-server
```

### ۳. اتصال فرانت‌اند (React)
در فایل محیطی فرانت‌اند (`.env`):
```env
VITE_LICENSE_API_URL=https://license.yourdomain.com
```
*(اگر خالی باشد، فرانت‌اند به مسیر `/api` دامنه فعلی متصل می‌شود)*

---

## 📡 اندپوینت‌های وب‌سرویس (API Endpoints)

### بخش مشتری (Client):
* `POST /api/license/login`
  * بدنه: `{ "username": "...", "password": "..." }`
  * خروجی: `{ "success": true, "token": "...", "user": { ... } }`
* `GET /api/license/me`
  * هدر: `Authorization: Bearer <token>`
  * خروجی: بررسی وضعیت لحظه‌ای، تاریخ انقضا و بازگشت داده‌های اشتراک.

### بخش مدیریت (Admin):
* `POST /api/admin/login`
  * بدنه: `{ "username": "admin", "password": "..." }`
  * خروجی: `{ "success": true, "token": "...", "role": "admin" }`
* `GET /api/admin/licenses`
  * دریافت لیست تمامی لایسنس‌های مشتریان (بدون فاش شدن رمزها).
* `POST /api/admin/licenses`
  * ثبت لایسنس جدید و هش کردن خودکار رمز با bcrypt.
* `PATCH /api/admin/licenses/:id`
  * ویرایش مشخصات، تمدید تاریخ، تغییر وضعیت به `suspended` یا `active`.
* `DELETE /api/admin/licenses/:id`
  * حذف لایسنس.
