import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import '../remote/useRemoteBridge';

// بخش جفت‌سازی گوشی داخل تنظیمات (دسترسی ادمین توسط SettingsTab کنترل می‌شود، فقط داخل Electron)
// - اندروید: اپ GameNet Remote (APK)
// - آیفون و هر گوشی دیگر: نسخه وب از همین کامپیوتر (http://IP:4747) — با اسکن QR
export default function RemoteAccessPanel() {
  const bridge = window.remoteBridge;
  const [info, setInfo] = useState<{ port: number; addresses: string[] } | null>(null);
  const [pair, setPair] = useState<{ code: string; expiresAt: number } | null>(null);
  const [devices, setDevices] = useState<{ id: string; name: string; lastSeen: string | null }[]>([]);
  const [now, setNow] = useState(Date.now());
  const [pairError, setPairError] = useState('');
  const [addr, setAddr] = useState('');
  const [qr, setQr] = useState('');

  const refresh = async () => {
    if (!bridge) return;
    const i = await bridge.getInfo();
    setInfo(i);
    setAddr((a) => (a && i.addresses.includes(a) ? a : i.addresses[0] || ''));
    setDevices(await bridge.listDevices());
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const left = pair ? Math.max(0, Math.round((pair.expiresAt - now) / 1000)) : 0;
  const codeActive = !!pair && left > 0;
  const webUrl = info && addr ? `http://${addr}:${info.port}/${codeActive ? `?code=${pair!.code}` : ''}` : '';

  useEffect(() => {
    if (!webUrl) { setQr(''); return; }
    QRCode.toDataURL(webUrl, { margin: 1, width: 200, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [webUrl]);

  if (!bridge) return null;

  const newCode = async () => {
    setPairError('');
    try {
      setPair(await bridge.newPairCode());
    } catch {
      setPair(null);
      setPairError('ریموت موبایل در اشتراک فعلی شما فعال نیست. برای فعال‌سازی با پشتیبانی تماس بگیرید.');
    }
  };

  return (
    <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-4 shadow-xl text-sm" dir="rtl">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">📱 ریموت موبایل</h3>

      {!info?.addresses.length ? (
        <div className="text-red-400 text-xs">شبکه‌ای پیدا نشد. کامپیوتر باید به مودم/وای‌فای وصل باشد.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <div className="text-xs opacity-70 mb-1">آدرس این کامپیوتر (گوشی باید به همین وای‌فای وصل باشد):</div>
              {info.addresses.length > 1 ? (
                <select
                  value={addr}
                  onChange={(e) => setAddr(e.target.value)}
                  dir="ltr"
                  className="w-full px-2 py-1.5 rounded-lg bg-surface-0b0e14 border border-white/10 font-mono text-blue-300 text-xs"
                >
                  {info.addresses.map((a) => <option key={a} value={a}>{a}:{info.port}</option>)}
                </select>
              ) : (
                <div className="font-mono text-blue-300" dir="ltr">{addr}:{info.port}</div>
              )}
              <div className="text-[10px] text-slate-500 mt-1 leading-5">
                اگر IP عوض شود، اپ اندروید خودش کامپیوتر را پیدا می‌کند؛ آیفون باید QR جدید را اسکن کند.
                بهتر است در مودم برای این کامپیوتر IP ثابت (DHCP Reservation) تعریف کنید.
              </div>
            </div>

            <div className="text-xs leading-6 text-slate-300 space-y-1">
              <div><strong className="text-white">اندروید:</strong> اپ GameNet Remote را باز کنید، آدرس بالا و کد را وارد کنید.</div>
              <div><strong className="text-white">آیفون (یا هر گوشی بدون اپ):</strong> با دوربین گوشی QR را اسکن کنید. در Safari با «Add to Home Screen» مثل یک برنامه نصب می‌شود.</div>
            </div>

            <div>
              <button onClick={newCode} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold">
                ساخت کد جفت‌سازی جدید
              </button>
              {pairError && <div className="mt-2 text-xs text-rose-400">{pairError}</div>}
              {codeActive && (
                <div className="mt-3">
                  <div className="text-3xl font-black tracking-[0.3em] font-mono" dir="ltr">{pair!.code}</div>
                  <div className="text-xs opacity-60 mt-1">اعتبار: {left} ثانیه — یک‌بار مصرف</div>
                </div>
              )}
            </div>
          </div>

          {qr && (
            <div className="flex flex-col items-center gap-2">
              <img
                src={qr}
                alt="QR ریموت"
                width={200}
                height={200}
                className="rounded-xl"
                style={{ background: '#ffffff', padding: 6 }}
              />
              <div className="text-[11px] text-slate-400 text-center">
                {codeActive ? 'کد جفت‌سازی داخل QR است' : 'برای جفت‌سازی سریع‌تر، اول کد بسازید'}
              </div>
              <div className="text-[10px] font-mono text-slate-500" dir="ltr">{webUrl}</div>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="text-xs opacity-70 mb-1">گوشی‌های مجاز:</div>
        {devices.length === 0 && <div className="text-xs opacity-50">هنوز دستگاهی ثبت نشده</div>}
        {devices.map((d) => (
          <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-white/5">
            <span>{d.name}</span>
            <button
              className="text-red-400 text-xs"
              onClick={async () => { await bridge.revokeDevice(d.id); refresh(); }}
            >
              حذف دسترسی
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
