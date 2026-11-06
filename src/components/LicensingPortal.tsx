import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Key,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  User,
  Building,
  Phone,
  Laptop,
  CheckCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Server,
  X
} from 'lucide-react';
import {
  LicenseUser,
  getStoredClient,
  getStoredClientToken,
  loginLicenseClient,
  activateLocalDefaultLicense,
  fetchCurrentSubscription,
  logoutLicenseClient,
  loginAdmin,
  logoutAdmin,
  getStoredAdminToken,
  fetchAdminLicenses,
  createAdminLicense,
  updateAdminLicense,
  deleteAdminLicense
} from '../services/licenseService';

const STORAGE_KEYS = {
  REMEMBERED_USERNAME: 'gamenet_remembered_username_v2',
};

const toPersianDigits = (num: number | string): string => {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toString().replace(/\d/g, (d) => farsiDigits[parseInt(d, 10)]);
};

export interface LicensingContextType {
  currentClient: LicenseUser | null;
  licenseUsers: LicenseUser[];
  isDevConsoleUnlocked: boolean;
  setIsDevConsoleUnlocked: (unlocked: boolean) => void;
  isSyncingWithRealHost: boolean;
  syncStatusText: string;
  performLicenseVerification: (username: string, passwordText: string, background?: boolean) => Promise<boolean>;
  refreshSubscription: () => Promise<boolean>;
  extendMonths: (userId: string, monthsCount: number) => Promise<void>;
  toggleUserStatus: (userId: string) => Promise<void>;
  handleModifyLicenseEndDate: (userId: string, targetDateISO: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  getRemainingDays: (user: LicenseUser) => number;
  getRemainingDaysLabel: (user: LicenseUser) => string;
  getPersianDateLabel: (isoDateStr: string) => string;
  handleLogout: () => void;
  setShowUnlockModal: (show: boolean) => void;
  showHostPanel: boolean;
  setShowHostPanel: (show: boolean) => void;
  isAddingUser: boolean;
  setIsAddingUser: (val: boolean) => void;
  newBusinessName: string;
  setNewBusinessName: (val: string) => void;
  newOwnerName: string;
  setNewOwnerName: (val: string) => void;
  newPhone: string;
  setNewPhone: (val: string) => void;
  newUsername: string;
  setNewUsername: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  newSubType: '6months' | '12months' | 'custom' | 'lifetime';
  setNewSubType: (val: '6months' | '12months' | 'custom' | 'lifetime') => void;
  newCustomDays: string;
  setNewCustomDays: (val: string) => void;
  handleAddLicenseUser: (e: React.FormEvent) => Promise<void>;
  hostError: string;
  setHostError: (err: string) => void;
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
  adminPassword = '123',
  adminUsername = 'admin'
}: LicensingPortalProps) {
  // Client state
  const [currentClient, setCurrentClient] = useState<LicenseUser | null>(() => getStoredClient());
  const [licenseUsers, setLicenseUsers] = useState<LicenseUser[]>([]);

  // UI state
  const [loginUsername, setLoginUsername] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.REMEMBERED_USERNAME) || '';
  });
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  // Synchronization with License Server
  const [isSyncingWithRealHost, setIsSyncingWithRealHost] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('');

  // Admin / Developer Portal state
  const [isDevConsoleUnlocked, setIsDevConsoleUnlocked] = useState<boolean>(() => {
    return !!getStoredAdminToken() && sessionStorage.getItem('gamenet_dev_console_unlocked') === 'true';
  });
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [adminUsernameInput, setAdminUsernameInput] = useState('admin');
  const [enteredUnlockPass, setEnteredUnlockPass] = useState('');
  const [unlockModalError, setUnlockModalError] = useState('');
  const [isSubmittingAdminLogin, setIsSubmittingAdminLogin] = useState(false);
  const [showHostPanel, setShowHostPanel] = useState(false);

  // New License Modal Form state
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newSubType, setNewSubType] = useState<'6months' | '12months' | 'custom' | 'lifetime'>('6months');
  const [newCustomDays, setNewCustomDays] = useState('30');
  const [hostError, setHostError] = useState('');

  // Date & Day Calculation Helpers
  const getRemainingDays = useCallback((user: LicenseUser): number => {
    if (user.subscriptionType === 'lifetime') return Infinity;
    if (!user.endDateISO) return 0;
    const end = new Date(user.endDateISO);
    if (isNaN(end.getTime())) return 0;
    const diffTime = end.getTime() - Date.now();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
    try {
      const d = new Date(isoDateStr);
      if (isNaN(d.getTime())) return isoDateStr;
      return d.toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return '-';
    }
  }, []);

  // Compute status validation for current client
  const isLicenseActive = currentClient && currentClient.status === 'active';
  const isLicenseExpired = currentClient && getRemainingDays(currentClient) <= 0;
  const isLicenseSuspended = currentClient && currentClient.status === 'suspended';
  const showLockScreen = !currentClient || !isLicenseActive || isLicenseExpired || isLicenseSuspended;

  // Refresh client subscription from Local Storage
  const refreshSubscription = useCallback(async (): Promise<boolean> => {
    const token = getStoredClientToken();
    if (!token) return false;

    setIsSyncingWithRealHost(true);
    setSyncStatusText('در حال بررسی وضعیت اشتراک محلی...');
    try {
      const res = await fetchCurrentSubscription();
      setIsSyncingWithRealHost(false);
      if (res.success && res.user) {
        setCurrentClient(res.user);
        return true;
      }
      if (res.status === 'suspended') {
        setCurrentClient((prev) => (prev ? { ...prev, status: 'suspended' } : null));
        return false;
      }
      // If token expired/invalid, clear client
      setCurrentClient(null);
      return false;
    } catch {
      setIsSyncingWithRealHost(false);
      return false;
    }
  }, []);

  // Load Admin licenses if admin token is active
  const reloadAdminLicenses = useCallback(async () => {
    const token = getStoredAdminToken();
    if (!token) return;
    try {
      const list = await fetchAdminLicenses();
      if (Array.isArray(list)) {
        setLicenseUsers(list);
      }
    } catch (err) {
      console.error('Failed to load admin licenses:', err);
    }
  }, []);

  // Initial mount verification
  useEffect(() => {
    if (getStoredClientToken()) {
      refreshSubscription();
    }
    if (getStoredAdminToken() && sessionStorage.getItem('gamenet_dev_console_unlocked') === 'true') {
      reloadAdminLicenses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client Login via License Server
  const performLicenseVerification = async (
    username: string,
    passwordText: string,
    background = false
  ): Promise<boolean> => {
    if (!username.trim() || !passwordText) {
      if (!background) setLoginError('لطفاً نام کاربری و رمز عبور اشتراک را وارد فرمایید.');
      return false;
    }

    if (!background) {
      setIsSubmittingLogin(true);
      setIsSyncingWithRealHost(true);
      setSyncStatusText('در حال بررسی و احراز هویت در سرور مرکزی لایسنس...');
    }

    try {
      const res = await loginLicenseClient(username.trim(), passwordText);
      if (!background) {
        setIsSubmittingLogin(false);
        setIsSyncingWithRealHost(false);
      }

      if (res.success && res.user) {
        setCurrentClient(res.user);
        if (rememberMe) {
          localStorage.setItem(STORAGE_KEYS.REMEMBERED_USERNAME, username.trim());
        } else {
          localStorage.removeItem(STORAGE_KEYS.REMEMBERED_USERNAME);
        }
        setLoginError('');
        setLoginPassword('');
        return true;
      }

      if (res.status === 'suspended') {
        setLoginError('حساب اشتراک این مجموعه توسط مدیر سیستم به حالت تعلیق (مسدود) درآمده است.');
        return false;
      }

      setLoginError(res.message || 'نام کاربری یا رمز عبور اشتباه است.');
      return false;
    } catch (err: any) {
      if (!background) {
        setIsSubmittingLogin(false);
        setIsSyncingWithRealHost(false);
        setLoginError(`خطا در ارتباط با سرور مرکزی لایسنس: ${err?.message || err}`);
      }
      return false;
    }
  };

  const handleClientLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    await performLicenseVerification(loginUsername, loginPassword, false);
  };

  const handleLogout = () => {
    logoutLicenseClient();
    setCurrentClient(null);
    setLoginPassword('');
  };

  const handleDirectLocalAccess = () => {
    const localClient = activateLocalDefaultLicense();
    setCurrentClient(localClient);
    setLoginError('');
    setLoginPassword('');
  };

  // Admin Login Handler (Local)
  const handleUnlockConsole = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockModalError('');
    setIsSubmittingAdminLogin(true);

    try {
      const res = await loginAdmin(adminUsernameInput.trim(), enteredUnlockPass, adminUsername, adminPassword);
      setIsSubmittingAdminLogin(false);

      if (res.success) {
        setIsDevConsoleUnlocked(true);
        sessionStorage.setItem('gamenet_dev_console_unlocked', 'true');
        setShowUnlockModal(false);
        setShowHostPanel(true);
        setEnteredUnlockPass('');
        await reloadAdminLicenses();
        return;
      }

      setUnlockModalError(res.message || 'نام کاربری یا رمز عبور مدیر نادرست است.');
    } catch (err: any) {
      setIsSubmittingAdminLogin(false);
      setUnlockModalError(`خطا در بررسی رمز مدیریت: ${err?.message || err}`);
    }
  };

  const handleLockConsole = () => {
    logoutAdmin();
    setIsDevConsoleUnlocked(false);
    sessionStorage.removeItem('gamenet_dev_console_unlocked');
    setLicenseUsers([]);
    setShowHostPanel(false);
  };

  // Admin Action: Add New Client
  const handleAddLicenseUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setHostError('');

    if (!newUsername.trim() || !newPassword) {
      setHostError('نام کاربری و رمز عبور الزامی است.');
      return;
    }

    try {
      setIsSyncingWithRealHost(true);
      setSyncStatusText('در حال ذخیره لایسنس در دیتابیس مرکزی...');
      const res = await createAdminLicense({
        username: newUsername.trim(),
        password: newPassword,
        businessName: newBusinessName.trim() || 'گیم‌نت ثبت شده',
        ownerName: newOwnerName.trim() || 'مدیر مجموعه',
        phoneNumber: newPhone.trim(),
        subscriptionType: newSubType,
        customDays: newSubType === 'custom' ? parseInt(newCustomDays, 10) || 30 : undefined,
      });
      setIsSyncingWithRealHost(false);

      if (res.success && res.license) {
        setLicenseUsers(prev => [res.license!, ...prev.filter(u => u.id !== res.license!.id)]);
        setNewBusinessName('');
        setNewOwnerName('');
        setNewPhone('');
        setNewUsername('');
        setNewPassword('');
        setIsAddingUser(false);
      } else {
        setHostError(res.message || 'خطا در ثبت لایسنس جدید.');
      }
    } catch (err: any) {
      setIsSyncingWithRealHost(false);
      setHostError(`خطا در اتصال به سرور: ${err?.message || err}`);
    }
  };

  // Admin Action: Modify Expiration Date
  const handleModifyLicenseEndDate = async (userId: string, targetDateISO: string) => {
    if (!targetDateISO) return;
    try {
      const res = await updateAdminLicense(userId, { endDateISO: targetDateISO });
      if (res.success && res.license) {
        setLicenseUsers(prev => prev.map(u => u.id === userId ? res.license! : u));
        if (currentClient && currentClient.id === userId) {
          setCurrentClient(res.license);
        }
      } else {
        setHostError(res.message || 'خطا در تغییر تاریخ انقضاء.');
      }
    } catch (err: any) {
      setHostError(`خطا در ارتباط با سرور: ${err?.message || err}`);
    }
  };

  // Admin Action: Quick Extend by 3 Months
  const extendMonths = async (userId: string, monthsCount: number) => {
    const user = licenseUsers.find(u => u.id === userId);
    if (!user) return;
    const currentEnd = new Date(user.endDateISO);
    const baseTime = (isNaN(currentEnd.getTime()) || currentEnd.getTime() < Date.now()) ? new Date() : currentEnd;
    baseTime.setMonth(baseTime.getMonth() + monthsCount);
    const newEndISO = baseTime.toISOString();

    try {
      const res = await updateAdminLicense(userId, { endDateISO: newEndISO });
      if (res.success && res.license) {
        setLicenseUsers(prev => prev.map(u => u.id === userId ? res.license! : u));
        if (currentClient && currentClient.id === userId) {
          setCurrentClient(res.license);
        }
      } else {
        setHostError(res.message || 'خطا در تمدید اشتراک.');
      }
    } catch (err: any) {
      setHostError(`خطا در ارتباط با سرور: ${err?.message || err}`);
    }
  };

  // Admin Action: Toggle Suspend / Active
  const toggleUserStatus = async (userId: string) => {
    const user = licenseUsers.find(u => u.id === userId);
    if (!user) return;
    const nextStatus = user.status === 'suspended' ? 'active' : 'suspended';

    try {
      const res = await updateAdminLicense(userId, { status: nextStatus });
      if (res.success && res.license) {
        setLicenseUsers(prev => prev.map(u => u.id === userId ? res.license! : u));
        if (currentClient && currentClient.id === userId) {
          setCurrentClient(res.license);
        }
      } else {
        setHostError(res.message || 'خطا در تغییر وضعیت دسترسی.');
      }
    } catch (err: any) {
      setHostError(`خطا در ارتباط با سرور: ${err?.message || err}`);
    }
  };

  // Admin Action: Delete User
  const deleteUser = async (userId: string) => {
    if (!window.confirm('آیا از حذف دائم این لایسنس از دیتابیس سرور مرکزی اطمینان دارید؟')) return;
    try {
      const res = await deleteAdminLicense(userId);
      if (res.success) {
        setLicenseUsers(prev => prev.filter(u => u.id !== userId));
        if (currentClient && currentClient.id === userId) {
          handleLogout();
        }
      } else {
        setHostError(res.message || 'خطا در حذف لایسنس.');
      }
    } catch (err: any) {
      setHostError(`خطا در ارتباط با سرور: ${err?.message || err}`);
    }
  };

  return (
    <LicensingContext.Provider value={{
      currentClient,
      licenseUsers,
      isDevConsoleUnlocked,
      setIsDevConsoleUnlocked,
      isSyncingWithRealHost,
      syncStatusText,
      performLicenseVerification,
      refreshSubscription,
      extendMonths,
      toggleUserStatus,
      handleModifyLicenseEndDate,
      deleteUser,
      getRemainingDays,
      getRemainingDaysLabel,
      getPersianDateLabel,
      handleLogout,
      setShowUnlockModal,
      showHostPanel,
      setShowHostPanel,
      isAddingUser,
      setIsAddingUser,
      newBusinessName,
      setNewBusinessName,
      newOwnerName,
      setNewOwnerName,
      newPhone,
      setNewPhone,
      newUsername,
      setNewUsername,
      newPassword,
      setNewPassword,
      newSubType,
      setNewSubType,
      newCustomDays,
      setNewCustomDays,
      handleAddLicenseUser,
      hostError,
      setHostError,
      handleLockConsole,
    }}>
      <div className={`relative min-h-screen text-slate-100 font-sans ${theme === 'light' ? 'light' : ''}`} dir="rtl">

        {/* 1. LOCK SCREEN (REQUIRED WHEN NOT LOGGED IN OR EXPIRED/SUSPENDED) */}
        {showLockScreen ? (
          <div className="min-h-screen bg-[#07090e] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Subtle background ambient glow */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-md bg-[#0f131a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative z-10 p-6 space-y-6">

              {/* Title & Branding */}
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20 mb-1">
                  <Lock className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-black text-white">درگاه اشتراک و نسخه لوکال گیم‌نت</h2>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-sm mx-auto">
                  برنامه در حالت کاملاً لوکال (آفلاین و بدون نیاز به سرور) فعال است. می‌توانید با حساب اشتراک یا به صورت مستقیم وارد شوید.
                </p>
              </div>

              {/* STATUS ALERT: SUSPENDED OR EXPIRED */}
              {currentClient && (isLicenseExpired || isLicenseSuspended) && (
                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                    <div className="space-y-1 text-xs">
                      <h4 className="font-extrabold text-rose-300">
                        {isLicenseSuspended ? 'دسترسی لایسنس مسدود شده است' : 'اشتراک سالانه شما به اتمام رسیده است'}
                      </h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        {isLicenseSuspended
                          ? 'این اشتراک توسط مدیریت سرور مرکزی مسدود (Suspended) شده است. لطفاً جهت فعال‌سازی مجدد با پشتیبانی تماس بگیرید.'
                          : 'اعتبار زمانی بسته اشتراک این مجموعه به پایان رسیده است. جهت تمدید با کارشناس لایسنس تماس بگیرید.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-950/80 rounded-xl space-y-1.5 text-[10px] text-slate-400 font-mono">
                    <div className="flex justify-between">
                      <span>نام مجموعه:</span>
                      <span className="text-white font-bold">{currentClient.businessName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>شناسه لایسنس:</span>
                      <span className="text-slate-300">{currentClient.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>تاریخ پایان اشتراک:</span>
                      <span className="text-rose-400 font-bold">{getPersianDateLabel(currentClient.endDateISO)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>وضعیت فعلی:</span>
                      <span className="text-rose-500 font-extrabold">{getRemainingDaysLabel(currentClient)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-4 pt-2">
                    <button
                      type="button"
                      onClick={handleDirectLocalAccess}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                    >
                      فعال‌سازی فوری نسخه لوکال (بدون محدودیت)
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      ورود با حساب کاربری دیگر
                    </button>
                  </div>
                </div>
              )}

              {/* CLIENT LOGIN FORM */}
              {(!currentClient || (!isLicenseActive && !isLicenseExpired && !isLicenseSuspended)) && (
                <form onSubmit={handleClientLogin} className="space-y-4">
                  {loginError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block">نام کاربری لایسنس (Username):</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                      <input
                        type="text"
                        dir="ltr"
                        required
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        placeholder="e.g. game_user1"
                        className="w-full px-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs text-left"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block">رمز عبور اشتراک (Password):</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-3.5 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        dir="ltr"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs text-left"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded bg-slate-950 border-white/10 text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                      <span>ذخیره نام کاربری برای مراجعات بعدی</span>
                    </label>
                  </div>

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
                        <span>ورود با نام کاربری لایسنس</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDirectLocalAccess}
                    className="w-full py-2.5 bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-300 font-bold rounded-xl transition-all duration-200 cursor-pointer text-xs flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>ورود مستقیم (حالت لوکال / بدون نیاز به سرور)</span>
                  </button>
                </form>
              )}

              {/* Footer Server & Admin Link */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[9px] text-slate-500">
                <span className="flex items-center gap-1 text-emerald-400/80">
                  <Server className="w-3 h-3" />
                  <span>حالت لوکال (آفلاین - بدون نیاز به سرور)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(true)}
                  className="hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Key className="w-3 h-3 text-amber-500/70" />
                  <span>پیشخوان مدیریت لایسنس</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* WORKSPACE ACTIVE & UNLOCKED */
          <div className="animate-in fade-in duration-300">
            {children}
          </div>
        )}

        {/* 2. ADMIN AUTHENTICATION MODAL */}
        {showUnlockModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4" dir="rtl">
            <div className="w-full max-w-sm bg-[#0f131c] border border-amber-500/20 rounded-2xl p-5 space-y-4 shadow-2xl relative">
              <div className="text-center space-y-1">
                <div className="bg-amber-500/10 text-amber-500 w-10 h-10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                  <Key className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-black text-white">ورود مدیر سرور لایسنس</h3>
                <p className="text-[10px] text-slate-400">
                  جهت مدیریت، تمدید یا ایجاد لایسنس‌های جدید، وارد حساب کاربری ادمین سرور شوید.
                </p>
              </div>

              {unlockModalError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] rounded-xl text-center">
                  {unlockModalError}
                </div>
              )}

              <form onSubmit={handleUnlockConsole} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold block">نام کاربری ادمین (Admin Username):</label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    placeholder="admin"
                    value={adminUsernameInput}
                    onChange={(e) => setAdminUsernameInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs font-mono text-center"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] text-slate-400 font-bold block">رمز عبور ادمین (Bcrypt Protected):</label>
                    <span className="text-[8.5px] text-amber-400 font-mono flex items-center gap-1">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      JWT Verified
                    </span>
                  </div>
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
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={isSubmittingAdminLogin}
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors flex items-center justify-center gap-1"
                  >
                    {isSubmittingAdminLogin ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'تایید و ورود به مدیریت'
                    )}
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
