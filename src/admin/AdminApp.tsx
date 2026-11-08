import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, Key, Lock, Server, CheckCircle2, AlertTriangle, RefreshCw,
  Search, Plus, Trash2, Calendar, Phone, Building, User, Clock,
  LogOut, X, Edit3, Check, ChevronDown, Activity, Globe, Power, Laptop, Download, Upload
} from 'lucide-react';
import {
  LicenseUser,
  getLicenseApiBaseUrl,
  setCustomLicenseServerUrl,
  loginAdmin,
  fetchAdminLicenses,
  createAdminLicense,
  updateAdminLicense,
  deleteAdminLicense,
  getStoredAdminToken,
  setStoredAdminToken,
  DEFAULT_LICENSE_API_URL,
  LicenseDevice,
  fetchLicenseDevices,
  revokeLicenseDevice,
  downloadLicenseBackup,
  restoreLicenseBackup,
  getAdmin2fa,
  startAdmin2faSetup,
  enableAdmin2fa,
  disableAdmin2fa
} from '../services/licenseService';
import QRCode from 'qrcode';

function toPersianDigits(n: number | string): string {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (w) => farsiDigits[+w]);
}

function formatDatePersian(isoDateStr: string): string {
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
}

export default function AdminApp() {
  const [adminToken, setAdminToken] = useState<string | null>(() => getStoredAdminToken());
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [needCode, setNeedCode] = useState(false);
  const [loginCode, setLoginCode] = useState('');

  // Security (2FA) modal
  const [showSecurity, setShowSecurity] = useState(false);
  const [twoFaEnabled, setTwoFaEnabled] = useState<boolean | null>(null);
  const [twoFaSetup, setTwoFaSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaPassword, setTwoFaPassword] = useState('');
  const [twoFaError, setTwoFaError] = useState('');
  const [twoFaBusy, setTwoFaBusy] = useState(false);

  // Server URL & Connection Status
  const [serverUrl, setServerUrl] = useState<string>(() => getLicenseApiBaseUrl());
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverPingStatus, setServerPingStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [serverInfo, setServerInfo] = useState<any>(null);

  // License Data
  const [licenses, setLicenses] = useState<LicenseUser[]>([]);
  const [isLoadingLicenses, setIsLoadingLicenses] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'expired'>('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLicense, setEditingLicense] = useState<LicenseUser | null>(null);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendingLicense, setExtendingLicense] = useState<LicenseUser | null>(null);
  const [extendDaysToAdd, setExtendDaysToAdd] = useState(180);
  const [deleteConfirmLicense, setDeleteConfirmLicense] = useState<LicenseUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create Form State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newSubType, setNewSubType] = useState<'6months' | '12months' | 'custom' | 'lifetime'>('6months');
  const [newCustomDays, setNewCustomDays] = useState(30);
  const [newInitialStatus, setNewInitialStatus] = useState<'active' | 'suspended'>('active');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [newMaxDevices, setNewMaxDevices] = useState(1);
  const [newRemote, setNewRemote] = useState(true);

  // Edit Form State
  const [editBusinessName, setEditBusinessName] = useState('');
  const [editOwnerName, setEditOwnerName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editEndDateISO, setEditEndDateISO] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editMaxDevices, setEditMaxDevices] = useState(1);
  const [editRemote, setEditRemote] = useState(true);

  // Devices modal
  const [devicesLicense, setDevicesLicense] = useState<LicenseUser | null>(null);
  const [devices, setDevices] = useState<LicenseDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const restoreInputRef = React.useRef<HTMLInputElement>(null);

  // Check Server Health
  const checkHealth = useCallback(async () => {
    setServerPingStatus('checking');
    try {
      const res = await fetch(`${serverUrl}/api/health`, { method: 'GET', headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        setServerPingStatus('online');
        setServerInfo(data);
      } else {
        setServerPingStatus('offline');
      }
    } catch {
      setServerPingStatus('offline');
    }
  }, [serverUrl]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Load Licenses
  const loadLicenses = useCallback(async () => {
    if (!adminToken) return;
    setIsLoadingLicenses(true);
    setErrorMessage('');
    try {
      const list = await fetchAdminLicenses();
      setLicenses(list);
    } catch (err: any) {
      setErrorMessage(err?.message || 'خطا در ارتباط با سرور لایسنس.');
      if (err?.message?.includes('401') || err?.message?.includes('منقضی')) {
        setAdminToken(null);
        setStoredAdminToken(null);
      }
    } finally {
      setIsLoadingLicenses(false);
    }
  }, [adminToken]);

  useEffect(() => {
    if (adminToken) {
      loadLicenses();
    }
  }, [adminToken, loadLicenses]);

  // Flash message helper
  const notifySuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  // Remaining days calculation
  const getRemainingDays = (lic: LicenseUser): number => {
    if (lic.subscriptionType === 'lifetime') return Infinity;
    if (!lic.endDateISO) return 0;
    const end = new Date(lic.endDateISO);
    if (isNaN(end.getTime())) return 0;
    const diff = end.getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Filtered Licenses
  const filteredLicenses = useMemo(() => {
    return licenses.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.businessName.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q) ||
        (item.ownerName && item.ownerName.toLowerCase().includes(q)) ||
        (item.phoneNumber && item.phoneNumber.includes(q));

      if (!matchSearch) return false;

      const remDays = getRemainingDays(item);
      const isExpired = remDays <= 0 && item.subscriptionType !== 'lifetime';

      if (statusFilter === 'active') {
        return item.status === 'active' && !isExpired;
      }
      if (statusFilter === 'suspended') {
        return item.status === 'suspended';
      }
      if (statusFilter === 'expired') {
        return isExpired || item.status === 'expired';
      }
      return true;
    });
  }, [licenses, searchQuery, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    let active = 0;
    let suspended = 0;
    let expired = 0;
    licenses.forEach((item) => {
      const rem = getRemainingDays(item);
      if (item.status === 'suspended') {
        suspended++;
      } else if (rem <= 0 && item.subscriptionType !== 'lifetime') {
        expired++;
      } else {
        active++;
      }
    });
    return { total: licenses.length, active, suspended, expired };
  }, [licenses]);

  // Handle Admin Login
  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await loginAdmin(adminUsername, adminPassword, needCode ? loginCode : undefined);
      if (res.success && res.token) {
        setAdminToken(res.token);
        setStoredAdminToken(res.token);
        setAdminPassword('');
        setLoginCode('');
        setNeedCode(false);
      } else if (res.needCode && !needCode) {
        // ورود دومرحله‌ای فعال است: فیلد کد را نشان بده
        setNeedCode(true);
      } else {
        setLoginCode('');
        setLoginError(res.message || 'اطلاعات ورود مدیر صحیح نیست.');
      }
    } catch (err: any) {
      setLoginError(err?.message || 'خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Admin Logout
  const handleLogout = () => {
    setAdminToken(null);
    setStoredAdminToken(null);
    setLicenses([]);
  };

  // Handle Create License
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword || !newBusinessName) {
      setErrorMessage('نام کاربری، رمز عبور و نام گیم‌نت الزامی است.');
      return;
    }
    setIsSubmittingCreate(true);
    setErrorMessage('');
    try {
      const res = await createAdminLicense({
        username: newUsername.trim(),
        password: newPassword,
        businessName: newBusinessName.trim(),
        ownerName: newOwnerName.trim(),
        phoneNumber: newPhone.trim(),
        subscriptionType: newSubType,
        customDays: newSubType === 'custom' ? Number(newCustomDays) || 30 : undefined,
        status: newInitialStatus,
        maxDevices: newMaxDevices,
        features: { remote: newRemote },
      });
      if (res.success) {
        setShowCreateModal(false);
        setNewUsername('');
        setNewPassword('');
        setNewBusinessName('');
        setNewOwnerName('');
        setNewPhone('');
        notifySuccess('لایسنس جدید با موفقیت در دیتابیس ثبت گردید.');
        loadLicenses();
      } else {
        setErrorMessage(res.message || 'خطا در ثبت لایسنس جدید.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'خطا در ثبت لایسنس.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Handle Open Edit Modal
  const openEditModal = (lic: LicenseUser) => {
    setEditingLicense(lic);
    setEditBusinessName(lic.businessName);
    setEditOwnerName(lic.ownerName || '');
    setEditPhone(lic.phoneNumber || '');
    setEditNewPassword('');
    setEditEndDateISO(lic.endDateISO ? lic.endDateISO.split('T')[0] : '');
    setEditStatus(lic.status === 'suspended' ? 'suspended' : 'active');
    setEditMaxDevices(lic.maxDevices || 1);
    setEditRemote(lic.features?.remote !== false);
    setShowEditModal(true);
  };

  // Handle Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLicense) return;
    setIsSubmittingEdit(true);
    try {
      const updates: any = {
        businessName: editBusinessName.trim(),
        ownerName: editOwnerName.trim(),
        phoneNumber: editPhone.trim(),
        status: editStatus,
        maxDevices: editMaxDevices,
        features: { remote: editRemote },
      };
      if (editNewPassword.trim().length > 0) {
        updates.password = editNewPassword.trim();
      }
      if (editEndDateISO) {
        updates.endDateISO = new Date(editEndDateISO).toISOString();
      }

      const res = await updateAdminLicense(editingLicense.id, updates);
      if (res.success) {
        setShowEditModal(false);
        notifySuccess('تغییرات لایسنس با موفقیت ذخیره شد.');
        loadLicenses();
      } else {
        setErrorMessage(res.message || 'خطا در ذخیره تغییرات.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'خطا در ذخیره تغییرات.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Quick Toggle Status
  const handleToggleStatus = async (lic: LicenseUser) => {
    const newStatus = lic.status === 'suspended' ? 'active' : 'suspended';
    try {
      const res = await updateAdminLicense(lic.id, { status: newStatus });
      if (res.success) {
        notifySuccess(`وضعیت لایسنس به ${newStatus === 'active' ? 'فعال' : 'مسدود'} تغییر یافت.`);
        loadLicenses();
      } else {
        setErrorMessage(res.message || 'خطا در تغییر وضعیت.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'خطا در ارتباط.');
    }
  };

  // Handle Quick Extend
  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingLicense) return;
    try {
      const currentEnd = extendingLicense.endDateISO ? new Date(extendingLicense.endDateISO).getTime() : Date.now();
      const baseTime = Math.max(currentEnd, Date.now());
      const newEndTime = baseTime + extendDaysToAdd * 24 * 3600 * 1000;
      const newEndISO = new Date(newEndTime).toISOString();

      const res = await updateAdminLicense(extendingLicense.id, {
        endDateISO: newEndISO,
        status: 'active'
      });
      if (res.success) {
        setShowExtendModal(false);
        notifySuccess(`اشتراک لایسنس به مدت ${toPersianDigits(extendDaysToAdd)} روز با موفقیت تمدید شد.`);
        loadLicenses();
      } else {
        setErrorMessage(res.message || 'خطا در تمدید اشتراک.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'خطا در تمدید اشتراک.');
    }
  };

  // Handle Delete License
  const handleConfirmDelete = async () => {
    if (!deleteConfirmLicense) return;
    setIsDeleting(true);
    try {
      const res = await deleteAdminLicense(deleteConfirmLicense.id);
      if (res.success) {
        setDeleteConfirmLicense(null);
        notifySuccess('لایسنس مورد نظر با موفقیت حذف گردید.');
        loadLicenses();
      } else {
        setErrorMessage(res.message || 'خطا در حذف لایسنس.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'خطا در حذف لایسنس.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Devices of a license
  const openDevicesModal = async (lic: LicenseUser) => {
    setDevicesLicense(lic);
    setDevices([]);
    setIsLoadingDevices(true);
    try {
      setDevices(await fetchLicenseDevices(lic.id));
    } catch (err: any) {
      setErrorMessage(err?.message || 'خطا در دریافت دستگاه‌ها.');
    } finally {
      setIsLoadingDevices(false);
    }
  };

  const handleRevokeDevice = async (dev: LicenseDevice) => {
    if (!devicesLicense) return;
    if (!window.confirm(`دسترسی «${dev.name}» لغو شود؟ این کامپیوتر حداکثر تا چند ساعت دیگر قفل می‌شود و جای آن برای دستگاه جدید آزاد می‌شود.`)) return;
    const res = await revokeLicenseDevice(dev.id);
    if (res.success) {
      setDevices((prev) => prev.filter((d) => d.id !== dev.id));
      notifySuccess('دسترسی دستگاه لغو شد.');
      loadLicenses();
    } else {
      setErrorMessage(res.message || 'خطا در لغو دسترسی.');
    }
  };

  // Backup / restore
  const handleDownloadBackup = async () => {
    try {
      await downloadLicenseBackup();
      notifySuccess('فایل بکاپ دانلود شد. آن را جای امن نگه دارید.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'خطا در دریافت بکاپ.');
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('همه لایسنس‌ها و دستگاه‌های فعلی این سرور با محتوای فایل بکاپ جایگزین می‌شوند. ادامه می‌دهید؟')) return;
    const res = await restoreLicenseBackup(file);
    if (res.success) {
      notifySuccess(res.message);
      loadLicenses();
    } else {
      setErrorMessage(res.message || 'خطا در بازیابی بکاپ.');
    }
  };

  // Security (2FA)
  const openSecurity = async () => {
    setShowSecurity(true);
    setTwoFaSetup(null); setTwoFaCode(''); setTwoFaPassword(''); setTwoFaError('');
    setTwoFaEnabled(null);
    try { setTwoFaEnabled((await getAdmin2fa()).enabled); } catch { setTwoFaError('خطا در ارتباط با سرور.'); }
  };

  const beginTwoFa = async () => {
    setTwoFaBusy(true); setTwoFaError('');
    try {
      const r = await startAdmin2faSetup();
      if (!r.success || !r.uri || !r.secret) { setTwoFaError(r.message || 'خطا'); return; }
      const qr = await QRCode.toDataURL(r.uri, { margin: 4, width: 260, errorCorrectionLevel: 'L', color: { dark: '#000000', light: '#ffffff' } });
      setTwoFaSetup({ secret: r.secret, qr });
    } finally { setTwoFaBusy(false); }
  };

  const confirmTwoFa = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFaBusy(true); setTwoFaError('');
    try {
      const r = await enableAdmin2fa(twoFaCode);
      if (r.success) { setTwoFaEnabled(true); setTwoFaSetup(null); setTwoFaCode(''); notifySuccess(r.message); }
      else setTwoFaError(r.message);
    } finally { setTwoFaBusy(false); }
  };

  const turnOffTwoFa = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFaBusy(true); setTwoFaError('');
    try {
      const r = await disableAdmin2fa(twoFaPassword, twoFaCode);
      if (r.success) { setTwoFaEnabled(false); setTwoFaCode(''); setTwoFaPassword(''); notifySuccess(r.message); }
      else setTwoFaError(r.message);
    } finally { setTwoFaBusy(false); }
  };

  // -------------------------------------------------------------
  // VIEW: Admin Login Screen
  // -------------------------------------------------------------
  if (!adminToken) {
    return (
      <div className="min-h-screen bg-surface-07090e text-slate-100 flex flex-col justify-center items-center p-4" dir="rtl">
        <div className="w-full max-w-md bg-surface-0e121a border border-amber-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-indigo-500 to-amber-500" />

          {/* Logo & Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Shield className="w-7 h-7" />
            </div>
            <h1 className="text-lg font-black text-white tracking-wide">سامانه مدیریت مرکزی لایسنس‌ها</h1>
            <p className="text-xs text-slate-400">پنل اختصاصی مدیر سیستم گیم‌نت</p>
          </div>

          {/* Server Connection Status Pill */}
          <div className="bg-surface-141923 border border-white/5 rounded-2xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${serverPingStatus === 'online' ? 'bg-emerald-400 animate-pulse' : serverPingStatus === 'checking' ? 'bg-amber-400 animate-spin' : 'bg-rose-500'}`} />
              <span className="text-[11px] text-slate-300 font-mono font-bold truncate max-w-[200px]" dir="ltr">
                {serverUrl}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowServerConfig(!showServerConfig)}
              className="text-[10px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
            >
              تنظیم آدرس
            </button>
          </div>

          {showServerConfig && (
            <div className="bg-surface-121622 border border-amber-500/30 rounded-2xl p-3.5 space-y-2 text-xs">
              <label className="text-[10px] text-slate-300 font-bold block">آدرس سرور لایسنس (Base URL):</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  dir="ltr"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 px-3 py-1.5 bg-surface-080a0f border border-white/10 rounded-xl text-xs font-mono text-white text-left focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCustomLicenseServerUrl(serverUrl);
                    checkHealth();
                    setShowServerConfig(false);
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  ذخیره
                </button>
              </div>
              <p className="text-[9px] text-slate-400 leading-relaxed">
                آدرس پیش‌فرض: <code className="text-amber-300">{DEFAULT_LICENSE_API_URL}</code>
              </p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-bold block">نام کاربری مدیر:</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-surface-080a0f border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs text-left"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-bold block">رمز عبور مدیر سیستم:</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="password"
                  dir="ltr"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-surface-080a0f border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs text-left"
                />
              </div>
            </div>

            {needCode && (
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-bold block">کد ۶ رقمی برنامه Authenticator:</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  dir="ltr"
                  required
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full px-3.5 py-2.5 bg-surface-080a0f border border-amber-500/40 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 text-lg tracking-[0.5em] text-center font-mono"
                />
              </div>
            )}

            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-60 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-950/40"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال احراز هویت در سرور...</span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  <span>ورود امن به پیشخوان مدیریت</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center text-[10px] text-slate-500">
            ورود امن با رمز و در صورت فعال بودن، کد دومرحله‌ای
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: Admin Main Dashboard
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-surface-07090e text-slate-100 flex flex-col font-sans" dir="rtl">
      {/* Top Navbar */}
      <header className="bg-surface-0c0f16/95 backdrop-blur-md border-b border-white/5 sticky top-0 z-40 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white flex items-center gap-2">
              پیشخوان مدیریت لایسنس گیم‌نت
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono">
                Admin v2.0
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">مدیریت اشتراک‌ها، دستگاه‌ها و بکاپ سرور لایسنس</p>
          </div>
        </div>

        {/* Server status & Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-surface-121622 px-3 py-1.5 rounded-xl border border-white/5 text-xs">
            <span className={`w-2 h-2 rounded-full ${serverPingStatus === 'online' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span className="text-[11px] text-slate-300 font-mono">{serverInfo?.database || 'PostgreSQL'}</span>
          </div>

          <button
            type="button"
            onClick={openSecurity}
            className="px-3 py-1.5 bg-surface-121622 hover:bg-surface-1a2030 text-sky-300 rounded-xl border border-white/10 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            title="امنیت ورود (ورود دومرحله‌ای)"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden md:inline">امنیت</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadBackup}
            className="px-3 py-1.5 bg-surface-121622 hover:bg-surface-1a2030 text-emerald-300 rounded-xl border border-white/10 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            title="دانلود بکاپ کامل برای انتقال به سرور جدید"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">بکاپ</span>
          </button>

          <button
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            className="px-3 py-1.5 bg-surface-121622 hover:bg-surface-1a2030 text-amber-300 rounded-xl border border-white/10 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            title="بازیابی از فایل بکاپ (جایگزینی کامل)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden md:inline">بازیابی</span>
          </button>
          <input ref={restoreInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleRestoreFile} />

          <button
            type="button"
            onClick={loadLicenses}
            disabled={isLoadingLicenses}
            className="p-2 bg-surface-121622 hover:bg-surface-1a2030 text-slate-300 rounded-xl border border-white/10 transition-colors cursor-pointer"
            title="بروزرسانی داده‌ها"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingLicenses ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl border border-rose-500/20 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Flash Notifications */}
        {successMessage && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-2xl flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage('')} className="text-emerald-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-2xl flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-0e121a border border-white/5 rounded-2xl p-4 space-y-1">
            <span className="text-[11px] text-slate-400 font-bold block">کل لایسنس‌های صادر شده</span>
            <span className="text-2xl font-black text-white font-mono">{toPersianDigits(stats.total)}</span>
          </div>

          <div className="bg-surface-0e121a border border-emerald-500/20 rounded-2xl p-4 space-y-1">
            <span className="text-[11px] text-emerald-400 font-bold block">اشتراک‌های فعال و معتبر</span>
            <span className="text-2xl font-black text-emerald-400 font-mono">{toPersianDigits(stats.active)}</span>
          </div>

          <div className="bg-surface-0e121a border border-rose-500/20 rounded-2xl p-4 space-y-1">
            <span className="text-[11px] text-rose-400 font-bold block">اشتراک‌های منقضی شده</span>
            <span className="text-2xl font-black text-rose-400 font-mono">{toPersianDigits(stats.expired)}</span>
          </div>

          <div className="bg-surface-0e121a border border-amber-500/20 rounded-2xl p-4 space-y-1">
            <span className="text-[11px] text-amber-400 font-bold block">مسدود / معلق (Suspended)</span>
            <span className="text-2xl font-black text-amber-400 font-mono">{toPersianDigits(stats.suspended)}</span>
          </div>
        </div>

        {/* Action & Filter Toolbar */}
        <div className="bg-surface-0e121a border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="جستجو بر اساس نام گیم‌نت، خریدار، یوزرنیم، موبایل..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-surface-06080d p-1 rounded-xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${statusFilter === 'all' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                همه
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${statusFilter === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
              >
                فعال
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('expired')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${statusFilter === 'expired' ? 'bg-rose-500/20 text-rose-400' : 'text-slate-400 hover:text-white'}`}
              >
                منقضی
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('suspended')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${statusFilter === 'suspended' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white'}`}
              >
                مسدود
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-950/30 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>صدور لایسنس جدید</span>
          </button>
        </div>

        {/* Licenses Table Card */}
        <div className="bg-surface-0e121a border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-3.5 bg-surface-121622 border-b border-white/5 flex items-center justify-between text-xs font-bold text-slate-300">
            <span>لیست لایسنس‌ها ({toPersianDigits(filteredLicenses.length)} مورد)</span>
            {isLoadingLicenses && <span className="text-[11px] text-amber-400 animate-pulse">در حال دریافت از سرور...</span>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-surface-07090e text-slate-400 text-[10px] border-b border-white/5 uppercase">
                <tr>
                  <th className="p-3.5">نام گیم‌نت / خریدار</th>
                  <th className="p-3.5">نام کاربری (Login)</th>
                  <th className="p-3.5">نوع اشتراک</th>
                  <th className="p-3.5">تاریخ شروع</th>
                  <th className="p-3.5">تاریخ انقضا</th>
                  <th className="p-3.5 text-center">مهلت باقیمانده</th>
                  <th className="p-3.5 text-center">دستگاه‌ها</th>
                  <th className="p-3.5 text-center">وضعیت دسترسی</th>
                  <th className="p-3.5 text-center">عملیات مدیریت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLicenses.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      هیچ لایسنسی با مشخصات وارد شده یافت نشد.
                    </td>
                  </tr>
                ) : (
                  filteredLicenses.map((lic) => {
                    const remDays = getRemainingDays(lic);
                    const isExpired = remDays <= 0 && lic.subscriptionType !== 'lifetime';
                    const isSuspended = lic.status === 'suspended';

                    return (
                      <tr key={lic.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-white text-xs">{lic.businessName}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <span>{lic.ownerName || 'بدون مالک ثبت شده'}</span>
                            {lic.phoneNumber && (
                              <>
                                <span>•</span>
                                <span className="font-mono" dir="ltr">{lic.phoneNumber}</span>
                              </>
                            )}
                          </div>
                        </td>

                        <td className="p-3.5 font-mono text-amber-300 text-xs">
                          {lic.username}
                        </td>

                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-bold">
                            {lic.subscriptionType === '6months' && '۶ ماهه'}
                            {lic.subscriptionType === '12months' && 'یک ساله (۱۲ ماه)'}
                            {lic.subscriptionType === 'lifetime' && 'همیشگی (مادام‌العمر)'}
                            {lic.subscriptionType === 'custom' && 'سفارشی'}
                          </span>
                        </td>

                        <td className="p-3.5 font-mono text-slate-400 text-[11px]">
                          {formatDatePersian(lic.startDateISO)}
                        </td>

                        <td className="p-3.5 font-mono text-slate-300 text-[11px]">
                          {lic.subscriptionType === 'lifetime' ? 'بدون انقضا' : formatDatePersian(lic.endDateISO)}
                        </td>

                        <td className="p-3.5 text-center font-mono">
                          {lic.subscriptionType === 'lifetime' ? (
                            <span className="text-emerald-400 text-[10px] font-bold">همیشگی</span>
                          ) : isExpired ? (
                            <span className="text-rose-400 text-[10px] font-bold">منقضی شده</span>
                          ) : (
                            <span className="text-slate-200 text-xs font-bold">
                              {toPersianDigits(remDays)} روز
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => openDevicesModal(lic)}
                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            title="مشاهده و لغو دستگاه‌ها"
                          >
                            <Laptop className="w-3 h-3" />
                            <span className="font-mono">{toPersianDigits(lic.deviceCount ?? 0)}/{toPersianDigits(lic.maxDevices ?? 1)}</span>
                            {lic.features?.remote !== false && <span title="ریموت موبایل فعال">📱</span>}
                          </button>
                        </td>

                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(lic)}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-black cursor-pointer transition-all border ${
                              isSuspended
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500 hover:text-white'
                                : isExpired
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500 hover:text-white'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500 hover:text-white'
                            }`}
                            title="کلیک جهت تعلیق یا فعالسازی"
                          >
                            {isSuspended ? 'مسدود 🔒' : isExpired ? 'منقضی ⚠️' : 'فعال ✓'}
                          </button>
                        </td>

                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {lic.subscriptionType !== 'lifetime' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setExtendingLicense(lic);
                                  setShowExtendModal(true);
                                }}
                                className="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                title="تمدید اعتبار اشتراک"
                              >
                                تمدید
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openEditModal(lic)}
                              className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="ویرایش مشخصات"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteConfirmLicense(lic)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="حذف دائم لایسنس"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: Create New License */}
      {/* ------------------------------------------------------------- */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-lg bg-surface-0e121a border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                صدور و ثبت لایسنس مشتری جدید
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-300 font-bold block">نام گیم‌نت / مجموعه:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: گیم‌نت الماس"
                    value={newBusinessName}
                    onChange={(e) => setNewBusinessName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white focus:ring-1 focus:ring-amber-500 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-300 font-bold block">نام مدیر / خریدار:</label>
                  <input
                    type="text"
                    placeholder="مثال: آقای سهرابی"
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white focus:ring-1 focus:ring-amber-500 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-300 font-bold block">شماره تماس:</label>
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="09121234567"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white focus:ring-1 focus:ring-amber-500 text-xs font-mono text-left"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-300 font-bold block">نام کاربری اختصاصی (Login):</label>
                  <input
                    type="text"
                    dir="ltr"
                    required
                    placeholder="diamond_gamenet"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-amber-300 focus:ring-1 focus:ring-amber-500 text-xs font-mono text-left"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-300 font-bold block">رمز عبور ورود مشتری:</label>
                  <input
                    type="text"
                    dir="ltr"
                    required
                    placeholder="pass1234"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white focus:ring-1 focus:ring-amber-500 text-xs font-mono text-left"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-300 font-bold block">نوع اشتراک:</label>
                  <select
                    value={newSubType}
                    onChange={(e) => setNewSubType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white focus:ring-1 focus:ring-amber-500 text-xs"
                  >
                    <option value="6months">اشتراک ۶ ماهه (۱۸۰ روز)</option>
                    <option value="12months">اشتراک یک ساله (۳۶۵ روز)</option>
                    <option value="lifetime">مادام‌العمر (بدون انقضا)</option>
                    <option value="custom">سفارشی (تعداد روز)</option>
                  </select>
                </div>

                {newSubType === 'custom' && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-300 font-bold block">تعداد روزهای اشتراک:</label>
                    <input
                      type="number"
                      min="1"
                      value={newCustomDays}
                      onChange={(e) => setNewCustomDays(Number(e.target.value) || 30)}
                      className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white focus:ring-1 focus:ring-amber-500 text-xs font-mono"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-300 font-bold block">وضعیت اولیه:</label>
                  <select
                    value={newInitialStatus}
                    onChange={(e) => setNewInitialStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white focus:ring-1 focus:ring-amber-500 text-xs"
                  >
                    <option value="active">فعال (Active)</option>
                    <option value="suspended">مسدود اولیه (Suspended)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-300 font-bold block">حداکثر تعداد کامپیوتر:</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={newMaxDevices}
                    onChange={(e) => setNewMaxDevices(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                    className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white focus:ring-1 focus:ring-amber-500 text-xs font-mono"
                  />
                </div>

                <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
                  <input type="checkbox" checked={newRemote} onChange={(e) => setNewRemote(e.target.checked)} />
                  <span>امکان ریموت موبایل فعال باشد</span>
                </label>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  {isSubmittingCreate ? 'در حال ثبت در دیتابیس...' : 'ثبت و صدور نهایی'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: Edit License */}
      {/* ------------------------------------------------------------- */}
      {showEditModal && editingLicense && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-md bg-surface-0e121a border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                ویرایش مشخصات لایسنس ({editingLicense.username})
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold block">نام گیم‌نت / مجموعه:</label>
                <input
                  type="text"
                  required
                  value={editBusinessName}
                  onChange={(e) => setEditBusinessName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold block">نام مالک مجموعه:</label>
                <input
                  type="text"
                  value={editOwnerName}
                  onChange={(e) => setEditOwnerName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold block">شماره همراه:</label>
                <input
                  type="text"
                  dir="ltr"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white text-xs font-mono text-left"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold block">تغییر رمز عبور (در صورت نیاز):</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="در صورت عدم تغییر، خالی بگذارید"
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white text-xs font-mono text-left"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold block">تاریخ انقضا (میلادی YYYY-MM-DD):</label>
                <input
                  type="date"
                  dir="ltr"
                  value={editEndDateISO}
                  onChange={(e) => setEditEndDateISO(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white text-xs font-mono text-left"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold block">وضعیت لایسنس:</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white text-xs"
                >
                  <option value="active">فعال (Active)</option>
                  <option value="suspended">مسدود شده (Suspended)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold block">حداکثر تعداد کامپیوتر:</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={editMaxDevices}
                  onChange={(e) => setEditMaxDevices(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white focus:ring-1 focus:ring-amber-500 text-xs font-mono"
                />
              </div>

              <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
                <input type="checkbox" checked={editRemote} onChange={(e) => setEditRemote(e.target.checked)} />
                <span>امکان ریموت موبایل فعال باشد</span>
              </label>

              <div className="flex gap-2 justify-end pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl cursor-pointer"
                >
                  {isSubmittingEdit ? 'در حال ثبت...' : 'ذخیره تغییرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: Extend License */}
      {/* ------------------------------------------------------------- */}
      {showExtendModal && extendingLicense && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-sm bg-surface-0e121a border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                تمدید سریع اشتراک
              </h3>
              <button onClick={() => setShowExtendModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-1">
              <div className="text-slate-300">
                مجموعه: <span className="font-bold text-white">{extendingLicense.businessName}</span>
              </div>
              <div className="text-slate-400 text-[11px]">
                انقضای فعلی: <span className="font-mono text-amber-300">{formatDatePersian(extendingLicense.endDateISO)}</span>
              </div>
            </div>

            <form onSubmit={handleExtendSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold block">انتخاب بازه تمدید:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExtendDaysToAdd(30)}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition-all cursor-pointer ${extendDaysToAdd === 30 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-surface-06080d text-slate-400 border-white/10'}`}
                  >
                    ۱ ماهه (+۳۰ روز)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtendDaysToAdd(90)}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition-all cursor-pointer ${extendDaysToAdd === 90 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-surface-06080d text-slate-400 border-white/10'}`}
                  >
                    ۳ ماهه (+۹۰ روز)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtendDaysToAdd(180)}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition-all cursor-pointer ${extendDaysToAdd === 180 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-surface-06080d text-slate-400 border-white/10'}`}
                  >
                    ۶ ماهه (+۱۸۰ روز)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtendDaysToAdd(365)}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition-all cursor-pointer ${extendDaysToAdd === 365 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-surface-06080d text-slate-400 border-white/10'}`}
                  >
                    ۱ ساله (+۳۶۵ روز)
                  </button>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowExtendModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  اعمال تمدید
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: Delete Confirmation Modal (In-App Dialog - NO window.confirm) */}
      {/* ------------------------------------------------------------- */}
      {deleteConfirmLicense && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-sm bg-surface-0e121a border border-rose-500/30 rounded-3xl p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-sm font-black text-white">تایید حذف لایسنس مشتری</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                آیا از حذف دائم لایسنس مربوط به گیم‌نت{' '}
                <span className="text-rose-400 font-bold">{deleteConfirmLicense.businessName}</span> با نام کاربری{' '}
                <span className="text-amber-300 font-mono font-bold">{deleteConfirmLicense.username}</span> اطمینان دارید؟
              </p>
              <p className="text-[10px] text-slate-500">
                این عملیات بلافاصله دسترسی مشتری را مسدود کرده و قابل بازگشت نیست.
              </p>
            </div>

            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmLicense(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer shadow-lg shadow-rose-950/40 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>در حال حذف...</span>
                  </>
                ) : (
                  <span>بله، حذف کن</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {showSecurity && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-md bg-surface-0f131c border border-white/10 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-sky-400" />
                ورود دومرحله‌ای
              </h3>
              <button type="button" onClick={() => setShowSecurity(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              با فعال بودن این گزینه، برای ورود به پنل علاوه بر رمز، کد ۶ رقمی برنامه Google Authenticator
              (یا Microsoft Authenticator) روی گوشی شما لازم است. حتی اگر کسی رمز را بداند، بدون گوشی وارد نمی‌شود.
            </p>

            {twoFaEnabled === null && !twoFaError && (
              <div className="py-4 text-center"><RefreshCw className="w-5 h-5 animate-spin inline text-sky-400" /></div>
            )}

            {twoFaEnabled === false && !twoFaSetup && (
              <button
                type="button"
                onClick={beginTwoFa}
                disabled={twoFaBusy}
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                فعال‌سازی ورود دومرحله‌ای
              </button>
            )}

            {twoFaSetup && (
              <form onSubmit={confirmTwoFa} className="space-y-3">
                <div className="text-[11px] text-slate-300 leading-6">
                  ۱. برنامه <b>Google Authenticator</b> را روی گوشی نصب کنید.<br />
                  ۲. در برنامه دکمه <b>+</b> ← <b>Scan a QR code</b> و این QR را اسکن کنید.<br />
                  ۳. کد ۶ رقمی که برنامه نشان می‌دهد را پایین وارد کنید.
                </div>
                <div className="flex justify-center">
                  <img src={twoFaSetup.qr} alt="QR" width={260} height={260} className="rounded-lg" style={{ background: '#ffffff' }} />
                </div>
                <div className="p-3 bg-surface-06080d border border-white/10 rounded-xl text-[11px] text-slate-400 leading-6">
                  اگر اسکن نشد: در برنامه <b>+</b> ← <b>Enter a setup key</b> ← نام: <b dir="ltr">GameNet</b> ←
                  این کلید را وارد کنید (نوع: <b>Time based</b>):
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 font-mono text-slate-200 break-all select-all text-xs" dir="ltr">{twoFaSetup.secret.replace(/(.{4})/g, '$1 ').trim()}</div>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard?.writeText(twoFaSetup.secret).then(() => notifySuccess('کلید کپی شد.')).catch(() => {}); }}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[10px] cursor-pointer shrink-0"
                    >
                      کپی
                    </button>
                  </div>
                </div>
                <input
                  type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} dir="ltr" required
                  value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full px-3 py-2.5 bg-surface-06080d border border-white/10 rounded-xl text-white text-lg tracking-[0.5em] text-center font-mono"
                />
                <button type="submit" disabled={twoFaBusy || twoFaCode.length !== 6} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl text-xs cursor-pointer">
                  تأیید و فعال‌سازی
                </button>
              </form>
            )}

            {twoFaEnabled === true && (
              <form onSubmit={turnOffTwoFa} className="space-y-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> ورود دومرحله‌ای فعال است.
                </div>
                <div className="text-[11px] text-slate-400">برای غیرفعال کردن، رمز مدیر و کد فعلی برنامه را وارد کنید:</div>
                <input
                  type="password" required dir="ltr" value={twoFaPassword} onChange={(e) => setTwoFaPassword(e.target.value)}
                  placeholder="رمز مدیر"
                  className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white text-xs"
                />
                <input
                  type="text" inputMode="numeric" maxLength={6} dir="ltr" required
                  value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="کد ۶ رقمی"
                  className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white text-xs text-center font-mono tracking-widest"
                />
                <button type="submit" disabled={twoFaBusy} className="w-full py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 font-bold rounded-xl text-xs cursor-pointer">
                  غیرفعال کردن
                </button>
              </form>
            )}

            {twoFaError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl">{twoFaError}</div>
            )}
          </div>
        </div>
      )}

      {devicesLicense && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-lg bg-surface-0f131c border border-white/10 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Laptop className="w-4 h-4 text-amber-400" />
                دستگاه‌های «{devicesLicense.businessName}»
              </h3>
              <button type="button" onClick={() => setDevicesLicense(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              اگر مشتری ویندوز را عوض کرده یا کامپیوتر جدید خریده، دستگاه قبلی را لغو کنید تا بتواند روی سیستم جدید فعال کند.
            </p>
            {isLoadingDevices ? (
              <div className="py-6 text-center"><RefreshCw className="w-5 h-5 animate-spin inline text-amber-400" /></div>
            ) : devices.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">هنوز روی هیچ دستگاهی فعال نشده است.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {devices.map((d) => (
                  <div key={d.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-white">{d.name || 'کامپیوتر'}</div>
                      <div className="text-[10px] text-slate-400">
                        فعال‌سازی: {formatDatePersian(d.activatedAt)} • آخرین اتصال: {d.lastSeen ? formatDatePersian(d.lastSeen) : '-'}
                        {d.lastIp && <span className="font-mono" dir="ltr"> • {d.lastIp}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokeDevice(d)}
                      className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg text-[10px] font-bold cursor-pointer"
                    >
                      لغو دسترسی
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
