#!/usr/bin/env bash
# نصب سرور لایسنس گیم‌نت روی Ubuntu 22.04 / 24.04
#
#   sudo bash deploy/install-ubuntu.sh license.example.com you@example.com
#
# دوباره اجرا کردن همین دستور = آپدیت (کلیدها، دیتابیس و تنظیمات دست نمی‌خورند).
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
APP_USER=gamenet
APP_DIR=/opt/gamenet-license
STATE_DIR=/var/lib/gamenet-license
ENV_FILE=/etc/gamenet-license.env
BACKUP_DIR=/var/backups/gamenet-license
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# برای تست: SKIP_SYSTEM=1 مراحل systemd/nginx/certbot/ufw را رد می‌کند
SKIP_SYSTEM="${SKIP_SYSTEM:-0}"

say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mخطا: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "با sudo اجرا کنید."
[[ -n "$DOMAIN" && -n "$EMAIL" ]] || die "استفاده: sudo bash deploy/install-ubuntu.sh <دامنه> <ایمیل>"
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "دامنه نامعتبر است: $DOMAIN"
[[ -f "$SRC_DIR/server/index.mjs" ]] || die "اسکریپت را از داخل پوشه پروژه اجرا کنید."

# ---------- 1) swap (برای بیلد روی سرور ۲ گیگ) ----------
if [[ "$SKIP_SYSTEM" != 1 ]] && ! swapon --show | grep -q . ; then
  say "ساخت 2G swap"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------- 2) پکیج‌ها ----------
say "نصب پکیج‌ها"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg rsync nginx certbot python3-certbot-nginx ufw >/dev/null
NODE_MAJOR=$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0)
if [[ "${NODE_MAJOR:-0}" -lt 20 ]]; then
  say "نصب Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
node -v

# ---------- 3) کاربر و پوشه‌ها ----------
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$STATE_DIR" --shell /usr/sbin/nologin "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" -m 700 "$STATE_DIR" "$STATE_DIR/data" "$STATE_DIR/keys"
install -d -o root -g root -m 755 "$APP_DIR"
install -d -o "$APP_USER" -g "$APP_USER" -m 700 "$BACKUP_DIR"

# ---------- 4) کپی برنامه و بیلد ----------
say "کپی برنامه به $APP_DIR"
rsync -a --delete \
  --exclude node_modules --exclude .git --exclude dist --exclude 'server/data' --exclude 'server/keys' \
  --exclude mobile --exclude '.env*' "$SRC_DIR/" "$APP_DIR/"
cd "$APP_DIR"
say "نصب وابستگی‌ها و بیلد پنل مدیریت (چند دقیقه)"
npm install --omit=dev --no-audit --no-fund --loglevel=error
NODE_OPTIONS=--max-old-space-size=1024 npx vite build --logLevel error
chown -R root:root "$APP_DIR"

# ---------- 5) کلید امضا ----------
PRIV_KEY="$STATE_DIR/keys/license-private.pem"
PUB_KEY="$STATE_DIR/keys/license-public.pem"
if [[ -f "$PRIV_KEY" ]]; then
  say "کلید امضای موجود حفظ شد"
else
  say "ساخت کلید امضای جدید"
  LICENSE_PRIVATE_KEY_FILE="$PRIV_KEY" LICENSE_PUBLIC_KEY_OUT="$PUB_KEY" node server/tools/keygen.mjs --quiet
fi
if [[ ! -f "$PUB_KEY" ]]; then
  node -e "const c=require('crypto'),fs=require('fs');fs.writeFileSync(process.argv[2],c.createPublicKey(fs.readFileSync(process.argv[1])).export({type:'spki',format:'pem'}))" "$PRIV_KEY" "$PUB_KEY"
fi
chown "$APP_USER:$APP_USER" "$PRIV_KEY" "$PUB_KEY"
chmod 600 "$PRIV_KEY"; chmod 644 "$PUB_KEY"

# ---------- 6) تنظیمات ----------
if [[ -f "$ENV_FILE" ]]; then
  say "فایل تنظیمات موجود حفظ شد ($ENV_FILE)"
else
  say "تعیین رمز پنل مدیریت"
  while true; do
    read -r -s -p "رمز مدیر (حداقل ۱۰ کاراکتر): " P1; echo
    read -r -s -p "تکرار رمز: " P2; echo
    [[ "$P1" == "$P2" ]] || { warn "رمزها یکی نیستند"; continue; }
    [[ ${#P1} -ge 10 ]] || { warn "رمز کوتاه است"; continue; }
    break
  done
  HASH=$(ADMIN_PW="$P1" node -e "console.log(require('bcryptjs').hashSync(process.env.ADMIN_PW, 12))")
  unset P1 P2
  JWT=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  umask 077
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
TRUST_PROXY=loopback
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH='$HASH'
ADMIN_JWT_SECRET=$JWT
LICENSE_PRIVATE_KEY_FILE=$PRIV_KEY
LICENSE_DATA_DIR=$STATE_DIR/data
LICENSE_SERVER_URLS=https://$DOMAIN
LICENSE_TOKEN_TTL_DAYS=7
CORS_ORIGIN=https://$DOMAIN
EOF
  chmod 600 "$ENV_FILE"
fi

# ---------- 7) بکاپ روزانه ----------
cat > /etc/cron.daily/gamenet-license-backup <<EOF
#!/bin/sh
# بکاپ روزانه دیتابیس لایسنس؛ ۳۰ روز نگه داشته می‌شود
set -a; . $ENV_FILE; set +a
cd $APP_DIR && runuser -u $APP_USER -- node server/tools/backup.mjs export $BACKUP_DIR/licenses-\$(date +%F).json >/dev/null
find $BACKUP_DIR -name 'licenses-*.json' -mtime +30 -delete
EOF
chmod 755 /etc/cron.daily/gamenet-license-backup

if [[ "$SKIP_SYSTEM" == 1 ]]; then
  say "SKIP_SYSTEM=1 — مراحل سرویس/nginx/ssl/فایروال رد شد"
  exit 0
fi

# ---------- 8) سرویس ----------
say "راه‌اندازی سرویس"
install -m 644 deploy/gamenet-license.service /etc/systemd/system/gamenet-license.service
systemctl daemon-reload
systemctl enable gamenet-license >/dev/null
systemctl restart gamenet-license
sleep 2
systemctl is-active --quiet gamenet-license || { journalctl -u gamenet-license -n 30 --no-pager; die "سرویس بالا نیامد"; }

# ---------- 9) Nginx + HTTPS ----------
say "تنظیم Nginx"
sed "s/__DOMAIN__/$DOMAIN/g" deploy/nginx-gamenet-license.conf > /etc/nginx/sites-available/gamenet-license
ln -sf /etc/nginx/sites-available/gamenet-license /etc/nginx/sites-enabled/gamenet-license
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

say "گرفتن گواهی HTTPS"
if ! grep -q "ssl_certificate" /etc/nginx/sites-available/gamenet-license; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect \
    || warn "گواهی گرفته نشد. مطمئن شوید رکورد A دامنه $DOMAIN به IP همین سرور اشاره می‌کند و پورت 80 باز است؛ بعد دوباره اسکریپت را اجرا کنید."
fi

# ---------- 10) فایروال ----------
say "فایروال"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

# ---------- خلاصه ----------
cat <<EOF

$(printf '\033[1;32m')✅ نصب تمام شد$(printf '\033[0m')

  پنل مدیریت:     https://$DOMAIN/admin   (نام کاربری: admin)
  وضعیت سرویس:    systemctl status gamenet-license
  لاگ‌ها:          journalctl -u gamenet-license -f
  بکاپ روزانه:     $BACKUP_DIR

  کلید عمومی (این را در پروژه در electron/license-public.pem بگذارید و برنامه را بیلد کنید):
    $PUB_KEY

  ⚠️ از کلید خصوصی یک نسخه بیرون از سرور نگه دارید:
    $PRIV_KEY
EOF
