import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

export interface UpdateState {
  status: 'disabled' | 'idle' | 'checking' | 'downloading' | 'ready' | 'error';
  reason?: 'no_key' | 'portable' | 'dev';
  currentVersion: string;
  version?: string;
  notes?: string;
  progress?: number;
  message?: string;
  lastCheck?: number;
}

declare global {
  interface Window {
    updateBridge?: {
      status: () => Promise<UpdateState>;
      check: () => Promise<UpdateState>;
      install: () => Promise<boolean>;
      onChange: (cb: (s: UpdateState) => void) => () => void;
    };
  }
}

export function useUpdateState(): [UpdateState | null, () => Promise<void>] {
  const [state, setState] = useState<UpdateState | null>(null);
  useEffect(() => {
    const b = window.updateBridge;
    if (!b) return;
    b.status().then(setState).catch(() => {});
    return b.onChange(setState);
  }, []);
  const check = async () => {
    if (window.updateBridge) setState(await window.updateBridge.check());
  };
  return [state, check];
}

// نوار بالای برنامه وقتی نسخه جدید دانلود شده و آماده نصب است
export default function UpdateBanner() {
  const [state] = useUpdateState();
  const [hidden, setHidden] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (!state || state.status !== 'ready' || hidden) return null;

  return (
    <div className="bg-emerald-600 text-white text-xs px-4 py-2 flex flex-wrap items-center justify-center gap-3" dir="rtl">
      <Download className="w-4 h-4 shrink-0" />
      <span className="font-bold">نسخه جدید {state.version} آماده نصب است.</span>
      {state.notes && <span className="opacity-90 truncate max-w-md">{state.notes}</span>}
      <button
        type="button"
        disabled={installing}
        onClick={async () => { setInstalling(true); await window.updateBridge?.install(); }}
        className="px-3 py-1 rounded-lg bg-white text-emerald-700 font-black cursor-pointer disabled:opacity-70 flex items-center gap-1"
      >
        {installing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
        نصب و باز شدن دوباره (چند ثانیه)
      </button>
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="px-2 py-1 rounded-lg bg-emerald-700/60 hover:bg-emerald-700 cursor-pointer flex items-center gap-1"
        title="موقع بستن برنامه خودکار نصب می‌شود"
      >
        <X className="w-3.5 h-3.5" />
        بعداً (موقع بستن برنامه)
      </button>
    </div>
  );
}

// ردیف نسخه برنامه و دکمه بررسی آپدیت (در تنظیمات)
export function UpdateStatusRow() {
  const [state, check] = useUpdateState();
  const [busy, setBusy] = useState(false);
  if (!state) return null;

  let text = '';
  switch (state.status) {
    case 'disabled':
      text = state.reason === 'portable'
        ? 'نسخه پورتابل آپدیت خودکار ندارد؛ برای آپدیت خودکار نسخه نصبی (Setup) را نصب کنید.'
        : 'آپدیت خودکار در این نسخه فعال نیست.';
      break;
    case 'checking': text = 'در حال بررسی…'; break;
    case 'downloading': text = `در حال دانلود نسخه ${state.version}: ${state.progress ?? 0}٪`; break;
    case 'ready': text = `نسخه ${state.version} دانلود شده و آماده نصب است (بالای صفحه).`; break;
    case 'error': text = state.message || 'خطا در بررسی آپدیت.'; break;
    default: text = 'برنامه به‌روز است.';
  }

  return (
    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5 text-[11px] text-slate-400">
      <span>نسخه برنامه: <strong className="text-slate-200 font-mono">{state.currentVersion}</strong></span>
      <span className={state.status === 'error' ? 'text-rose-400' : state.status === 'ready' ? 'text-emerald-400' : ''}>{text}</span>
      {state.status !== 'disabled' && (
        <button
          type="button"
          disabled={busy || state.status === 'downloading' || state.status === 'checking'}
          onClick={async () => { setBusy(true); try { await check(); } finally { setBusy(false); } }}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded-lg cursor-pointer flex items-center gap-1 disabled:opacity-60"
        >
          <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
          بررسی آپدیت
        </button>
      )}
    </div>
  );
}
