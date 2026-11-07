import React, { useState, useEffect, useCallback } from 'react';
import {
  Key,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  User,
  CheckCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Server,
  WifiOff,
} from 'lucide-react';
import {
  LicenseUser,
  LicenseStatus,
  getLicenseStatus,
  activateLicense,
  refreshLicense,
  logoutLicense,
  onLicenseChange,
  statusToUser,
  verifyConsoleAdmin,
  hasDesktopLicense,
} from '../services/licenseService';
import defaultLogo from '../assets/images/gamenet-logo.png';

const REMEMBERED_USERNAME = 'gamenet_remembered_username_v2';
const CONSOLE_FLAG = 'gamenet_dev_console_unlocked';

const toPersianDigits = (num: number | string): string => {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toString().replace(/\d/g, (d) => farsiDigits[parseInt(d, 10)]);
};

const readLS = (k: string) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };

export interface LicensingContextType {
  currentClient: LicenseUser | null;
  licenseStatus: LicenseStatus;
  isDevConsoleUnlocked: boolean;
  isSyncingWithRealHost: boolean;
  syncStatusText: string;
  refreshSubscription: () => Promise<boolean>;
  getRemainingDays: (user: LicenseUser) => number;
  getRemainingDaysLabel: (user: LicenseUser) => string;
  getPersianDateLabel: (isoDateStr: string) => string;
  handleLogout: () => void;
  setShowUnlockModal: (show: boolean) => void;
  handleLockConsole: () => void;
}

export const LicensingContext = React.createContext<LicensingContextType | null>(null);

export function useLicensing(): LicensingContextType {
  const context = React.useContext(LicensingContext);
  if (!context) {
    throw new Error('useLicensing must be used within a LicensingPortal');
  }
  return context;
}

interface LicensingPortalProps {
  children: React.ReactNode;
  theme?: string;
  adminPassword?: string;
  adminUsername?: string;
}

export default function LicensingPortal({
  children,
  theme = 'dark',
  adminPassword = '',
  adminUsername = 'admin'
}: LicensingPortalProps) {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>({ state: 'loading' });
  const currentClient = statusToUser(licenseStatus);

  // Login form
  const [loginUsername, setLoginUsername] = useState<string>(() => readLS(REMEMBERED_USERNAME));
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  const [isSyncingWithRealHost, setIsSyncingWithRealHost] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('');

  // قفل پیشخوان داخلی (تنظیمات پیامک و ...) — فقط با رمز مدیر خود برنامه
  const [isDevConsoleUnlocked, setIsDevConsoleUnlocked] = useState<boolean>(() => {
    try { return sessionStorage.getItem(CONSOLE_FLAG) === 'true'; } catch { return false; }
  });
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [adminUsernameInput, setAdminUsernameInput] = useState('admin');
  const [enteredUnlockPass, setEnteredUnlockPass] = useState('');
  const [unlockModalError, setUnlockModalError] = useState('');

  const getRemainingDays = useCallback((user: LicenseUser): number => {
    if (user.subscriptionType === 'lifetime') return Infinity;
    const end = new Date(user.endDateISO).getTime();
    if (isNaN(end)) return 0;
    return Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
  }, []);

  const getRemainingDaysLabel = useCallback((user: LicenseUser): string => {
    if (user.status === 'suspended') return 'مسدود شده';
    const rem = getRemainingDays(user);
    if (rem === Infinity) return 'همیشگی (مادام‌العمر)';
    if (rem <= 0) return 'منقضی شده';
    return `${toPersianDigits(rem)} روز باقیمانده`;
  }, [getRemainingDays]);

  const getPersianDateLabel = useCallback((isoDateStr: string): string => {
    if (!isoDateStr) return '-';
    const d = new Date(isoDateStr);
    if (isNaN(d.getTime())) return isoDateStr;
    return d.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }, []);

  // وضعیت اولیه + گوش دادن به تغییرات از سمت الکترون
  useEffect(() => {
    let alive = true;
    getLicenseStatus().then((s) => { if (alive) setLicenseStatus(s); });
    // در نسخه وب، هر بار با سرور چک شود
    if (!hasDesktopLicense()) refreshLicense().then((r) => { if (alive) setLicenseStatus(r.status); });
    const off = onLicenseChange((s) => setLicenseStatus(s));
    return () => { alive = false; off(); };
  }, []);

  const refreshSubscription = useCallback(async (): Promise<boolean> => {
    setIsSyncingWithRealHost(true);
    setSyncStatusText('در حال بررسی اشتراک با سرور لایسنس...');
    try {
      const r = await refreshLicense();
      setLicenseStatus(r.status);
      setSyncStatusText(r.ok ? 'اشتراک با سرور همگام شد.' : r.message || 'سرور در دسترس نیست؛ اعتبار آفلاین فعلی حفظ شد.');
      return r.ok;
    } finally {
      setIsSyncingWithRealHost(false);
    }
  }, []);

  const handleClientLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginUsername.trim() || !loginPassword) {
      setLoginError('لطفاً نام کاربری و رمز عبور اشتراک را وارد کنید.');
      return;
    }
    setIsSubmittingLogin(true);
    try {
      const r = await activateLicense(loginUsername.trim(), loginPassword);
      if (!r.ok) {
        setLoginError(r.message || 'فعال‌سازی ناموفق بود.');
        return;
      }
      try {
        if (rememberMe) localStorage.setItem(REMEMBERED_USERNAME, loginUsername.trim());
        else localStorage.removeItem(REMEMBERED_USERNAME);
      } catch { /* ignore */ }
      setLoginPassword('');
      setLicenseStatus(await getLicenseStatus());
    } catch (err: any) {
      setLoginError(`خطا در ارتباط با سرور لایسنس: ${err?.message || err}`);
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handleLogout = async () => {
    await logoutLicense();
    setLoginPassword('');
    setLicenseStatus(await getLicenseStatus());
  };

  const handleUnlockConsole = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyConsoleAdmin(adminUsernameInput, enteredUnlockPass, adminUsername, adminPassword)) {
      setIsDevConsoleUnlocked(true);
      try { sessionStorage.setItem(CONSOLE_FLAG, 'true'); } catch { /* ignore */ }
      setShowUnlockModal(false);
      setEnteredUnlockPass('');
      setUnlockModalError('');
      return;
    }
    setUnlockModalError('نام کاربری یا رمز عبور مدیر برنامه نادرست است.');
  };

  const handleLockConsole = () => {
    setIsDevConsoleUnlocked(false);
    try { sessionStorage.removeItem(CONSOLE_FLAG); } catch { /* ignore */ }
  };

  const st = licenseStatus.state;
  const showLockScreen = st !== 'active';
  // حالت‌هایی که با یک بار اتصال به اینترنت حل می‌شوند (لازم نیست دوباره وارد شود)
  const needsSync = ['offline_expired', 'clock', 'expired', 'suspended', 'device_revoked'].includes(st);
  const showLoginForm = ['none', 'invalid', 'device_mismatch', 'device_revoked'].includes(st);

  return (
    <LicensingContext.Provider value={{
      currentClient,
      licenseStatus,
      isDevConsoleUnlocked,
      isSyncingWithRealHost,
      syncStatusText,
      refreshSubscription,
      getRemainingDays,
      getRemainingDaysLabel,
      getPersianDateLabel,
      handleLogout,
      setShowUnlockModal,
      handleLockConsole,
    }}>
      <div className={`relative min-h-screen text-slate-100 font-sans ${theme === 'light' ? 'light' : ''}`} dir="rtl">
        {st === 'loading' ? (
          <div className="min-h-screen bg-surface-07090e flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : showLockScreen ? (
          <div className="min-h-screen bg-surface-07090e flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-md bg-surface-0f131a border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative z-10 p-6 space-y-6">
              <div className="text-center space-y-2">
                <img src={defaultLogo} alt="GameNet" className="w-16 h-16 rounded-2xl mx-auto mb-1 shadow-lg shadow-black/30" />
                <h2 className="text-lg font-black text-white">فعال‌سازی اشتراک گیم‌نت</h2>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-sm mx-auto">
                  برای اولین بار، با نام کاربری و رمزی که از پشتیبانی گرفته‌اید وارد شوید. بعد از آن برنامه بدون اینترنت هم کار می‌کند و هر چند روز یک بار خودکار تمدید می‌شود.
                </p>
              </div>

              {licenseStatus.message && (
                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-3">
                  <div className="flex items-start gap-2.5">
                    {st === 'offline_expired'
                      ? <WifiOff className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      : <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
                    <p className="text-xs text-slate-200 leading-relaxed">{licenseStatus.message}</p>
                  </div>

                  {currentClient && (
                    <div className="p-2.5 bg-slate-950/80 rounded-xl space-y-1.5 text-[10px] text-slate-400">
                      <div className="flex justify-between">
                        <span>نام مجموعه:</span>
                        <span className="text-white font-bold">{currentClient.businessName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>تاریخ پایان اشتراک:</span>
                        <span className="text-slate-200 font-bold">
                          {currentClient.subscriptionType === 'lifetime' ? 'مادام‌العمر' : getPersianDateLabel(currentClient.endDateISO)}
                        </span>
                      </div>
                    </div>
                  )}

                  {needsSync && (
                    <div className="flex items-center justify-center gap-4 pt-1">
                      <button
                        type="button"
                        onClick={refreshSubscription}
                        disabled={isSyncingWithRealHost}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-60"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingWithRealHost ? 'animate-spin' : ''}`} />
                        بررسی دوباره با سرور
                      </button>
                      {!showLoginForm && (
                        <button type="button" onClick={handleLogout} className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer">
                          ورود با حساب دیگر
                        </button>
                      )}
                    </div>
                  )}
                  {syncStatusText && !isSyncingWithRealHost && (
                    <p className="text-[10px] text-amber-300 text-center">{syncStatusText}</p>
                  )}
                </div>
              )}

              {showLoginForm && (
                <form onSubmit={handleClientLogin} className="space-y-4">
                  {loginError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block">نام کاربری اشتراک:</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        type="text"
                        dir="ltr"
                        required
                        autoComplete="username"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs text-left"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block">رمز عبور اشتراک:</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 z-10"
                        aria-label={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        dir="ltr"
                        required
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs text-left"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-400">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded bg-slate-950 border-white/10 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <span>ذخیره نام کاربری</span>
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmittingLogin}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-70 text-white font-extrabold rounded-xl transition-all duration-200 cursor-pointer text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40"
                  >
                    {isSubmittingLogin ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>در حال بررسی...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>فعال‌سازی روی این کامپیوتر</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[9px] text-slate-500">
                <span className="flex items-center gap-1 text-emerald-400/80">
                  <Server className="w-3 h-3" />
                  <span>لایسنس امضاشده و قفل‌شده روی این دستگاه</span>
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>{hasDesktopLicense() ? 'نسخه دسکتاپ' : 'نسخه وب'}</span>
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            {children}
          </div>
        )}

        {showUnlockModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4" dir="rtl">
            <div className="w-full max-w-sm bg-surface-0f131c border border-amber-500/20 rounded-2xl p-5 space-y-4 shadow-2xl relative">
              <div className="text-center space-y-1">
                <div className="bg-amber-500/10 text-amber-500 w-10 h-10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                  <Key className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-black text-white">ورود به پیشخوان مدیریت</h3>
                <p className="text-[10px] text-slate-400">با نام کاربری و رمز مدیر همین برنامه وارد شوید.</p>
              </div>

              {unlockModalError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] rounded-xl text-center">
                  {unlockModalError}
                </div>
              )}

              <form onSubmit={handleUnlockConsole} className="space-y-3">
                <input
                  type="text"
                  required
                  dir="ltr"
                  placeholder="admin"
                  value={adminUsernameInput}
                  onChange={(e) => setAdminUsernameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs font-mono text-center"
                />
                <input
                  type="password"
                  required
                  autoFocus
                  dir="ltr"
                  placeholder="••••••••"
                  value={enteredUnlockPass}
                  onChange={(e) => setEnteredUnlockPass(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs font-mono text-center tracking-widest"
                />
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
                  >
                    ورود
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnlockModal(false);
                      setEnteredUnlockPass('');
                      setUnlockModalError('');
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </LicensingContext.Provider>
  );
}
