import React, { useEffect, useMemo, useState } from 'react';
import { X, Upload, RefreshCw, Trash2, CheckCircle2, AlertTriangle, Users, Globe, Download, Smartphone } from 'lucide-react';
import {
  LicenseUser,
  UpdateRelease,
  UpdateTarget,
  fetchUpdateReleases,
  uploadUpdateFile,
  publishUpdate,
  patchUpdateRelease,
  deleteUpdateRelease,
  AndroidApkInfo,
  fetchAndroidApk,
  uploadAndroidApk,
  deleteAndroidApk,
  getLicenseApiBaseUrl,
} from '../services/licenseService';

type MFile = { name: string; size: number };
const fmtSize = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const fmtDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('fa-IR'); } catch { return iso; }
};

// انتخاب گیرنده‌های یک آپدیت: همه یا لایسنس‌های مشخص
function TargetPicker({ licenses, value, onChange }: { licenses: LicenseUser[]; value: UpdateTarget; onChange: (t: UpdateTarget) => void }) {
  const [q, setQ] = useState('');
  const ids = value.type === 'licenses' ? value.ids : [];
  const shown = licenses.filter((l) => `${l.businessName} ${l.username} ${l.ownerName}`.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: string) => onChange({ type: 'licenses', ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange({ type: 'all' })}
          className={`flex-1 py-2 rounded-xl text-xs font-bold border cursor-pointer flex items-center justify-center gap-1.5 ${value.type === 'all' ? 'bg-sky-600 border-sky-500 text-white' : 'bg-white/5 border-white/10 text-slate-300'}`}
        >
          <Globe className="w-3.5 h-3.5" /> همه مشتری‌ها
        </button>
        <button
          type="button"
          onClick={() => onChange({ type: 'licenses', ids })}
          className={`flex-1 py-2 rounded-xl text-xs font-bold border cursor-pointer flex items-center justify-center gap-1.5 ${value.type === 'licenses' ? 'bg-sky-600 border-sky-500 text-white' : 'bg-white/5 border-white/10 text-slate-300'}`}
        >
          <Users className="w-3.5 h-3.5" /> فقط مشتری‌های انتخاب‌شده
        </button>
      </div>
      {value.type === 'licenses' && (
        <div className="border border-white/10 rounded-xl p-2 space-y-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی مشتری…"
            className="w-full px-3 py-1.5 bg-surface-06080d border border-white/10 rounded-lg text-xs text-white"
          />
          <div className="max-h-40 overflow-auto space-y-1">
            {shown.map((l) => (
              <label key={l.id} className="flex items-center gap-2 text-xs text-slate-300 px-1 py-1 rounded hover:bg-white/5 cursor-pointer">
                <input type="checkbox" checked={ids.includes(l.id)} onChange={() => toggle(l.id)} />
                <span className="font-bold text-white">{l.businessName}</span>
                <span className="font-mono text-slate-500" dir="ltr">{l.username}</span>
              </label>
            ))}
            {shown.length === 0 && <div className="text-[11px] text-slate-500 px-1">مشتری‌ای پیدا نشد.</div>}
          </div>
          <div className="text-[10px] text-slate-500">{ids.length} مشتری انتخاب شده</div>
        </div>
      )}
    </div>
  );
}

// اپ اندروید ریموت: یک APK روی سرور با لینک ثابت /remote.apk
function AndroidApkSection({ notify, onError }: { notify: (m: string) => void; onError: (m: string) => void }) {
  const [apk, setApk] = useState<AndroidApkInfo | null | undefined>(undefined);
  const [pct, setPct] = useState<number | null>(null);
  const link = `${getLicenseApiBaseUrl()}/remote.apk`;
  const load = () => fetchAndroidApk().then(setApk).catch(() => setApk(null));
  useEffect(() => { load(); }, []);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.apk$/i.test(file.name)) { onError('یک فایل .apk انتخاب کنید.'); return; }
    setPct(0);
    try {
      await uploadAndroidApk(file, '', setPct);
      notify('اپ اندروید روی سرور قرار گرفت. مشتری‌ها از QR داخل برنامه دانلودش می‌کنند.');
      load();
    } catch (err: any) {
      onError(err?.message || 'خطا در آپلود.');
    } finally {
      setPct(null);
    }
  };

  return (
    <div className="bg-surface-06080d border border-white/10 rounded-2xl p-4 space-y-3">
      <div className="text-xs font-bold text-white flex items-center gap-2"><Smartphone className="w-4 h-4 text-emerald-400" /> اپ اندروید ریموت</div>
      <div className="text-[11px] text-slate-400 leading-6">
        APK را از گیت‌هاب ← Releases ← <b>GameNet Remote (Android)</b> دانلود و اینجا آپلود کنید.
        برنامه ویندوز مشتری‌ها در تنظیمات ← ریموت موبایل یک QR برای دانلود همین فایل نشان می‌دهد.
      </div>
      {apk === undefined ? null : apk ? (
        <div className="text-[11px] text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-emerald-300 font-bold">روی سرور است</span>
          <span>{fmtSize(apk.size)}</span>
          <span>آپلود: {fmtDate(apk.uploadedAt)}</span>
          <span>دانلود: {apk.downloads}</span>
          <a href={link} className="font-mono text-sky-300 underline" dir="ltr">{link}</a>
          <button
            type="button"
            onClick={async () => { if (!window.confirm('اپ اندروید از سرور حذف شود؟')) return; const r = await deleteAndroidApk(); r.success ? (notify(r.message), load()) : onError(r.message); }}
            className="p-1 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg cursor-pointer"
            title="حذف"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="text-[11px] text-amber-300">هنوز اپ اندروید روی سرور قرار نگرفته است.</div>
      )}
      <label className="flex items-center justify-center gap-2 py-2.5 border border-dashed border-white/20 rounded-xl text-xs text-slate-300 cursor-pointer hover:bg-white/5">
        {pct !== null ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {pct !== null ? `در حال آپلود… ${pct}%` : apk ? 'جایگزینی با APK جدید' : 'انتخاب فایل GameNet-Remote.apk'}
        <input type="file" accept=".apk,application/vnd.android.package-archive" className="hidden" onChange={onPick} disabled={pct !== null} />
      </label>
    </div>
  );
}

interface Props {
  licenses: LicenseUser[];
  onClose: () => void;
  notify: (msg: string) => void;
}

export default function UpdatesModal({ licenses, onClose, notify }: Props) {
  const [releases, setReleases] = useState<UpdateRelease[] | null>(null);
  const [error, setError] = useState('');

  // انتشار نسخه جدید
  const [selected, setSelected] = useState<File[]>([]);
  const [manifest, setManifest] = useState<{ raw: string; sig: string; version: string; notes: string; files: Record<string, { name: string; size: number }> } | null>(null);
  const [target, setTarget] = useState<UpdateTarget>({ type: 'all' });
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [publishing, setPublishing] = useState(false);

  // ویرایش گیرنده‌های نسخه‌های قبلی
  const [editing, setEditing] = useState<{ version: string; target: UpdateTarget } | null>(null);

  const nameOf = useMemo(() => Object.fromEntries(licenses.map((l) => [l.id, l.businessName])), [licenses]);

  const load = async () => {
    setError('');
    try { setReleases(await fetchUpdateReleases()); } catch (e: any) { setError(e?.message || 'خطا'); }
  };
  useEffect(() => { load(); }, []);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(''); setManifest(null); setProgress({});
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    setSelected(files);
    const mf = files.find((f) => f.name === 'manifest.json');
    const sf = files.find((f) => f.name === 'manifest.sig');
    if (!mf || !sf) { setError('همه فایل‌های پوشه release/<نسخه> را با هم انتخاب کنید (از جمله manifest.json و manifest.sig).'); return; }
    const raw = await mf.text();
    try {
      const m = JSON.parse(raw);
      if (m.app !== 'gamenet-manager' || !m.version || !m.files) throw new Error();
      setManifest({ raw, sig: (await sf.text()).trim(), version: m.version, notes: m.notes || '', files: m.files });
    } catch {
      setError('فایل manifest.json معتبر نیست.');
    }
  };

  const missing = manifest ? (Object.values(manifest.files) as MFile[]).filter((f) => !selected.some((s) => s.name === f.name)) : [];

  const publish = async () => {
    if (!manifest || missing.length) return;
    if (target.type === 'licenses' && target.ids.length === 0) { setError('حداقل یک مشتری انتخاب کنید.'); return; }
    setPublishing(true); setError('');
    try {
      for (const f of (Object.values(manifest.files) as MFile[])) {
        const file = selected.find((s) => s.name === f.name)!;
        await uploadUpdateFile(manifest.version, file, (p) => setProgress((x) => ({ ...x, [f.name]: p })));
      }
      const r = await publishUpdate(manifest.raw, manifest.sig, target);
      if (!r.success) throw new Error(r.message);
      notify(r.message);
      setManifest(null); setSelected([]); setProgress({}); setTarget({ type: 'all' });
      load();
    } catch (e: any) {
      setError(e?.message || 'خطا در انتشار.');
    } finally {
      setPublishing(false);
    }
  };

  const targetLabel = (t: UpdateTarget) =>
    t.type === 'all' ? 'همه مشتری‌ها' : `${t.ids.length} مشتری: ${t.ids.map((id) => nameOf[id] || id).slice(0, 3).join('، ')}${t.ids.length > 3 ? '…' : ''}`;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-auto bg-surface-0f131c border border-white/10 rounded-2xl p-5 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400" />
            آپدیت برنامه ویندوز و اپ اندروید
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <AndroidApkSection notify={notify} onError={setError} />

        {/* انتشار نسخه جدید */}
        <div className="bg-surface-06080d border border-white/10 rounded-2xl p-4 space-y-3">
          <div className="text-xs font-bold text-white">انتشار نسخه جدید</div>
          <div className="text-[11px] text-slate-400 leading-6">
            ۱. روی کامپیوتر خودتان (نسخه را یکی بالاتر بگذارید):
            <div className="my-1 px-2 py-1 bg-black/30 rounded-lg font-mono text-amber-300 text-left" dir="ltr">npm run release -- 1.2.0 "Fix settle bug"</div>
            ۲. همه فایل‌های پوشه <code className="text-amber-300" dir="ltr">release/1.2.0</code> را با هم اینجا انتخاب کنید.
          </div>
          <label className="flex items-center justify-center gap-2 py-3 border border-dashed border-white/20 rounded-xl text-xs text-slate-300 cursor-pointer hover:bg-white/5">
            <Upload className="w-4 h-4" />
            {selected.length ? `${selected.length} فایل انتخاب شد` : 'انتخاب فایل‌ها (exe + manifest.json + manifest.sig)'}
            <input type="file" multiple accept=".exe,.json,.sig" className="hidden" onChange={onPick} disabled={publishing} />
          </label>

          {manifest && (
            <div className="space-y-3">
              <div className="text-xs text-slate-300">
                نسخه <b className="text-white font-mono">{manifest.version}</b>
                {manifest.notes && <span className="text-slate-400"> — {manifest.notes}</span>}
              </div>
              <div className="space-y-1">
                {(Object.entries(manifest.files) as [string, MFile][]).map(([arch, f]) => {
                  const has = selected.some((s) => s.name === f.name);
                  const p = progress[f.name];
                  return (
                    <div key={arch} className="flex items-center gap-2 text-[11px]">
                      {has ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                      <span className="font-mono text-slate-300" dir="ltr">{f.name}</span>
                      <span className="text-slate-500">{fmtSize(f.size)} ({arch === 'ia32' ? '۳۲ بیتی' : '۶۴ بیتی'})</span>
                      {p !== undefined && <span className="text-sky-300 font-mono">{p}%</span>}
                    </div>
                  );
                })}
              </div>
              {missing.length > 0 && <div className="text-[11px] text-rose-400">این فایل‌ها انتخاب نشده‌اند: {missing.map((f) => f.name).join('، ')}</div>}
              <div className="text-[11px] text-slate-400">این آپدیت برای چه کسانی باشد؟</div>
              <TargetPicker licenses={licenses} value={target} onChange={setTarget} />
              <button
                type="button"
                onClick={publish}
                disabled={publishing || missing.length > 0}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-2"
              >
                {publishing && <RefreshCw className="w-4 h-4 animate-spin" />}
                {publishing ? 'در حال آپلود…' : 'آپلود و انتشار'}
              </button>
            </div>
          )}
        </div>

        {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl">{error}</div>}

        {/* نسخه‌های منتشرشده */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-white">نسخه‌های منتشرشده</div>
          {releases === null && !error && <div className="py-4 text-center"><RefreshCw className="w-5 h-5 animate-spin inline text-sky-400" /></div>}
          {releases && releases.length === 0 && <div className="text-[11px] text-slate-500">هنوز نسخه‌ای منتشر نشده است.</div>}
          {releases?.map((r) => (
            <div key={r.version} className="border border-white/10 rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <b className="text-white font-mono">{r.version}</b>
                <span className="text-slate-500">{fmtDate(r.createdAt)}</span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${r.active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-slate-400'}`}>
                  {r.active ? 'فعال' : 'متوقف'}
                </span>
                <span className="text-slate-400 text-[11px]">گیرنده: {targetLabel(r.target)}</span>
                <span className="text-slate-500 text-[11px]">دانلود: {r.downloads}</span>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={async () => { const x = await patchUpdateRelease(r.version, { active: !r.active }); x.success ? (notify(x.message), load()) : setError(x.message); }}
                  className="px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[10px] cursor-pointer"
                >
                  {r.active ? 'توقف' : 'فعال‌سازی'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(editing?.version === r.version ? null : { version: r.version, target: r.target })}
                  className="px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[10px] cursor-pointer"
                >
                  تغییر گیرنده‌ها
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`نسخه ${r.version} و فایل‌هایش حذف شود؟`)) return;
                    const x = await deleteUpdateRelease(r.version);
                    x.success ? (notify(x.message), load()) : setError(x.message);
                  }}
                  className="p-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg cursor-pointer"
                  title="حذف"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {r.notes && <div className="text-[11px] text-slate-400">{r.notes}</div>}
              {editing?.version === r.version && (
                <div className="space-y-2 pt-1">
                  <TargetPicker licenses={licenses} value={editing.target} onChange={(t) => setEditing({ version: r.version, target: t })} />
                  <button
                    type="button"
                    onClick={async () => {
                      const x = await patchUpdateRelease(r.version, { target: editing.target });
                      if (x.success) { notify(x.message); setEditing(null); load(); } else setError(x.message);
                    }}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    ذخیره گیرنده‌ها
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="text-[10px] text-slate-500 leading-5">
          برنامه‌ها هر ۶ ساعت آپدیت را بررسی می‌کنند (یا از تنظیمات ← «بررسی آپدیت»). امضای هر آپدیت روی کامپیوتر مشتری چک می‌شود؛
          فقط آپدیت‌هایی که با کلید شما امضا شده‌اند نصب می‌شوند. نسخه پورتابل آپدیت خودکار ندارد.
        </div>
      </div>
    </div>
  );
}
