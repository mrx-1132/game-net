# API سرور لایسنس (برای سایت فروش اشتراک)

سایت با این API بعد از خرید اشتراک، حساب نرم‌افزار را می‌سازد و تمدید می‌کند.

## کلید API
پنل مدیریت سرور لایسنس ← **امنیت** ← **کلیدهای API** ← ساخت کلید (مثلاً «سایت»).
کلید فقط یک بار نمایش داده می‌شود؛ روی سرور فقط هش آن ذخیره است. فقط در تنظیمات سرور سایت بگذارید
(هرگز در کد سمت مرورگر). هر وقت لازم شد از همان‌جا باطلش کنید.

همه درخواست‌ها:
```
Authorization: Bearer gnk_...
Content-Type: application/json
```
آدرس پایه: `https://license.yourdomain.ir/api/v1` — محدودیت: ۱۲۰ درخواست در دقیقه.

## قوانین
- **externalId**: شناسه مشتری در سایت (۱ تا ۶۴ کاراکتر `A-Z a-z 0-9 _ -`). برای هر externalId فقط یک حساب.
- **نام کاربری**: ۴ تا ۳۰ کاراکتر، با حرف انگلیسی شروع شود؛ فقط حروف انگلیسی، عدد و `_ . -`.
- **رمز عبور**: حداقل ۸ کاراکتر، بدون فاصله، حداقل یک حرف بزرگ، یک حرف کوچک و یک عدد.

## مسیرها

| روش | مسیر | کار |
|---|---|---|
| GET | `/ping` | تست کلید |
| GET | `/usernames/{username}` | `{ available }` آزاد بودن نام کاربری |
| POST | `/licenses` | ساخت حساب |
| GET | `/licenses/{externalId}` | وضعیت حساب |
| PATCH | `/licenses/{externalId}` | تمدید / تغییر وضعیت / مشخصات |
| PUT | `/licenses/{externalId}/password` | تغییر رمز |

### ساخت حساب
```json
POST /licenses
{
  "externalId": "cm123abc",
  "username": "atomclub",
  "password": "Atom2026x",
  "businessName": "گیم نت اتم",
  "ownerName": "رضا",
  "phoneNumber": "09120000000",
  "endsAt": "2027-05-01T00:00:00Z",   // یا "lifetime": true
  "maxDevices": 1,
  "remote": true
}
```
پاسخ `201`: `{ "success": true, "license": { "username", "status", "endDateISO", "deviceCount", "maxDevices", "features": { "remote" }, "externalId", ... } }`

### تمدید یا تغییر
```json
PATCH /licenses/cm123abc
{ "endsAt": "2027-11-01T00:00:00Z", "status": "active", "remote": true }
```
سایت منبع اصلی تاریخ اشتراک است: تاریخ پایان جدید را مستقیم بفرستید (تکرار درخواست مشکلی ایجاد نمی‌کند).
`status`: `active` یا `suspended`.

### تغییر رمز
```json
PUT /licenses/cm123abc/password
{ "password": "NewPass99" }
```

## خطاها
پاسخ خطا: `{ "success": false, "code": "...", "message": "متن فارسی برای نمایش" }`

| code | HTTP | معنی |
|---|---|---|
| `unauthorized` | 401 | کلید API نامعتبر یا باطل‌شده |
| `invalid_username` / `invalid_password` / `invalid_external_id` / `invalid_end` | 400 | ورودی نامعتبر |
| `username_taken` | 409 | نام کاربری گرفته شده |
| `external_exists` | 409 | برای این مشتری قبلاً حساب ساخته شده (حساب موجود در `license` برمی‌گردد) |
| `not_found` | 404 | حسابی برای این externalId نیست |

همه کارهای API با نام کلید در لاگ سرور ثبت می‌شود: `journalctl -u gamenet-license | grep "^api"`
