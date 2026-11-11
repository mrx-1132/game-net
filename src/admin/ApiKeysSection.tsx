import React, { useEffect, useState } from 'react';
import { KeyRound, Trash2, Copy } from 'lucide-react';
import { ApiKeyInfo, fetchApiKeys, createApiKey, revokeApiKey } from '../services/licenseService';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fa-IR') : '—');

// کلیدهای API برای اتصال سایت فروش اشتراک به سرور لایسنس
export default function ApiKeysSection({ notify }: { notify: (m: string) => void }) {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [name, setName] = useState('سایت');
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = () => fetchApiKeys().then(setKeys).catch(() => setError('خطا در دریافت کلیدها.'));
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const r = await createApiKey(name.trim());
    if (r.success && r.key) { setCreated(r.key); load(); } else setError(r.message);
  };

  return (
    <div className="space-y-3 pt-4 border-t border-white/10">
      <h4 className="text-xs font-black text-white flex items-center gap-2"><KeyRound className="w-4 h-4 text-amber-400" /> کلیدهای API (اتصال سایت)</h4>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        سایت فروش با این کلید بعد از خرید اشتراک، حساب نرم‌افزار را می‌سازد و تمدید می‌کند. کلید فقط روی سرور سایت نگه داشته شود.
        هر کلید فقط یک بار نمایش داده می‌شود.
      </p>

      {created && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
          <div className="text-[11px] text-emerald-300 font-bold">کلید ساخته شد. همین الان کپی کنید؛ دوباره نمایش داده نمی‌شود:</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-[11px] text-white break-all select-all" dir="ltr">{created}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(created).then(() => notify('کلید کپی شد.')).catch(() => {})}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg cursor-pointer"
              title="کپی"
            >
              <Copy className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          <button type="button" onClick={() => setCreated(null)} className="text-[10px] text-slate-400 underline cursor-pointer">کپی کردم، بستن</button>
        </div>
      )}

      <form onSubmit={create} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="نام کلید (مثلاً سایت)"
          className="flex-1 px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white text-xs"
        />
        <button type="submit" className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs cursor-pointer">ساخت کلید</button>
      </form>

      {error && <div className="text-[11px] text-rose-400">{error}</div>}

      <div className="space-y-1">
        {keys.filter((k) => !k.revoked).map((k) => (
          <div key={k.id} className="flex items-center gap-2 text-[11px] text-slate-300 border border-white/5 rounded-lg px-2 py-1.5">
            <b className="text-white">{k.name}</b>
            <span className="font-mono text-slate-500" dir="ltr">{k.prefix}…</span>
            <span className="text-slate-500">ساخت: {fmt(k.createdAt)}</span>
            <span className="text-slate-500">آخرین استفاده: {fmt(k.lastUsedAt)}</span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(`کلید «${k.name}» باطل شود؟ سایتی که از آن استفاده می‌کند دیگر نمی‌تواند حساب بسازد.`)) return;
                const r = await revokeApiKey(k.id);
                r.success ? (notify(r.message), load()) : setError(r.message);
              }}
              className="p-1 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg cursor-pointer"
              title="باطل کردن"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {keys.filter((k) => !k.revoked).length === 0 && <div className="text-[11px] text-slate-500">کلید فعالی وجود ندارد.</div>}
      </div>
    </div>
  );
}
