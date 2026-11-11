#!/usr/bin/env bash
# نصب سرور لایسنس گیم‌نت روی Ubuntu 22.04 / 24.04 — در کنار سایت‌ها و سرویس‌های موجود
#
#   sudo bash deploy/install-ubuntu.sh license.example.com you@example.com
#
# - به سایت‌های فعلی Nginx، Node.js سیستم و فایروال دست نمی‌زند.
# - پورت داخلی آزاد را خودش پیدا می‌کند (یا APP_PORT=3005 بدهید).
# - دوباره اجرا کردن همین دستور = آپدیت (کلیدها، دیتابیس و تنظیمات حفظ می‌شوند).
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
APP_USER=gamenet
APP_DIR=/opt/gamenet-license
NODE_DIR=/opt/gamenet-license-node
STATE_DIR=/var/lib/gamenet-license
ENV_FILE=/etc/gamenet-license.env
BACKUP_DIR=/var/backups/gamenet-license
NGINX_SITE=/etc/nginx/sites-available/gamenet-license
NODE_VERSION=v22.11.0
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mخطا: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "با sudo اجرا کنید."
[[ -n "$DOMAIN" && -n "$EMAIL" ]] || die "استفاده: sudo bash deploy/install-ubuntu.sh <دامنه> <ایمیل>"
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "دامنه نامعتبر است: $DOMAIN"
[[ -f "$SRC_DIR/server/index.mjs" ]] || die "اسکریپت را از داخل پوشه پروژه اجرا کنید."

# ابزار ss برای بررسی پورت‌ها (روی اوبونتو معمولاً هست)
command -v ss >/dev/null || { apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq iproute2 >/dev/null; }
command -v ss >/dev/null || die "ابزار ss نصب نشد."
port_owner() { ss -ltnpH "( sport = :$1 )" 2>/dev/null | sed -nE 's/.*users:\(\("([^"]+)".*/\1/p' | head -1; }
port_used()  { [[ -n "$(ss -ltnH "( sport = :$1 )" 2>/dev/null)" ]]; }

# ---------- 0) بررسی‌های اولیه (قبل از هر تغییری) ----------
say "بررسی سرور"
for p in 80 443; do
  owner=$(port_owner "$p")
  if [[ -n "$owner" && "$owner" != "nginx" ]]; then
    die "پورت $p دست «$owner» است (نه Nginx). این اسکریپت فقط کنار Nginx نصب می‌شود.
راهنمای deploy/README.md بخش «اگر وب‌سرور دیگری دارید» را ببینید. هیچ تغییری روی سرور انجام نشد."
  fi
done

# پورت داخلی: از تنظیمات قبلی، یا APP_PORT، یا اولین پورت آزاد از 3000
APP_PORT="${APP_PORT:-}"
if [[ -z "$APP_PORT" && -f "$ENV_FILE" ]]; then
  APP_PORT=$(sed -nE 's/^PORT=([0-9]+)$/\1/p' "$ENV_FILE" | head -1)
fi
if [[ -z "$APP_PORT" ]]; then
  for p in $(seq 3000 3100); do port_used "$p" || { APP_PORT=$p; break; }; done
fi
[[ "$APP_PORT" =~ ^[0-9]+$ ]] || die "پورت آزادی پیدا نشد؛ APP_PORT=... را دستی بدهید."
if port_used "$APP_PORT" && ! systemctl is-active --quiet gamenet-license 2>/dev/null; then
  die "پورت $APP_PORT دست برنامه دیگری است؛ APP_PORT را عوض کنید."
fi
echo "پورت داخلی سرور لایسنس: $APP_PORT"

# ---------- 1) swap (فقط اگر سرور swap ندارد؛ برای بیلد روی ۲ گیگ رم) ----------
if ! swapon --show | grep -q . ; then
  say "ساخت 2G swap"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------- 2) پکیج‌ها ----------
say "نصب پکیج‌ها"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
PKGS="curl ca-certificates rsync xz-utils certbot python3-certbot-nginx"
command -v nginx >/dev/null || PKGS="$PKGS nginx"
# shellcheck disable=SC2086
apt-get install -y -qq $PKGS >/dev/null

# Node.js: اگر Node سیستم ۲۰ یا بالاتر است همان، وگرنه یک Node جدا فقط برای این سرویس
# (Node سیستم و سایت فعلی شما دست نمی‌خورد)
SYS_NODE_MAJOR=$( (node -v 2>/dev/null || echo v0) | sed -E 's/^v([0-9]+).*/\1/')
if [[ "$SYS_NODE_MAJOR" -ge 20 ]]; then
  NODE_BIN=$(command -v node)
else
  NODE_BIN="$NODE_DIR/bin/node"
  if [[ ! -x "$NODE_BIN" ]]; then
    say "نصب Node.js $NODE_VERSION جدا در $NODE_DIR"
    case "$(uname -m)" in
      x86_64) ARCH=x64 ;; aarch64) ARCH=arm64 ;; *) die "معماری پشتیبانی نمی‌شود: $(uname -m)" ;;
    esac
    TARBALL="node-$NODE_VERSION-linux-$ARCH.tar.xz"
    TMP=$(mktemp -d)
    curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/$TARBALL" -o "$TMP/$TARBALL" \
      || curl -fsSL "https://npmmirror.com/mirrors/node/$NODE_VERSION/$TARBALL" -o "$TMP/$TARBALL" \
      || die "دانلود Node.js ناموفق بود."
    mkdir -p "$NODE_DIR"
    tar -xJf "$TMP/$TARBALL" -C "$NODE_DIR" --strip-components=1
    rm -rf "$TMP"
  fi
fi
NODE_BIN_DIR=$(dirname "$NODE_BIN")
export PATH="$NODE_BIN_DIR:$PATH"
echo "Node: $NODE_BIN ($("$NODE_BIN" -v))"

# ---------- 3) کاربر و پوشه‌ها ----------
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$STATE_DIR" --shell /usr/sbin/nologin "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" -m 700 "$STATE_DIR" "$STATE_DIR/data" "$STATE_DIR/keys" "$STATE_DIR/updates" "$BACKUP_DIR"
# اگر اطلاعات از سرور دیگری منتقل شده باشد، مالک فایل‌ها را درست کن
chown -R "$APP_USER:$APP_USER" "$STATE_DIR"
install -d -o root -g root -m 755 "$APP_DIR"

# ---------- 4) کپی برنامه و بیلد ----------
say "کپی برنامه به $APP_DIR"
rsync -a --delete \
  --exclude node_modules --exclude .git --exclude dist --exclude 'server/data' --exclude 'server/keys' \
  --exclude 'mobile/android' --exclude 'mobile/node_modules' --exclude '.env*' "$SRC_DIR/" "$APP_DIR/"
cd "$APP_DIR"
say "نصب وابستگی‌ها و بیلد پنل مدیریت (چند دقیقه)"
npm install --no-audit --no-fund --loglevel=error
NODE_OPTIONS=--max-old-space-size=1024 npx vite build --logLevel error
# ابزارهای بیلد بعد از ساخت پنل لازم نیستند
npm prune --omit=dev --no-audit --no-fund --loglevel=error
chown -R root:root "$APP_DIR"

# ---------- 5) کلید امضا ----------
PRIV_KEY="$STATE_DIR/keys/license-private.pem"
PUB_KEY="$STATE_DIR/keys/license-public.pem"
if [[ -f "$PRIV_KEY" ]]; then
  say "کلید امضای موجود حفظ شد"
else
  say "ساخت کلید امضای جدید"
  LICENSE_PRIVATE_KEY_FILE="$PRIV_KEY" LICENSE_PUBLIC_KEY_OUT="$PUB_KEY" "$NODE_BIN" server/tools/keygen.mjs --quiet
fi
if [[ ! -f "$PUB_KEY" ]]; then
  "$NODE_BIN" -e "const c=require('crypto'),fs=require('fs');fs.writeFileSync(process.argv[2],c.createPublicKey(fs.readFileSync(process.argv[1])).export({type:'spki',format:'pem'}))" "$PRIV_KEY" "$PUB_KEY"
fi
chown "$APP_USER:$APP_USER" "$PRIV_KEY" "$PUB_KEY"
chmod 600 "$PRIV_KEY"; chmod 644 "$PUB_KEY"

# ---------- 6) تنظیمات ----------
if [[ -f "$ENV_FILE" ]]; then
  say "فایل تنظیمات موجود حفظ شد ($ENV_FILE)"
  sed -i -E "s/^PORT=.*/PORT=$APP_PORT/" "$ENV_FILE"
else
  say "تعیین رمز پنل مدیریت"
  while true; do
    read -r -s -p "رمز مدیر (حداقل ۱۰ کاراکتر): " P1; echo
    read -r -s -p "تکرار رمز: " P2; echo
    [[ "$P1" == "$P2" ]] || { warn "رمزها یکی نیستند"; continue; }
    [[ ${#P1} -ge 10 ]] || { warn "رمز کوتاه است"; continue; }
    break
  done
  HASH=$(ADMIN_PW="$P1" "$NODE_BIN" -e "console.log(require('bcryptjs').hashSync(process.env.ADMIN_PW, 12))")
  unset P1 P2
  JWT=$("$NODE_BIN" -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  umask 077
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=$APP_PORT
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
cd $APP_DIR && runuser -u $APP_USER -- $NODE_BIN server/tools/backup.mjs export $BACKUP_DIR/licenses-\$(date +%F).json >/dev/null
find $BACKUP_DIR -name 'licenses-*.json' -mtime +30 -delete
EOF
chmod 755 /etc/cron.daily/gamenet-license-backup

# ---------- 8) سرویس ----------
say "راه‌اندازی سرویس"
sed "s#__NODE__#$NODE_BIN#g" deploy/gamenet-license.service > /etc/systemd/system/gamenet-license.service
systemctl daemon-reload
systemctl enable gamenet-license >/dev/null
systemctl restart gamenet-license
sleep 2
systemctl is-active --quiet gamenet-license || { journalctl -u gamenet-license -n 30 --no-pager; die "سرویس بالا نیامد"; }

# ---------- 9) Nginx + HTTPS (فقط یک server block جدا برای همین دامنه) ----------
say "تنظیم Nginx برای $DOMAIN"
if [[ -f "$NGINX_SITE" ]] && grep -q "ssl_certificate" "$NGINX_SITE"; then
  # گواهی قبلاً گرفته شده؛ فقط پورت را به‌روز کن
  sed -i -E "s#proxy_pass http://127\.0\.0\.1:[0-9]+;#proxy_pass http://127.0.0.1:$APP_PORT;#" "$NGINX_SITE"
  # نسخه‌های قبلی اسکریپت حجم آپلود را ۲۵ مگ گذاشته بودند؛ برای آپدیت برنامه بیشتر لازم است
  sed -i -E "s#client_max_body_size [0-9]+m;.*#client_max_body_size 400m;#" "$NGINX_SITE"
else
  sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__PORT__/$APP_PORT/g" deploy/nginx-gamenet-license.conf > "$NGINX_SITE"
fi
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/gamenet-license
if ! nginx -t 2>/tmp/gamenet-nginx-test.log; then
  rm -f /etc/nginx/sites-enabled/gamenet-license
  cat /tmp/gamenet-nginx-test.log
  die "تنظیمات Nginx خطا داد؛ سایت لایسنس غیرفعال شد و بقیه سایت‌ها دست نخوردند."
fi
systemctl reload nginx || systemctl start nginx

if ! grep -q "ssl_certificate" "$NGINX_SITE"; then
  say "گرفتن گواهی HTTPS"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect \
    || warn "گواهی گرفته نشد. رکورد A دامنه $DOMAIN باید به IP همین سرور اشاره کند (در ابر آروان: ابر خاموش). بعد دوباره اسکریپت را اجرا کنید."
fi

# ---------- 10) فایروال (فقط اگر از قبل فعال است) ----------
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  say "فایروال: باز کردن پورت‌های وب"
  ufw allow 'Nginx Full' >/dev/null
else
  warn "فایروال ufw فعال نیست؛ دست نزدیم. (اگر فعالش می‌کنید، پورت SSH و سایت‌های دیگر را هم باز کنید.)"
fi

# ---------- خلاصه ----------
cat <<EOF

$(printf '\033[1;32m')✅ نصب تمام شد$(printf '\033[0m')

  پنل مدیریت:     https://$DOMAIN/admin   (نام کاربری: admin)
  پورت داخلی:     127.0.0.1:$APP_PORT  (از بیرون قابل دسترسی نیست)
  وضعیت سرویس:    systemctl status gamenet-license
  لاگ‌ها:          journalctl -u gamenet-license -f
  بکاپ روزانه:     $BACKUP_DIR

  کلید عمومی (در پروژه در electron/license-public.pem بگذارید و برنامه را بیلد کنید):
    $PUB_KEY

  ⚠️ از کلید خصوصی یک نسخه بیرون از سرور نگه دارید:
    $PRIV_KEY
EOF
