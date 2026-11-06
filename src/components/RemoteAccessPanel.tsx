import { useEffect, useState } from 'react';
import '../remote/useRemoteBridge';

// بخش جفت‌سازی گوشی داخل تنظیمات (دسترسی ادمین توسط SettingsTab کنترل می‌شود، فقط داخل Electron)
export default function RemoteAccessPanel() {
  const bridge = window.remoteBridge;
  const [info, setInfo] = useState<{ port: number; addresses: string[] } | null>(null);
  const [pair, setPair] = useState<{ code: string; expiresAt: number } | null>(null);
  const [devices, setDevices] = useState<{ id: string; name: string; lastSeen: string | null }[]>([]);
  const [now, setNow] = useState(Date.now());

  const refresh = async () => {
    if (!bridge) return;
    setInfo(await bridge.getInfo());
    setDevices(await bridge.listDevices());
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!bridge) return null;
  const left = pair ? Math.max(0, Math.round((pair.expiresAt - now) / 1000)) : 0;

  return (
    <div className="p-5 bg-[#151921] border border-white/5 rounded-2xl space-y-4 shadow-xl text-sm" dir="rtl">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">📱 ریموت موبایل</h3>
      <div>
        <div className="text-xs opacity-70 mb-1">آدرس سرور (گوشی باید به همین وای‌فای وصل باشد):</div>
        {info?.addresses.length ? info.addresses.map((a) => (
          <div key={a} className="font-mono text-blue-300" dir="ltr">{a}:{info.port}</div>
        )) : <div className="text-red-400">شبکه‌ای پیدا نشد</div>}
      </div>
      <div>
        <button
          onClick={async () => setPair(await bridge.newPairCode())}
          className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold"
        >
          ساخت کد جفت‌سازی جدید
        </button>
        {pair && left > 0 && (
          <div className="mt-3 text-center">
            <div className="text-3xl font-black tracking-[0.3em] font-mono" dir="ltr">{pair.code}</div>
            <div className="text-xs opacity-60 mt-1">اعتبار: {left} ثانیه — یک‌بار مصرف</div>
          </div>
        )}
      </div>
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
