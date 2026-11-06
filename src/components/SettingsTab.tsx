import React, { useState } from 'react';
import { 
  Settings, Save, Plus, Trash2, Monitor, Gamepad, Coins, 
  HelpCircle, ShieldAlert, CheckCircle2, RefreshCw, CreditCard, Lock,
  Key, Users, Calendar, Clock, AlertTriangle, Laptop, Eye, EyeOff, User, Check, Sparkles, Building, Phone, Settings2, Calculator, UserPlus, AlertCircle, Image, Upload, ShieldCheck,
  Send, Bot
} from 'lucide-react';
import { RatesTable, System, SystemType, CardReader, UserPermissions, Operator, ExtraServicePreset, TelegramConfig } from '../types';
import { formatCurrency, toPersianDigits, sha256Hash } from '../utils';
import { useLicensing } from './LicensingPortal';
import defaultLogo from '../assets/images/gamenet-logo.png';
import { getSmsApiKey, setSmsApiKey, getSmsCredit, sendDirectSms, DEFAULT_SMS_API_KEY, getSmsLineNumber, setSmsLineNumber, getSmsLines } from '../services/smsService';
import { sendTelegramMessage } from '../services/telegramService';
import LogoUploadModal from './LogoUploadModal';
import RemoteAccessPanel from './RemoteAccessPanel';

interface SettingsTabProps {
  showRemote?: boolean;
  rates: RatesTable;
  systems: System[];
  onSaveRates: (nextRates: RatesTable) => void;
  onAddSystem: (name: string, type: SystemType) => void;
  onRemoveSystem: (systemId: string) => void;
  onResetAllData?: () => void;
  alarmIntervalSeconds: number;
  onSaveAlarmInterval: (seconds: number) => void;
  cardReaders: CardReader[];
  onAddCardReader: (name: string) => void;
  onRemoveCardReader: (id: string) => void;
  adminPassword: string;
  onSaveAdminPassword: (password: string) => void;
  adminUsername: string;
  onSaveAdminUsername: (username: string) => void;
  userPermissions?: UserPermissions;
  onUpdateUserPermissions?: (permissions: UserPermissions) => void;
  operators?: Operator[];
  onSaveOperators?: (operators: Operator[]) => void;
  presetTimerMinutes?: number[];
  onSavePresetTimerMinutes?: (minutes: number[]) => void;
  adminAutoLogoutMinutes: number;
  onSaveAdminAutoLogoutMinutes: (minutes: number) => void;
  cashDivisors?: number[];
  onSaveCashDivisors?: (divisors: number[]) => void;
  appName?: string;
  onSaveAppName?: (name: string) => void;
  appLogo?: string;
  onSaveAppLogo?: (logoDataUrl: string | undefined) => void;
  userRole?: 'admin' | 'user';
  extraServicePresets?: ExtraServicePreset[];
  onSaveExtraServicePresets?: (presets: ExtraServicePreset[]) => void;
  requireOperatorLogin?: boolean;
  onSaveRequireOperatorLogin?: (required: boolean) => void;
  telegramConfig?: TelegramConfig;
  onSaveTelegramConfig?: (config: TelegramConfig) => void;
}

export default function SettingsTab({
  showRemote,
  rates,
  systems,
  onSaveRates,
  onAddSystem,
  onRemoveSystem,
  onResetAllData,
  alarmIntervalSeconds,
  onSaveAlarmInterval,
  cardReaders = [],
  onAddCardReader,
  onRemoveCardReader,
  adminPassword,
  onSaveAdminPassword,
  adminUsername,
  onSaveAdminUsername,
  userPermissions = { buffet: false, debt: false, reports: false, backups: false, settings: false },
  onUpdateUserPermissions,
  operators = [],
  onSaveOperators,
  presetTimerMinutes = [30, 45, 60],
  onSavePresetTimerMinutes,
  adminAutoLogoutMinutes,
  onSaveAdminAutoLogoutMinutes,
  cashDivisors = [2, 3, 4],
  onSaveCashDivisors,
  appName = 'سامانه هوشمند مدیریت گیم‌نت',
  onSaveAppName,
  appLogo,
  onSaveAppLogo,
  userRole = 'user',
  extraServicePresets = [],
  onSaveExtraServicePresets,
  requireOperatorLogin = false,
  onSaveRequireOperatorLogin,
  telegramConfig = { botToken: '', chatId: '', enabled: false, apiEndpoint: 'https://api.telegram.org' },
  onSaveTelegramConfig,
}: SettingsTabProps) {
  const lic = useLicensing();
  // App Name local state
  const [localAppName, setLocalAppName] = useState<string>(appName);
  const [appNameSuccess, setAppNameSuccess] = useState<boolean>(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState<boolean>(false);

  // Telegram Config local state
  const [localTelegramConfig, setLocalTelegramConfig] = useState<TelegramConfig>(() => ({
    botToken: telegramConfig?.botToken || '',
    chatId: telegramConfig?.chatId || '',
    enabled: telegramConfig?.enabled ?? false,
    apiEndpoint: telegramConfig?.apiEndpoint || 'https://api.telegram.org',
  }));
  const [telegramSaveSuccess, setTelegramSaveSuccess] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Extra Services Presets local state
  const [extraServices, setExtraServices] = useState<ExtraServicePreset[]>(() => {
    return extraServicePresets.length > 0
      ? extraServicePresets
      : [
          {
            id: 'srv-controller',
            name: 'کرایه دسته اضافی',
            price: 15000,
            description: 'استفاده از کنترلر اضافه فراتر از تعداد پیش‌فرض',
            category: 'equipment'
          },
          {
            id: 'srv-headset',
            name: 'کرایه هدفون حرفه‌ای',
            price: 10000,
            description: 'هدست گیمینگ با وضوح بالا و صدای فراگیر',
            category: 'equipment'
          },
          {
            id: 'srv-steering-wheel',
            name: 'شبیه‌ساز فرمان و پدال بازی',
            price: 30000,
            description: 'کرایه کیت فرمان جهت بازی‌های مسابقه‌ای و رانندگی',
            category: 'equipment'
          },
          {
            id: 'srv-damage-controller',
            name: 'خسارت انداختن دسته بازی',
            price: 50000,
            description: 'جریمه سقوط یا ضربه خوردن دسته بازی (طبق قوانین کلوب)',
            category: 'damage'
          },
          {
            id: 'srv-damage-headset',
            name: 'خسارت کشیدگی سیم هدفون',
            price: 30000,
            description: 'خسارت یا قطع و وصلی کابل هدفون به دلیل کشیدگی',
            category: 'damage'
          },
          {
            id: 'srv-vip-room',
            name: 'سرویس ویژه اتاق VIP',
            price: 25000,
            description: 'هزینه شارژ ویژه استفاده از خدمات متمایز اتاق اختصاصی',
            category: 'vip'
          },
        ];
  });

  React.useEffect(() => {
    if (extraServicePresets && extraServicePresets.length > 0) {
      setExtraServices(extraServicePresets);
    }
  }, [extraServicePresets]);

  // Form states for Extra Service creation/editing
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcCategory, setSvcCategory] = useState<'equipment' | 'damage' | 'vip'>('equipment');
  const [svcDescription, setSvcDescription] = useState('');
  const [svcError, setSvcError] = useState('');
  const [svcSuccess, setSvcSuccess] = useState('');

  const resetSvcForm = () => {
    setEditingServiceId(null);
    setSvcName('');
    setSvcPrice('');
    setSvcCategory('equipment');
    setSvcDescription('');
    setSvcError('');
    setSvcSuccess('');
  };

  const handleStartEditService = (item: ExtraServicePreset) => {
    setEditingServiceId(item.id);
    setSvcName(item.name);
    setSvcPrice(item.price.toString());
    setSvcCategory(item.category);
    setSvcDescription(item.description || '');
    setSvcError('');
    setSvcSuccess('');
  };

  const handleSaveExtraServiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSvcError('');
    setSvcSuccess('');

    if (!svcName.trim()) {
      setSvcError('عنوان سرویس نمی‌تواند خالی باشد.');
      return;
    }

    const priceNum = Number(svcPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setSvcError('مبلغ سرویس نامعتبر است.');
      return;
    }

    let updatedList: ExtraServicePreset[];
    if (editingServiceId) {
      updatedList = extraServices.map((item) =>
        item.id === editingServiceId
          ? {
              ...item,
              name: svcName.trim(),
              price: priceNum,
              category: svcCategory,
              description: svcDescription.trim(),
            }
          : item
      );
      setSvcSuccess('سرویس جانبی با موفقیت بروزرسانی شد.');
    } else {
      const newItem: ExtraServicePreset = {
        id: `srv-preset-${Date.now()}`,
        name: svcName.trim(),
        price: priceNum,
        category: svcCategory,
        description: svcDescription.trim(),
      };
      updatedList = [...extraServices, newItem];
      setSvcSuccess('سرویس جانبی جدید با موفقیت اضافه شد.');
    }

    setExtraServices(updatedList);
    if (onSaveExtraServicePresets) {
      onSaveExtraServicePresets(updatedList);
    }
    resetSvcForm();
    setTimeout(() => setSvcSuccess(''), 3000);
  };

  const handleDeleteExtraService = (id: string) => {
    const updatedList = extraServices.filter((item) => item.id !== id);
    setExtraServices(updatedList);
    if (onSaveExtraServicePresets) {
      onSaveExtraServicePresets(updatedList);
    }
    if (editingServiceId === id) {
      resetSvcForm();
    }
  };

  // Rates editing local state
  const [localRates, setLocalRates] = useState<RatesTable>({ ...rates });
  const [ratesSuccess, setRatesSuccess] = useState(false);

  // Alarm repetition settings local state
  const [localAlarmInterval, setLocalAlarmInterval] = useState(alarmIntervalSeconds || 45);
  const [alarmSuccess, setAlarmSuccess] = useState(false);

  // Admin Auto-Logout settings local state
  const [localAutoLogout, setLocalAutoLogout] = useState(adminAutoLogoutMinutes || 0);
  const [autoLogoutSuccess, setAutoLogoutSuccess] = useState(false);

  // Custom preset minutes local state
  const [localPresets, setLocalPresets] = useState<string>(() => {
    return (presetTimerMinutes || [30, 45, 60]).join(', ');
  });
  const [presetSuccess, setPresetSuccess] = useState(false);

  // Custom cash division shortcuts local state
  const [localCashDivisors, setLocalCashDivisors] = useState<string>(() => {
    return (cashDivisors || [2, 3, 4]).join(', ');
  });
  const [cashDivisorsSuccess, setCashDivisorsSuccess] = useState(false);

  // Operators Management Local State
  const [opName, setOpName] = useState('');
  const [opUsername, setOpUsername] = useState('');
  const [opPassword, setOpPassword] = useState('');
  const [opPermissions, setOpPermissions] = useState<UserPermissions>({
    buffet: false,
    debt: false,
    reports: false,
    backups: false,
    settings: false,
    closeWorkingDay: false,
    allowUserEdits: false,
  });
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [opError, setOpError] = useState('');
  const [opSuccess, setOpSuccess] = useState('');

  const resetOpForm = () => {
    setEditingOpId(null);
    setOpName('');
    setOpUsername('');
    setOpPassword('');
    setOpPermissions({
      buffet: false,
      debt: false,
      reports: false,
      backups: false,
      settings: false,
      closeWorkingDay: false,
      allowUserEdits: false,
    });
    setOpError('');
    setOpSuccess('');
  };

  const handleStartEditOperator = (op: Operator) => {
    setEditingOpId(op.id);
    setOpName(op.name);
    setOpUsername(op.username);
    setOpPassword(op.password || '');
    setOpPermissions(op.permissions);
    setOpError('');
    setOpSuccess('');
  };

  const handleSaveOperator = (e: React.FormEvent) => {
    e.preventDefault();
    setOpError('');
    setOpSuccess('');

    const trimmedName = opName.trim();
    const trimmedUser = opUsername.trim();
    const trimmedPass = opPassword.trim();

    if (!trimmedName || !trimmedUser || !trimmedPass) {
      setOpError('لطفاً تمامی فیلدهای نام، نام کاربری و رمز عبور را تکمیل فرمایید.');
      return;
    }

    if (trimmedUser.toLowerCase() === adminUsername.toLowerCase()) {
      setOpError('این نام کاربری برای مدیریت کل رزرو شده است. لطفاً نام کاربری دیگری انتخاب کنید.');
      return;
    }

    // Check duplicate username
    const existingOp = operators.find(
      (op) => op.id !== editingOpId && op.username.trim().toLowerCase() === trimmedUser.toLowerCase()
    );
    if (existingOp) {
      setOpError('اپراتور دیگری با این نام کاربری قبلاً تعریف شده است.');
      return;
    }

    let updatedList: Operator[] = [];
    if (editingOpId) {
      updatedList = operators.map((op) => {
        if (op.id === editingOpId) {
          return {
            ...op,
            name: trimmedName,
            username: trimmedUser,
            password: trimmedPass,
            permissions: { ...opPermissions },
          };
        }
        return op;
      });
      setOpSuccess(`اطلاعات اپراتور «${trimmedName}» با موفقیت بروزرسانی شد.`);
    } else {
      const newOp: Operator = {
        id: `op-${Date.now()}`,
        name: trimmedName,
        username: trimmedUser,
        password: trimmedPass,
        permissions: { ...opPermissions },
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      updatedList = [...operators, newOp];
      setOpSuccess(`اپراتور جدید «${trimmedName}» با موفقیت تعریف گردید.`);
    }

    if (onSaveOperators) {
      onSaveOperators(updatedList);
    }

    resetOpForm();
  };

  const handleToggleOperatorStatus = (opId: string) => {
    const updatedList = operators.map((op) => {
      if (op.id === opId) {
        return { ...op, isActive: !op.isActive };
      }
      return op;
    });
    if (onSaveOperators) {
      onSaveOperators(updatedList);
    }
  };

  const handleDeleteOperator = (opId: string) => {
    const target = operators.find((o) => o.id === opId);
    if (!target) return;
    const updatedList = operators.filter((op) => op.id !== opId);
    if (onSaveOperators) {
      onSaveOperators(updatedList);
    }
    if (editingOpId === opId) {
      resetOpForm();
    }
  };

  // SMS.ir API Integration State
  const [smsApiKeyLocal, setSmsApiKeyLocal] = useState<string>(() => getSmsApiKey());
  const [smsLineNumberLocal, setSmsLineNumberLocal] = useState<string>(() => getSmsLineNumber());
  const [availableSmsLines, setAvailableSmsLines] = useState<string[]>([]);
  const [testMobile, setTestMobile] = useState<string>('');
  const [testSmsMessage, setTestSmsMessage] = useState<string>('سلام، پیامک آزمایشی از سامانه مدیریت گیم‌نت با وب‌سرویس SMS.ir');
  const [smsStatusText, setSmsStatusText] = useState<string>('');
  const [smsCredit, setSmsCredit] = useState<number | null>(null);
  const [isTestingSms, setIsTestingSms] = useState<boolean>(false);

  const handleUpdateSmsApiKey = (newKey: string) => {
    setSmsApiKeyLocal(newKey);
    setSmsApiKey(newKey);
  };

  const handleUpdateSmsLineNumber = (line: string) => {
    setSmsLineNumberLocal(line);
    setSmsLineNumber(line);
  };

  const handleCheckSmsCredit = async () => {
    setIsTestingSms(true);
    setSmsStatusText('در حال بررسی اعتبار و دریافت خطوط فعال در سامانه SMS.ir...');
    const res = await getSmsCredit(smsApiKeyLocal);
    
    // Auto fetch line numbers
    const lines = await getSmsLines(smsApiKeyLocal);
    setAvailableSmsLines(lines);
    if (lines.length > 0 && !smsLineNumberLocal) {
      handleUpdateSmsLineNumber(lines[0]);
    }

    setSmsStatusText(res.message + (lines.length > 0 ? ` (خطوط پنل: ${lines.join(', ')})` : ''));
    if (res.success && typeof res.credit === 'number') {
      setSmsCredit(res.credit);
    }
    setIsTestingSms(false);
  };

  const handleSendTestSmsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMobile.trim()) {
      setSmsStatusText('لطفاً شماره موبایل دریافت‌کننده را وارد کنید.');
      return;
    }
    setIsTestingSms(true);
    setSmsStatusText('در حال ارسال پیامک نظیر به نظیر (LikeToLike) از طریق SMS.ir...');
    const res = await sendDirectSms(testMobile, testSmsMessage, smsLineNumberLocal, smsApiKeyLocal);
    setSmsStatusText(res.message);
    setIsTestingSms(false);
  };

  React.useEffect(() => {
    if (cashDivisors) {
      setLocalCashDivisors(cashDivisors.join(', '));
    }
  }, [cashDivisors]);

  const handleSaveCashDivisorsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = localCashDivisors
      .split(/[,،]/)
      .map(item => parseInt(item.trim(), 10))
      .filter(num => !isNaN(num) && num > 0);

    if (onSaveCashDivisors) {
      onSaveCashDivisors(parsed.length > 0 ? parsed : [2, 3, 4]);
      setCashDivisorsSuccess(true);
      setTimeout(() => setCashDivisorsSuccess(false), 3000);
    }
  };

  React.useEffect(() => {
    if (presetTimerMinutes) {
      setLocalPresets(presetTimerMinutes.join(', '));
    }
  }, [presetTimerMinutes]);

  const handleSavePresetsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = localPresets
      .split(/[,،]/)
      .map(item => parseInt(item.trim(), 10))
      .filter(num => !isNaN(num) && num > 0);
    
    if (onSavePresetTimerMinutes) {
      onSavePresetTimerMinutes(parsed);
      setPresetSuccess(true);
      setTimeout(() => setPresetSuccess(false), 3000);
    }
  };

  // Admin credentials editing local state
  const [localAdminPassword, setLocalAdminPassword] = useState(adminPassword || '123');
  const [localAdminUsername, setLocalAdminUsername] = useState(adminUsername || 'admin');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  React.useEffect(() => {
    if (adminPassword) {
      setLocalAdminPassword(adminPassword);
    }
  }, [adminPassword]);

  React.useEffect(() => {
    if (appName) {
      setLocalAppName(appName);
    }
  }, [appName]);

  React.useEffect(() => {
    if (adminUsername) {
      setLocalAdminUsername(adminUsername);
    }
  }, [adminUsername]);

  React.useEffect(() => {
    if (alarmIntervalSeconds) {
      setLocalAlarmInterval(alarmIntervalSeconds);
    }
  }, [alarmIntervalSeconds]);

  React.useEffect(() => {
    setLocalAutoLogout(adminAutoLogoutMinutes || 0);
  }, [adminAutoLogoutMinutes]);

  React.useEffect(() => {
    setLocalRates({ ...rates });
  }, [rates]);

  const handleSaveAppNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== 'admin') {
      alert('تغییر عنوان سامانه فقط برای مدیریت کل امکان‌پذیر است.');
      return;
    }
    if (onSaveAppName && localAppName.trim()) {
      onSaveAppName(localAppName.trim());
      setAppNameSuccess(true);
      setTimeout(() => setAppNameSuccess(false), 3000);
    }
  };

  const handleSaveAlarmIntervalSubmit = () => {
    onSaveAlarmInterval(localAlarmInterval);
    setAlarmSuccess(true);
    setTimeout(() => setAlarmSuccess(false), 3000);
  };

  const handleSaveAutoLogoutSubmit = () => {
    onSaveAdminAutoLogoutMinutes(localAutoLogout);
    setAutoLogoutSuccess(true);
    setTimeout(() => setAutoLogoutSuccess(false), 3000);
  };

  const handleSavePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (!localAdminUsername.trim()) {
      setPasswordError('نام کاربری مدیریت نمی‌تواند خالی باشد.');
      return;
    }

    if (!localAdminPassword.trim()) {
      setPasswordError('رمز عبور مدیریت نمی‌تواند خالی باشد.');
      return;
    }

    onSaveAdminUsername(localAdminUsername.trim());
    // If the entered password is already a 64-char hex hash, keep it, otherwise hash it with SHA-256
    const passToStore = localAdminPassword.trim().length === 64 && /^[0-9a-fA-F]+$/.test(localAdminPassword.trim())
      ? localAdminPassword.trim()
      : await sha256Hash(localAdminPassword.trim());

    onSaveAdminPassword(passToStore);
    setPasswordSuccess(true);
    setTimeout(() => setPasswordSuccess(false), 3000);
  };

  // New system local state
  const [newSystemName, setNewSystemName] = useState('');
  const [newSystemType, setNewSystemType] = useState<SystemType>('PS5');
  const [isCustomType, setIsCustomType] = useState(false);
  const [customTypeName, setCustomTypeName] = useState('');
  const [systemError, setSystemError] = useState('');
  const [systemSuccess, setSystemSuccess] = useState(false);

  // New card reader local state
  const [newCardReaderName, setNewCardReaderName] = useState('');
  const [cardReaderError, setCardReaderError] = useState('');
  const [cardReaderSuccess, setCardReaderSuccess] = useState(false);

  const handleSaveTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSaveTelegramConfig) {
      onSaveTelegramConfig(localTelegramConfig);
    }
    setTelegramSaveSuccess(true);
    setTimeout(() => setTelegramSaveSuccess(false), 3000);
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setTelegramTestResult(null);
    try {
      const nowStr =
        new Date().toLocaleDateString('fa-IR') +
        ' - ' +
        new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      const testMsg = `
🤖 <b>تست ارتباط بات تلگرام گیم‌نت</b>
━━━━━━━━━━━━━━━━━━
✅ ارتباط بین سامانه مدیریت گیم‌نت و بات تلگرام شما با موفقیت برقرار است.
🏢 <b>مجموعه:</b> ${localAppName || 'کلوب و گیم‌نت'}
📅 <b>تاریخ و زمان تست:</b> <code>${nowStr}</code>
━━━━━━━━━━━━━━━━━━
<i>گزارشات خودکار مالی هنگام اتمام روز کاری به این چت ارسال خواهند شد.</i>
      `.trim();
      const res = await sendTelegramMessage(
        localTelegramConfig.botToken,
        localTelegramConfig.chatId,
        testMsg,
        localTelegramConfig.apiEndpoint
      );
      if (res.success) {
        setTelegramTestResult({
          success: true,
          message: 'پیام نمونه تستی با موفقیت به تلگرام شما ارسال شد! ✅',
        });
      } else {
        setTelegramTestResult({
          success: false,
          message: `خطا در ارسال پیام: ${res.error || 'پاسخ ناموفق از سرور تلگرام'}`,
        });
      }
    } catch (err: any) {
      setTelegramTestResult({
        success: false,
        message: `خطا در اتصال به تلگرام: ${err?.message || err}`,
      });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleAddCardReaderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCardReaderError('');
    setCardReaderSuccess(false);

    if (!newCardReaderName.trim()) {
      setCardReaderError('لطفاً نام کارتخوان را وارد کنید.');
      return;
    }

    if (cardReaders.some(r => r.name.toLowerCase() === newCardReaderName.trim().toLowerCase())) {
      setCardReaderError('کارتخوانی با این نام قبلاً تعریف شده است.');
      return;
    }

    onAddCardReader(newCardReaderName.trim());
    setNewCardReaderName('');
    setCardReaderSuccess(true);
    setTimeout(() => setCardReaderSuccess(false), 3000);
  };

  const handleRateChange = (console: SystemType, rateKey: 'hourlyRate1P' | 'hourlyRate2P' | 'hourlyRate3P' | 'hourlyRate4P', value: string) => {
    const numericValue = Math.max(0, parseInt(value, 10) || 0);
    setLocalRates({
      ...localRates,
      [console]: {
        ...localRates[console],
        [rateKey]: numericValue,
      },
    });
    setRatesSuccess(false);
  };

  const handleSaveRatesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveRates(localRates);
    setRatesSuccess(true);
    setTimeout(() => setRatesSuccess(false), 3000);
  };

  const handleAddSystemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError('');
    setSystemSuccess(false);

    if (!newSystemName.trim()) {
      setSystemError('لطفاً نام یا شماره مشخص برای سیستم وارد کنید.');
      return;
    }

    // Check duplicate name
    if (systems.some((s) => s.name.toLowerCase() === newSystemName.trim().toLowerCase())) {
      setSystemError('سیستمی با این نام قبلاً ایجاد شده است.');
      return;
    }

    const finalType = isCustomType ? customTypeName.trim() : newSystemType;
    if (isCustomType && !finalType) {
      setSystemError('لطفاً نام نوع دستگاه سفارشی را وارد کنید.');
      return;
    }

    onAddSystem(newSystemName.trim(), finalType);
    setNewSystemName('');
    setCustomTypeName('');
    setIsCustomType(false);
    setNewSystemType('PS5');
    setSystemSuccess(true);
    setTimeout(() => setSystemSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200" dir="rtl">
      
      {/* 1. System Node Configuration (Add & Remove Systems) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Create System Card (Takes 5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Monitor className="w-4 h-4 text-blue-400" />
              افزودن سیستم یا کنسول جدید
            </h3>

            {systemError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                <span>{systemError}</span>
              </div>
            )}

            {systemSuccess && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 animate-bounce" />
                <span>دستگاه جدید پورت با موفقیت نصب و راه‌اندازی شد.</span>
              </div>
            )}

            <form onSubmit={handleAddSystemSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 block font-medium">نام یا شماره دستگاه معرفی‌شده</label>
                <input
                  type="text"
                  placeholder="مثال: سیستم 7 (Xbox یا PS5 VIP)"
                  value={newSystemName}
                  onChange={(e) => setNewSystemName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-0b0e14 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center h-4">
                  <label className="text-[10px] text-slate-400 block font-medium">نوع دسته بازی / نرخ‌گذاری مادر</label>
                  {!isCustomType && !['PS5', 'PS4', 'PS4_VIP', 'PC'].includes(newSystemType) && (
                    <button
                      type="button"
                      onClick={() => {
                        const currentType = newSystemType;
                        const systemsUsingType = systems.filter((s) => s.type === currentType);
                        if (systemsUsingType.length > 0) {
                          alert(
                            `خطا: ابتدا باید نوع دستگاه ${systemsUsingType.length} سیستمی که از این نوع استفاده می‌کنند (مانند: ${systemsUsingType
                              .map((s) => s.name)
                              .join('، ')}) را به نوع دیگری تغییر دهید یا حذف کنید.`
                          );
                          return;
                        }
                        if (window.confirm(`آیا از حذف نوع دستگاه "${currentType}" و کل تعرفه‌های مربوط به آن مطمئن هستید؟`)) {
                          const updated = { ...rates };
                          delete updated[currentType];
                          onSaveRates(updated);
                          setNewSystemType('PS5');
                        }
                      }}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-medium flex items-center gap-0.5 cursor-pointer bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      <span>حذف این نوع</span>
                    </button>
                  )}
                </div>
                <select
                  value={isCustomType ? 'custom' : newSystemType}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setIsCustomType(true);
                    } else {
                      setIsCustomType(false);
                      setNewSystemType(val);
                    }
                  }}
                  className="w-full px-3 py-2 bg-surface-0b0e14 border border-white/10 rounded-lg text-white focus:outline-none text-xs cursor-pointer"
                >
                  {Object.keys(rates).map((typeKey) => {
                    const label = 
                      typeKey === 'PS5' ? 'کنسول PS5 (پلی‌استیشن 5)' :
                      typeKey === 'PS4' ? 'کنسول PS4 (پلی‌استیشن 4)' :
                      typeKey === 'PS4_VIP' ? 'کنسول PS4 VIP (وی‌آی‌پی)' :
                      typeKey === 'PC' ? 'سیستم کامپیوتر (PC)' : `دستگاه ${typeKey}`;
                    return (
                      <option key={typeKey} value={typeKey}>{label}</option>
                    );
                  })}
                  <option value="custom">✍️ نوع دلخواه / سفارشی جدید (Xbox، شبیه‌ساز و...)</option>
                </select>
              </div>

              {isCustomType && (
                <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                  <label className="text-[10px] text-blue-400 block font-medium">نام نوع دستگاه جدید (مثال: Xbox ، Simulator)</label>
                  <input
                    type="text"
                    placeholder="مثال: XBOX"
                    value={customTypeName}
                    onChange={(e) => setCustomTypeName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-0b0e14 border border-blue-500/30 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن دستگاه به لیست داشبورد</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Active Systems Nodes Management Table (Takes 7 cols) */}
        <div className="lg:col-span-7">
          <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">لیست و وضعیت فیزیکی سیستم‌ها</h3>
            
            <div className="border border-white/5 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-right" dir="rtl">
                <thead>
                  <tr className="bg-surface-0b0e14 font-semibold text-slate-400 border-b border-white/5">
                    <th className="px-4 py-3">نام صندلی/کارت</th>
                    <th className="px-4 py-3">مدل دستگاه</th>
                    <th className="px-4 py-3 text-center">وضعیت فعلی</th>
                    <th className="px-4 py-3 text-left">عملیات حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-surface-0b0e14/20">
                  {systems.map((sys) => (
                    <tr key={sys.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-200">
                        {sys.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-0b0e14 border border-white/5 text-slate-350">
                          {sys.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {sys.status === 'active' ? (
                          <span className="text-blue-400 font-bold">در حال بازی...</span>
                        ) : sys.status === 'free' ? (
                          <span className="text-emerald-400">آزاد</span>
                        ) : (
                          <span className="text-slate-500">غیرفعال</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => onRemoveSystem(sys.id)}
                          disabled={sys.status === 'active'}
                          className={`p-1.5 rounded transition-colors ${
                            sys.status === 'active'
                              ? 'text-slate-600 cursor-not-allowed'
                              : 'text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer'
                          }`}
                          title={sys.status === 'active' ? 'سیستم فعال در حال بازی را نمی‌توان حذف کرد' : 'حذف دایمی'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* 2. Rates Grid Customization */}
      <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Coins className="w-4 h-4 text-blue-400" />
              تنظیم مجزای تعرفه کنسول‌ها بر حسب ریال/تومان و تعداد دسته‌ها
            </h3>
            <p className="text-[10px] text-slate-400 leading-normal">
              با تنظیم مبالغ به تومان، هزینه‌های نهایی هم بر همان اساس و بهصورت لحظه‌ای در پایان جلسات فاکتور خواهند شد.
            </p>
          </div>

          {ratesSuccess && (
            <div className="p-2 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg flex items-center gap-1 font-bold animate-pulse">
              <CheckCircle2 className="w-4 h-4" />
              <span>تعرفه‌ها با موفقیت بروزرسانی شد.</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSaveRatesSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* PS5 Settings Row */}
            {Object.keys(localRates).map((typeKey) => {
              const currentType = typeKey as SystemType;
              const isDefaultType = ['PS5', 'PS4', 'PS4_VIP', 'PC'].includes(currentType);
              const typeLabel = 
                currentType === 'PS5' ? 'کنسول پلی‌استیشن 5 (PS5)' :
                currentType === 'PS4' ? 'کنسول پلی‌استیشن 4 (PS4)' :
                currentType === 'PS4_VIP' ? 'کنسول پی‌اس4 وی‌آی‌پی (PS4 VIP)' :
                currentType === 'PC' ? 'سیستم کامپیوتر (PC)' : `دستگاه ${currentType}`;
              const typeColor = 
                currentType === 'PS5' ? 'text-purple-400' :
                currentType === 'PS4' ? 'text-indigo-400' :
                currentType === 'PS4_VIP' ? 'text-amber-400' :
                currentType === 'PC' ? 'text-teal-400' : 'text-emerald-400';

              return (
                <div key={typeKey} className="p-4 bg-surface-0b0e14/60 border border-white/5 rounded-xl space-y-4 shadow-inner relative">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold block ${typeColor}`}>{typeLabel}</span>
                    {!isDefaultType && (
                      <button
                        type="button"
                        onClick={() => {
                          const systemsUsingType = systems.filter((s) => s.type === currentType);
                          if (systemsUsingType.length > 0) {
                            alert(
                              `خطا: ابتدا باید نوع دستگاه ${systemsUsingType.length} سیستمی که از این نوع استفاده می‌کنند (مانند: ${systemsUsingType
                                .map((s) => s.name)
                                .join('، ')}) را به نوع دیگری تغییر دهید یا حذف کنید.`
                            );
                            return;
                          }
                          if (window.confirm(`آیا از حذف نوع دستگاه "${currentType}" و کل تعرفه‌های مربوط به آن مطمئن هستید؟`)) {
                            const updated = { ...localRates };
                            delete updated[currentType];
                            setLocalRates(updated);
                            onSaveRates(updated);
                          }
                        }}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                        title="حذف این تعرفه سفارشی"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-3.5 text-xs">
                    {/* Hourly rate 1P */}
                    <div className="grid grid-cols-12 items-center gap-2">
                      <span className="col-span-5 text-slate-400">ساعتی تک دسته (1P)</span>
                      <div className="col-span-7 space-y-1">
                        <input
                          type="number"
                          value={localRates[currentType].hourlyRate1P}
                          onChange={(e) => handleRateChange(currentType, 'hourlyRate1P', e.target.value)}
                          className="w-full px-2 py-1.5 bg-surface-0b0e14 border border-white/10 rounded font-mono text-center text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {localRates[currentType].hourlyRate1P !== undefined && !isNaN(Number(localRates[currentType].hourlyRate1P)) && (
                          <span className="text-[9px] text-blue-400 block font-mono font-bold text-center">
                            {formatCurrency(Number(localRates[currentType].hourlyRate1P))}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hourly rate 2P */}
                    <div className="grid grid-cols-12 items-center gap-2">
                      <span className="col-span-5 text-slate-400">ساعتی دو دسته (2P)</span>
                      <div className="col-span-7 space-y-1">
                        <input
                          type="number"
                          value={localRates[currentType].hourlyRate2P}
                          onChange={(e) => handleRateChange(currentType, 'hourlyRate2P', e.target.value)}
                          className="w-full px-2 py-1.5 bg-surface-0b0e14 border border-white/10 rounded font-mono text-center text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {localRates[currentType].hourlyRate2P !== undefined && !isNaN(Number(localRates[currentType].hourlyRate2P)) && (
                          <span className="text-[9px] text-indigo-400 block font-mono font-bold text-center">
                            {formatCurrency(Number(localRates[currentType].hourlyRate2P))}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hourly rate 3P */}
                    <div className="grid grid-cols-12 items-center gap-2">
                      <span className="col-span-5 text-slate-400">ساعتی سه دسته (3P)</span>
                      <div className="col-span-7 space-y-1">
                        <input
                          type="number"
                          value={localRates[currentType].hourlyRate3P}
                          onChange={(e) => handleRateChange(currentType, 'hourlyRate3P', e.target.value)}
                          className="w-full px-2 py-1.5 bg-surface-0b0e14 border border-white/10 rounded font-mono text-center text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {localRates[currentType].hourlyRate3P !== undefined && !isNaN(Number(localRates[currentType].hourlyRate3P)) && (
                          <span className="text-[9px] text-purple-400 block font-mono font-bold text-center">
                            {formatCurrency(Number(localRates[currentType].hourlyRate3P))}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hourly rate 4P */}
                    <div className="grid grid-cols-12 items-center gap-2">
                      <span className="col-span-5 text-slate-400">ساعتی چهار دسته (4P)</span>
                      <div className="col-span-7 space-y-1">
                        <input
                          type="number"
                          value={localRates[currentType].hourlyRate4P}
                          onChange={(e) => handleRateChange(currentType, 'hourlyRate4P', e.target.value)}
                          className="w-full px-2 py-1.5 bg-surface-0b0e14 border border-white/10 rounded font-mono text-center text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {localRates[currentType].hourlyRate4P !== undefined && !isNaN(Number(localRates[currentType].hourlyRate4P)) && (
                          <span className="text-[9px] text-amber-400 block font-mono font-bold text-center">
                            {formatCurrency(Number(localRates[currentType].hourlyRate4P))}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

          </div>

          <div className="flex gap-4 border-t border-white/5 pt-4">
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all flex items-center gap-1.5 text-xs shadow-md cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>ذخیره نهایی تعرفه‌ها</span>
            </button>
            
            {onResetAllData && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('آیا مطمئن هستید که می‌خواهید کل داده‌های سیستم (شامل بوفه، تاریخچه و دفتر نسیه) را ریست کنید و به حالت مجمتع اولیه بازگردانید؟')) {
                    onResetAllData();
                  }
                }}
                className="px-4 py-2.5 bg-red-950/20 hover:bg-rose-950/30 border border-red-900/30 text-rose-400 font-bold rounded-xl transition-all text-xs flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>پاکسازی و بازنشانی کل دیتابیس</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* 2.5 App Title & Logo Branding Configuration */}
      <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-6 shadow-xl text-right">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-sans">
            <Building className="w-4 h-4 text-blue-400" />
            تغییر عنوان و لوگوی اختصاصی سامانه
          </h3>
          <p className="text-[10px] text-slate-400 leading-normal">
            عنوان اصلی نرم‌افزار و تصویر لوگوی گیم‌نت را که در هدر بالای سامانه و در فاکتورها نمایش داده می‌شود شخصی‌سازی کنید.
          </p>
        </div>

        {userRole !== 'admin' ? (
          <div className="p-3 bg-surface-0b0e14 border border-amber-500/20 rounded-xl text-amber-400 text-xs flex items-center gap-2 font-sans">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>تغییر عنوان و لوگوی مرکز فقط توسط **مدیریت کل** امکان‌پذیر است. کاربر عادی مجاز به تغییر نمی‌باشد.</span>
          </div>
        ) : (
          <div className="space-y-5">
            {/* App Name Form */}
            <form onSubmit={handleSaveAppNameSubmit} className="max-w-md space-y-3.5 text-xs">
              <div className="space-y-1.5 text-right">
                <label className="text-[10px] text-slate-400 block font-medium">عنوان اصلی سامانه:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={localAppName}
                    onChange={(e) => setLocalAppName(e.target.value)}
                    placeholder="مثال: سامانه هوشمند مدیریت گیم‌نت"
                    className="w-full px-3 py-2 bg-surface-0b0e14 border border-white/10 rounded-lg text-white text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs shrink-0 font-sans"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>ذخیره عنوان</span>
                  </button>
                </div>
              </div>

              {appNameSuccess && (
                <div className="p-2 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[10px] rounded-lg flex items-center gap-1 font-bold animate-pulse">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>عنوان سامانه با موفقیت به‌روزرسانی شد.</span>
                </div>
              )}
            </form>

            <div className="border-t border-white/5 pt-4">
              <label className="text-[10px] text-slate-400 block font-medium mb-2">لوگوی اختصاصی هدر:</label>
              <div className="flex flex-wrap items-center gap-4">
                {/* Logo Frame matching header */}
                <div className="flex items-center gap-3 p-2.5 bg-surface-0b0e14 border border-white/10 rounded-xl">
                  {appLogo ? (
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/30 shrink-0 border border-white/10">
                      <img
                        src={appLogo}
                        alt="لوگوی گیم نت"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <img src={defaultLogo} alt="GameNet" className="w-11 h-11 rounded-xl shadow-lg shadow-black/20 shrink-0" />
                  )}
                  <div className="text-right">
                    <div className="text-white text-xs font-bold">{appLogo ? 'لوگوی سفارشی فعال' : 'لوگوی پیش‌فرض برنامه'}</div>
                    <div className="text-[9px] text-slate-400">فرمت مربعی (PNG, JPG, WEBP, SVG)</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLogoModalOpen(true)}
                    className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-300 hover:text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-950/20"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{appLogo ? 'تغییر لوگو' : 'بارگذاری لوگو'}</span>
                  </button>

                  {appLogo && onSaveAppLogo && (
                    <button
                      type="button"
                      onClick={() => onSaveAppLogo(undefined)}
                      className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                      title="بازنشانی لوگو به پیش‌فرض"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف لوگو</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal for uploading/updating the Logo */}
      <LogoUploadModal
        isOpen={isLogoModalOpen}
        onClose={() => setIsLogoModalOpen(false)}
        currentLogo={appLogo}
        onSaveLogo={(newLogo) => {
          if (onSaveAppLogo) onSaveAppLogo(newLogo);
        }}
        userRole={userRole}
      />

      {/* 3. Alarm and Browser Notification Settings */}
      <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-6 shadow-xl">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-400" />
            تنظیمات تکرار آمار و آلارم اتمام بازی
          </h3>
          <p className="text-[10px] text-slate-400 leading-normal">
            مدت زمان تکرار آلارم صوتی و نوتیفیکیشن مرورگر پس از اتمام زمان/مبلغ بازی مشتری را در اینجا شخصی‌سازی کنید.
          </p>
        </div>

        <div className="max-w-xs space-y-3.5 text-xs">
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 block font-medium">بازه تکرار خودکار آلارم پایان وقت (ثانیه):</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="5"
                max="3600"
                value={localAlarmInterval}
                onChange={(e) => {
                  const val = Math.max(5, parseInt(e.target.value, 10) || 5);
                  setLocalAlarmInterval(val);
                }}
                className="w-32 px-3 py-2 bg-surface-0b0e14 border border-white/10 rounded-lg text-white font-mono text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSaveAlarmIntervalSubmit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <span>ذخیره بازه</span>
              </button>
            </div>
          </div>

          {alarmSuccess && (
            <div className="p-2 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[10px] rounded-lg flex items-center gap-1 font-bold animate-pulse">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>پیکربندی تکرار آلارم با موفقیت روی {localAlarmInterval} ثانیه‌ای ذخیره شد.</span>
            </div>
          )}

          {/* Admin Auto-Logout Setting */}
          <div className="space-y-1.5 pt-4 border-t border-white/5">
            <label className="text-[10px] text-slate-400 block font-medium">زمان خروج خودکار از مدیریت پس از عدم فعالیت (دقیقه):</label>
            <div className="flex gap-2">
              <select
                value={localAutoLogout}
                onChange={(e) => setLocalAutoLogout(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-0b0e14 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={0}>غیرفعال (بدون خروج خودکار)</option>
                <option value={1}>۱ دقیقه</option>
                <option value={2}>۲ دقیقه</option>
                <option value={5}>۵ دقیقه</option>
                <option value={10}>۱۰ دقیقه</option>
                <option value={15}>۱۵ دقیقه</option>
                <option value={30}>۳۰ دقیقه</option>
                <option value={60}>۱ ساعت</option>
              </select>
              <button
                type="button"
                onClick={handleSaveAutoLogoutSubmit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs shrink-0"
              >
                <span>ذخیره تایم</span>
              </button>
            </div>
            <p className="text-[9px] text-slate-500 leading-normal mt-1">
              در صورت عدم فعالیت مدیر در سامانه، پس از این مدت زمان به صورت خودکار از حساب مدیریت خارج شده و به پنل کاربر عادی بازمی‌گردد.
            </p>
          </div>

          {autoLogoutSuccess && (
            <div className="p-2 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[10px] rounded-lg flex items-center gap-1 font-bold animate-pulse">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تنظیم خروج خودکار با موفقیت ذخیره شد.</span>
            </div>
          )}
        </div>
      </div>

      {/* 3.5 Preset Custom Timer Minutes Settings */}
      <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-6 shadow-xl text-right">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-sans">
            <Clock className="w-4 h-4 text-blue-400" />
            تعریف زمان‌های پیش‌فرض دکمه‌های تایمر دلخواه
          </h3>
          <p className="text-[10px] text-slate-400 leading-normal">
            زمان‌های پرکاربرد بازی (برحسب دقیقه) را با کاما از هم جدا کنید تا به عنوان دکمه‌های میانبر جهت تنظیم سریع تایمر دلخواه برای هر سیستم نمایش داده شوند.
          </p>
        </div>

        <form onSubmit={handleSavePresetsSubmit} className="max-w-xs space-y-3.5 text-xs">
          <div className="space-y-1.5 text-right">
            <label className="text-[10px] text-slate-400 block font-medium">زمان‌های پیش‌فرض (دقیقه - جداشده با کاما):</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localPresets}
                onChange={(e) => setLocalPresets(e.target.value)}
                placeholder="30, 45, 60"
                className="w-full px-3 py-2 bg-surface-0b0e14 border border-white/10 rounded-lg text-white font-mono text-center focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold tracking-wider"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs shrink-0 font-sans"
              >
                <span>ذخیره زمان‌ها</span>
              </button>
            </div>
          </div>

          {presetSuccess && (
            <div className="p-2 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[10px] rounded-lg flex items-center gap-1 font-bold animate-pulse">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>زمان‌های پیش‌فرض با موفقیت ذخیره شدند.</span>
            </div>
          )}
        </form>
      </div>

      {/* Preset Cash Division Shortcuts Settings */}
      <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-6 shadow-xl text-right">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-sans">
            <Calculator className="w-4 h-4 text-emerald-400" />
            تنظیم دکمه‌های میانبر ماشین‌حساب و تقسیم تسویه نقدی
          </h3>
          <p className="text-[10px] text-slate-400 leading-normal">
            اعدادی که می‌خواهید به عنوان دکمه‌های میانبر جهت تقسیم سریع پرداخت نقدی بین چند نفر در فرم تسویه حساب قرار گیرند را با کاما جدا کنید (مثال: 2, 3, 4, 5).
          </p>
        </div>

        <form onSubmit={handleSaveCashDivisorsSubmit} className="max-w-xs space-y-3.5 text-xs">
          <div className="space-y-1.5 text-right">
            <label className="text-[10px] text-slate-400 block font-medium">گزینه‌های تقسیم (جداشده با کاما):</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localCashDivisors}
                onChange={(e) => setLocalCashDivisors(e.target.value)}
                placeholder="2, 3, 4"
                className="w-full px-3 py-2 bg-surface-0b0e14 border border-white/10 rounded-lg text-white font-mono text-center focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold tracking-wider"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs shrink-0 font-sans"
              >
                <span>ذخیره گزینه‌ها</span>
              </button>
            </div>
          </div>

          {cashDivisorsSuccess && (
            <div className="p-2 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[10px] rounded-lg flex items-center gap-1 font-bold animate-pulse">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>دکمه‌های میانبر تقسیم نقدی با موفقیت بروزرسانی شدند.</span>
            </div>
          )}
        </form>
      </div>

      {/* Admin Password Settings Card */}
      <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-6 shadow-xl">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-400" />
            تغییر و تنظیم نام کاربری و رمز عبور مدیریت
          </h3>
          <p className="text-[10px] text-slate-400 leading-normal">
            برای ورود به بخش‌های حساس بوفه، ترازهای نقد بستانکاری، معوقات مشتریان و بخش‌های مالی، نام کاربری و رمز عبور دلخواه خود را در اینجا پیکربندی و ایمن نمایید.
          </p>
        </div>

        <form onSubmit={handleSavePasswordSubmit} className="max-w-md space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 block font-medium">نام کاربری مدیریت:</label>
              <input
                type="text"
                placeholder="مثال: admin"
                value={localAdminUsername}
                onChange={(e) => setLocalAdminUsername(e.target.value)}
                className="w-full px-3 py-2 bg-surface-0b0e14 border border-white/10 rounded-lg text-white font-mono text-center focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 block font-medium">رمز عبور امنیتی مدیریت:</label>
              <input
                type="text"
                placeholder="مثال: 123"
                value={localAdminPassword}
                onChange={(e) => setLocalAdminPassword(e.target.value)}
                className="w-full px-3 py-2 bg-surface-0b0e14 border border-white/10 rounded-lg text-white font-mono text-center focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <button
              type="submit"
              className="px-5 h-9 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <Save className="w-4 h-4" />
              <span>ذخیره تغییرات مدیریت</span>
            </button>

            {localAdminPassword === '123' && localAdminUsername === 'admin' && (
              <p className="text-[9px] text-amber-500 leading-tight">
                ⚠️ در حال استفاده از نام کاربری و رمز عبور پیش‌فرض (admin / 123) هستید. جهت امنیت صندوق پیشنهاد می‌شود آن را تغییر دهید.
              </p>
            )}
          </div>

          {passwordSuccess && (
            <div className="p-2 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[10px] rounded-lg flex items-center gap-1 font-bold animate-pulse font-sans">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>نام کاربری و رمز عبور مدیریت با موفقیت تغییر یافت.</span>
            </div>
          )}

          {passwordError && (
            <div className="p-2 bg-rose-500/15 border border-rose-500/20 text-rose-400 text-[10px] rounded-lg font-sans">
              {passwordError}
            </div>
          )}
        </form>
      </div>

      {/* 3.5 Operators & Shift Personnel Management Section */}
      <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4.5 h-4.5 text-indigo-400" />
              تعریف و مدیریت اپراتورها و کاربران شیفت (از ۱ نفر تا نامحدود)
            </h3>
            <p className="text-[10px] text-slate-400 leading-normal">
              برای هر یک از همکاران یا اپراتورهای شیفت، نام کاربری، رمز عبور اختصاصی و سطح دسترسی مجزا تعریف نمایید تا بتوانند با اکانت خود وارد سیستم شوند.
            </p>
          </div>
          <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold font-mono rounded-lg shrink-0">
            تعداد اپراتورها: {toPersianDigits(operators.length)} نفر
          </span>
        </div>

        {/* Mandatory Operator Login Toggle Option */}
        <div className="p-4 bg-surface-0b0e14/80 border border-indigo-500/20 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className={`p-2 rounded-xl shrink-0 ${requireOperatorLogin ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800/40 text-slate-500 border border-white/5'}`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 text-right">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white">اجباری بودن ورود اپراتور به سامانه</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    requireOperatorLogin 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-slate-800 text-slate-400 border border-white/5'
                  }`}>
                    {requireOperatorLogin ? 'فعال و اجباری' : 'غیرفعال (اختیاری)'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  با فعال کردن این گزینه، کار با سیستم بدون احراز هویت قفل شده و هنگام باز شدن نرم‌افزار، ورود با نام‌کاربری و رمز عبور اپراتور یا مدیر اجباری خواهد بود.
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  if (userRole !== 'admin') {
                    alert('تغییر وضعیت اجباری بودن ورود اپراتور فقط برای مدیریت کل امکان‌پذیر است.');
                    return;
                  }
                  if (!requireOperatorLogin && operators.filter(o => o.isActive).length === 0) {
                    alert('هشدار: قبل از اجباری کردن ورود اپراتور، لطفاً حداقل یک اپراتور فعال با رمز عبور تعریف نمایید یا با اکانت مدیر کل (admin) وارد شوید.');
                  }
                  if (onSaveRequireOperatorLogin) {
                    onSaveRequireOperatorLogin(!requireOperatorLogin);
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-lg ${
                  requireOperatorLogin
                    ? 'bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 shadow-rose-950/20'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/30 shadow-indigo-950/25'
                }`}
              >
                {requireOperatorLogin ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>غیرفعال‌سازی ورود اجباری</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>فعال‌سازی ورود اجباری اپراتور</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Create or Edit Operator Form */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 bg-surface-0b0e14/70 border border-white/5 rounded-xl space-y-4 text-right">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-indigo-400" />
                  {editingOpId ? 'ویرایش اطلاعات اپراتور' : 'افزودن اپراتور جدید'}
                </span>
                {editingOpId && (
                  <button
                    type="button"
                    onClick={resetOpForm}
                    className="text-[10px] text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
                  >
                    انصراف از ویرایش
                  </button>
                )}
              </div>

              {opError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] rounded-lg font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>{opError}</span>
                </div>
              )}

              {opSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] rounded-lg font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{opSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSaveOperator} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block">نام و نام‌خانوادگی اپراتور</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: علی حسینی (شیفت عصر)"
                    value={opName}
                    onChange={(e) => setOpName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-151921 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block">نام کاربری ورود</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: ali"
                      value={opUsername}
                      onChange={(e) => setOpUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-151921 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block">رمز عبور ورود</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: 1234"
                      value={opPassword}
                      onChange={(e) => setOpPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-151921 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-[11px] font-bold text-slate-300 block">سطح دسترسی‌های این اپراتور:</span>
                  
                  <div className="space-y-1.5 text-[10px]">
                    <label className="flex items-center gap-2 p-2 bg-surface-151921 border border-white/5 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                      <input
                        type="checkbox"
                        checked={opPermissions.buffet}
                        onChange={(e) => setOpPermissions({ ...opPermissions, buffet: e.target.checked })}
                        className="rounded bg-surface-0b0e14 border-white/10 text-indigo-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="text-slate-200 font-medium">صندوق بوفه و فروش مستقیم</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-surface-151921 border border-white/5 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                      <input
                        type="checkbox"
                        checked={opPermissions.debt}
                        onChange={(e) => setOpPermissions({ ...opPermissions, debt: e.target.checked })}
                        className="rounded bg-surface-0b0e14 border-white/10 text-indigo-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="text-slate-200 font-medium">دفتر نسیه و ثبت بدهکاری</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-surface-151921 border border-white/5 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                      <input
                        type="checkbox"
                        checked={opPermissions.reports}
                        onChange={(e) => setOpPermissions({ ...opPermissions, reports: e.target.checked })}
                        className="rounded bg-surface-0b0e14 border-white/10 text-indigo-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="text-slate-200 font-medium">صورت‌های مالی و سود</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-surface-151921 border border-white/5 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                      <input
                        type="checkbox"
                        checked={opPermissions.backups}
                        onChange={(e) => setOpPermissions({ ...opPermissions, backups: e.target.checked })}
                        className="rounded bg-surface-0b0e14 border-white/10 text-indigo-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="text-slate-200 font-medium">دیتابیس و بکاپ‌ها</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-surface-151921 border border-white/5 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                      <input
                        type="checkbox"
                        checked={opPermissions.settings}
                        onChange={(e) => setOpPermissions({ ...opPermissions, settings: e.target.checked })}
                        className="rounded bg-surface-0b0e14 border-white/10 text-indigo-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="text-slate-200 font-medium">تنظیمات عمومی</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-surface-151921 border border-rose-500/20 rounded-lg cursor-pointer hover:bg-rose-500/5 transition-colors">
                      <input
                        type="checkbox"
                        checked={!!opPermissions.closeWorkingDay}
                        onChange={(e) => setOpPermissions({ ...opPermissions, closeWorkingDay: e.target.checked })}
                        className="rounded bg-surface-0b0e14 border-white/10 text-rose-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="text-rose-300 font-medium">اتمام روز کاری (ثبت شیفت)</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-surface-151921 border border-amber-500/20 rounded-lg cursor-pointer hover:bg-amber-500/5 transition-colors">
                      <input
                        type="checkbox"
                        checked={!!opPermissions.allowUserEdits}
                        onChange={(e) => setOpPermissions({ ...opPermissions, allowUserEdits: e.target.checked })}
                        className="rounded bg-surface-0b0e14 border-white/10 text-amber-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="text-amber-300 font-medium">مجوز ویرایش و تغییرات حساس</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-950/20 text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>{editingOpId ? 'ثبت تغییرات اپراتور' : 'ایجاد اپراتور جدید'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* List of Existing Operators */}
          <div className="lg:col-span-7 space-y-3">
            <span className="text-xs font-bold text-slate-300 block">لیست اپراتورهای تعریف‌شده ({toPersianDigits(operators.length)} نفر)</span>

            {operators.length === 0 ? (
              <div className="p-8 text-center bg-surface-0b0e14/40 border border-white/5 rounded-xl space-y-2">
                <Users className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">هیچ اپراتوری ثبت نشده است. می‌توانید نخستین اپراتور خود را ایجاد کنید.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {operators.map((op) => (
                  <div
                    key={op.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      op.isActive
                        ? 'bg-surface-0b0e14/80 border-white/10 hover:border-indigo-500/30'
                        : 'bg-surface-0b0e14/30 border-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          op.isActive ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'
                        }`}>
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white flex items-center gap-2">
                            <span>{op.name}</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                              op.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {op.isActive ? 'فعال' : 'غیرفعال'}
                            </span>
                          </h4>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            نام کاربری: <span className="text-indigo-300 font-bold">{op.username}</span> | رمز عبور: <span className="text-slate-300">{op.password || '***'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 justify-end">
                        <button
                          type="button"
                          onClick={() => handleStartEditOperator(op)}
                          className="px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <span>ویرایش</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleOperatorStatus(op.id)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            op.isActive
                              ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {op.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteOperator(op.id)}
                          className="p-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-all cursor-pointer"
                          title="حذف اپراتور"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Badges of granted permissions */}
                    <div className="pt-2 flex flex-wrap gap-1 text-[9px]">
                      <span className={`px-2 py-0.5 rounded-md font-medium ${op.permissions.buffet ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20' : 'bg-slate-900 text-slate-600 line-through'}`}>
                        صندوق بوفه
                      </span>
                      <span className={`px-2 py-0.5 rounded-md font-medium ${op.permissions.debt ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20' : 'bg-slate-900 text-slate-600 line-through'}`}>
                        دفتر نسیه
                      </span>
                      <span className={`px-2 py-0.5 rounded-md font-medium ${op.permissions.reports ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20' : 'bg-slate-900 text-slate-600 line-through'}`}>
                        صورت‌های مالی
                      </span>
                      <span className={`px-2 py-0.5 rounded-md font-medium ${op.permissions.backups ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20' : 'bg-slate-900 text-slate-600 line-through'}`}>
                        دیتابیس و بکاپ
                      </span>
                      <span className={`px-2 py-0.5 rounded-md font-medium ${op.permissions.settings ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20' : 'bg-slate-900 text-slate-600 line-through'}`}>
                        تنظیمات عمومی
                      </span>
                      <span className={`px-2 py-0.5 rounded-md font-medium ${op.permissions.closeWorkingDay ? 'bg-rose-500/15 text-rose-300 border border-rose-500/20' : 'bg-slate-900 text-slate-600 line-through'}`}>
                        ثبت شیفت / اتمام روز
                      </span>
                      <span className={`px-2 py-0.5 rounded-md font-medium ${op.permissions.allowUserEdits ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20' : 'bg-slate-900 text-slate-600 line-through'}`}>
                        ویرایش اطلاعات حساس
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Global Fallback Operator Permissions for guest users */}
        <div className="border-t border-white/5 pt-4 space-y-3">
          <span className="text-xs font-bold text-slate-300 block">سطح دسترسی پیش‌فرض برای کاربر عادی بدون لایسنس/حساب</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <label className="flex items-center gap-3 p-2.5 bg-surface-0b0e14 border border-white/5 rounded-xl cursor-pointer select-none">
              <input
                type="checkbox"
                checked={userPermissions.buffet}
                onChange={(e) => {
                  if (onUpdateUserPermissions) {
                    onUpdateUserPermissions({ ...userPermissions, buffet: e.target.checked });
                  }
                }}
                className="rounded bg-surface-151921 border-white/10 text-indigo-500 w-4 h-4 cursor-pointer"
              />
              <span className="text-xs text-slate-300 font-medium">صندوق بوفه پیش‌فرض</span>
            </label>

            <label className="flex items-center gap-3 p-2.5 bg-surface-0b0e14 border border-white/5 rounded-xl cursor-pointer select-none">
              <input
                type="checkbox"
                checked={userPermissions.debt}
                onChange={(e) => {
                  if (onUpdateUserPermissions) {
                    onUpdateUserPermissions({ ...userPermissions, debt: e.target.checked });
                  }
                }}
                className="rounded bg-surface-151921 border-white/10 text-indigo-500 w-4 h-4 cursor-pointer"
              />
              <span className="text-xs text-slate-300 font-medium">دفتر نسیه پیش‌فرض</span>
            </label>

            <label className="flex items-center gap-3 p-2.5 bg-surface-0b0e14 border border-white/5 rounded-xl cursor-pointer select-none">
              <input
                type="checkbox"
                checked={userPermissions.reports}
                onChange={(e) => {
                  if (onUpdateUserPermissions) {
                    onUpdateUserPermissions({ ...userPermissions, reports: e.target.checked });
                  }
                }}
                className="rounded bg-surface-151921 border-white/10 text-indigo-500 w-4 h-4 cursor-pointer"
              />
              <span className="text-xs text-slate-300 font-medium">صورت‌های مالی پیش‌فرض</span>
            </label>
          </div>
        </div>
      </div>

      {/* 4. Card Reader (POS) Configuration */}
      <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-6 shadow-xl">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            تعریف و مدیریت دستگاه‌های کارتخوان (POS)
          </h3>
          <p className="text-[10px] text-slate-400 leading-normal">
            دستگاه‌های کارتخوان گیم‌نت را در اینجا تعریف کنید تا در هنگام تسویه حساب فاکتورها قابل انتخاب و در بخش مالی به صورت مجزا تفکیک و گزارش‌گیری شوند.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
          {/* Left panel: Add new card reader */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 bg-surface-0b0e14/60 border border-white/5 rounded-xl space-y-4 text-right">
              <span className="text-xs font-bold text-slate-300 block">ثبت کارتخوان جدید</span>

              {cardReaderError && (
                <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] rounded-lg">
                  {cardReaderError}
                </div>
              )}

              {cardReaderSuccess && (
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] rounded-lg">
                  دستگاه کارتخوان با موفقیت به سیستم اضافه شد.
                </div>
              )}

              <form onSubmit={handleAddCardReaderSubmit} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block font-medium">نام یا عنوان کارتخوان</label>
                  <input
                    type="text"
                    placeholder="مثال: کارتخوان بانک ملی، کارتخوان بانک سامان"
                    value={newCardReaderName}
                    onChange={(e) => setNewCardReaderName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-0b0e14 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ثبت کارتخوان</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right panel: Active card readers list */}
          <div className="lg:col-span-7">
            <div className="border border-white/5 rounded-xl overflow-hidden text-xs text-right">
              <table className="w-full text-right" dir="rtl">
                <thead>
                  <tr className="bg-surface-0b0e14 font-semibold text-slate-400 border-b border-white/5">
                    <th className="px-4 py-2.5">ردیف</th>
                    <th className="px-4 py-2.5 text-right">نام کارتخوان</th>
                    <th className="px-4 py-2.5 text-left">عملیات حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-surface-0b0e14/20">
                  {cardReaders.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                        هیچ دستگاه کارتخوانی تعریف نشده است. لطفاً اضافه کنید.
                      </td>
                    </tr>
                  ) : (
                    cardReaders.map((reader, idx) => (
                      <tr key={reader.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-2.5 text-mono text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-205">{reader.name}</td>
                        <td className="px-4 py-2.5 text-left">
                          <button
                            type="button"
                            onClick={() => onRemoveCardReader(reader.id)}
                            className="p-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 rounded transition-colors cursor-pointer inline-flex items-center"
                            title="حذف کارتخوان"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 4.5 Extra Services & Presets Management Section */}
      <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-amber-400" />
              مدیریت خدمات، امکانات جانبی و خسارات (دسته اضافه، VR، هدفون، VIP و...)
            </h3>
            <p className="text-[10px] text-slate-400 leading-normal">
              تعریف، ویرایش و حذف لیست خدمات جانبی، کرایه لوازم (مانند دسته اضافه، واقعیت مجازی VR) و جریمه‌های خسارت جهت افزودن سریع به فاکتور سیستم‌ها.
            </p>
          </div>
          <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold font-mono rounded-lg shrink-0">
            تعداد خدمات: {toPersianDigits(extraServices.length)} موارد
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Add / Edit Form */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 bg-surface-0b0e14/70 border border-white/5 rounded-xl space-y-4 text-right">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-amber-400" />
                  {editingServiceId ? 'ویرایش سرویس جانبی' : 'افزودن سرویس / امکانات جدید'}
                </span>
                {editingServiceId && (
                  <button
                    type="button"
                    onClick={resetSvcForm}
                    className="text-[10px] text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
                  >
                    انصراف از ویرایش
                  </button>
                )}
              </div>

              {svcError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] rounded-lg font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>{svcError}</span>
                </div>
              )}

              {svcSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] rounded-lg font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{svcSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSaveExtraServiceSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block">عنوان سرویس / امکانات جانبی</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: کرایه واقعیت مجازی (VR) / دسته اضافه"
                    value={svcName}
                    onChange={(e) => setSvcName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-151921 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block">مبلغ (تومان)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1000"
                      placeholder="مثال: 25000"
                      value={svcPrice}
                      onChange={(e) => setSvcPrice(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-151921 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block">دسته‌بندی</label>
                    <select
                      value={svcCategory}
                      onChange={(e) => setSvcCategory(e.target.value as 'equipment' | 'damage' | 'vip')}
                      className="w-full px-3 py-2 bg-surface-151921 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs font-sans"
                    >
                      <option value="equipment">تجهیزات و لوازم</option>
                      <option value="damage">خسارت و جریمه</option>
                      <option value="vip">سرویس ویژه VIP</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block">توضیحات مختصر (اختیاری)</label>
                  <input
                    type="text"
                    placeholder="توضیح کوتاه درباره این سرویس..."
                    value={svcDescription}
                    onChange={(e) => setSvcDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-151921 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs font-sans"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-amber-950/20"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingServiceId ? 'ذخیره تغییرات سرویس' : 'افزودن به لیست خدمات'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* List of Extra Services */}
          <div className="lg:col-span-7 space-y-3">
            <span className="text-xs font-bold text-slate-300 block mb-2">لیست خدمات و امکانات فعال در سیستم:</span>
            {extraServices.length === 0 ? (
              <div className="p-6 bg-surface-0b0e14/40 border border-white/5 rounded-xl text-center text-slate-500 text-xs font-bold">
                هیچ سرویس جانبی تعریف نشده است.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pl-1">
                {extraServices.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-surface-0b0e14 border border-white/5 hover:border-amber-500/30 rounded-xl transition-all flex flex-col justify-between gap-2 text-right"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white text-xs truncate">{item.name}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                          item.category === 'damage'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : item.category === 'vip'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {item.category === 'damage' ? 'خسارت' : item.category === 'vip' ? 'ویژه VIP' : 'تجهیزات'}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-[10px] text-slate-400 line-clamp-2">{item.description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
                      <span className="text-amber-400 font-mono font-bold text-xs">
                        {formatCurrency(item.price)}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEditService(item)}
                          className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                        >
                          ویرایش
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExtraService(item.id)}
                          className="p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition-all cursor-pointer"
                          title="حذف سرویس"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4.8 Telegram Bot Financial Reports Integration */}
      <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-6 shadow-xl font-sans" dir="rtl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Bot className="w-5 h-5 text-sky-400" />
              <span>ارسال خودکار گزارشات مالی به بات تلگرام (Telegram Bot)</span>
            </h3>
            <p className="text-[10px] text-slate-400 leading-normal">
              در هنگام اتمام روز کاری و تهیه بکاپ، خلاصه دقیق وضعیت مالی (شامل درآمد ناخالص، نقدینگی، کارتخوان، نسیه و درآمد بوفه) به طور خودکار به تلگرام شما ارسال می‌شود.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                localTelegramConfig.enabled && localTelegramConfig.botToken && localTelegramConfig.chatId
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800 border-white/10 text-slate-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  localTelegramConfig.enabled && localTelegramConfig.botToken && localTelegramConfig.chatId
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-slate-500'
                }`}
              ></span>
              <span>
                {localTelegramConfig.enabled && localTelegramConfig.botToken && localTelegramConfig.chatId
                  ? 'سرویس تلگرام فعال'
                  : 'غیرفعال'}
              </span>
            </span>
          </div>
        </div>

        {telegramSaveSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>تنظیمات بات تلگرام با موفقیت ذخیره شد.</span>
          </div>
        )}

        {telegramTestResult && (
          <div
            className={`p-3 border rounded-xl text-xs flex items-center gap-2 ${
              telegramTestResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            {telegramTestResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{telegramTestResult.message}</span>
          </div>
        )}

        <form onSubmit={handleSaveTelegram} className="space-y-4 text-right">
          {/* Enable Toggle Switch */}
          <div className="p-3.5 bg-surface-0b0e14 border border-white/5 rounded-xl flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white block">
                فعال‌سازی ارسال خودکار خلاصه مالی در پایان روز کاری
              </span>
              <span className="text-[10px] text-slate-400 block">
                با زدن دکمه «پایان روز کاری و ذخیره بکاپ»، گزارش بلافاصله در تلگرام ارسال می‌گردد.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localTelegramConfig.enabled}
                onChange={(e) =>
                  setLocalTelegramConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bot Token */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 block">
                  توکن بات تلگرام (Bot Token): <span className="text-rose-400">*</span>
                </label>
                <span className="text-[9.5px] text-slate-400 font-mono">از BotFather@</span>
              </div>
              <input
                type="text"
                dir="ltr"
                required={localTelegramConfig.enabled}
                value={localTelegramConfig.botToken}
                onChange={(e) =>
                  setLocalTelegramConfig((prev) => ({ ...prev, botToken: e.target.value.trim() }))
                }
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ_1234567"
                className="w-full px-3.5 py-2.5 bg-surface-0b0e14 border border-white/10 rounded-xl text-sky-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-xs text-left"
              />
              <p className="text-[9.5px] text-slate-400">
                توکن اختصاصی که پس از ساخت بات در تلگرام توسط BotFather@ به شما داده شده است.
              </p>
            </div>

            {/* Chat ID */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 block">
                  شناسه چت یا کانال (Chat ID): <span className="text-rose-400">*</span>
                </label>
                <span className="text-[9.5px] text-slate-400 font-mono">از userinfobot@</span>
              </div>
              <input
                type="text"
                dir="ltr"
                required={localTelegramConfig.enabled}
                value={localTelegramConfig.chatId}
                onChange={(e) =>
                  setLocalTelegramConfig((prev) => ({ ...prev, chatId: e.target.value.trim() }))
                }
                placeholder="123456789 یا 100123456789-"
                className="w-full px-3.5 py-2.5 bg-surface-0b0e14 border border-white/10 rounded-xl text-sky-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-xs text-left"
              />
              <p className="text-[9.5px] text-slate-400">
                شناسه عددی اکانت تلگرام شما، یا شناسه گروه/کانالی که بات در آن عضو و ادمین است.
              </p>
            </div>
          </div>

          {/* Optional Proxy API Endpoint */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">
              آدرس سرور یا پروکسی API تلگرام (اختیاری):
            </label>
            <input
              type="text"
              dir="ltr"
              value={localTelegramConfig.apiEndpoint || ''}
              onChange={(e) =>
                setLocalTelegramConfig((prev) => ({
                  ...prev,
                  apiEndpoint: e.target.value.trim() || 'https://api.telegram.org',
                }))
              }
              placeholder="https://api.telegram.org"
              className="w-full px-3.5 py-2 bg-surface-0b0e14 border border-white/10 rounded-xl text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-xs text-left"
            />
            <p className="text-[9.5px] text-slate-400">
              به‌صورت پیش‌فرض روی <code>https://api.telegram.org</code> قرار دارد. در صورت نیاز به ریورس‌پروکسی یا سرور واسط می‌توانید آدرس آن را اینجا تغییر دهید.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-sky-950/30"
            >
              <Save className="w-4 h-4" />
              <span>ذخیره تنظیمات بات تلگرام</span>
            </button>

            <button
              type="button"
              disabled={isTestingTelegram || !localTelegramConfig.botToken || !localTelegramConfig.chatId}
              onClick={handleTestTelegram}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-sky-400 hover:text-sky-300 font-bold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isTestingTelegram ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال ارسال پیام تستی...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>ارسال پیام نمونه تستی به تلگرام</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Setup Instructions Help Accordion */}
          <div className="p-4 bg-surface-0b0e14/70 border border-white/5 rounded-xl space-y-2 text-xs mt-3">
            <span className="font-bold text-sky-400 block flex items-center gap-1.5 text-xs">
              <HelpCircle className="w-4 h-4" />
              راهنمای سریع ۲ دقیقه‌ای راه‌اندازی بات تلگرام:
            </span>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px] leading-relaxed pr-1">
              <li>
                در پیام‌رسان تلگرام، شناسه <b>BotFather@</b> را جستجو کرده و با دستور <code className="bg-black/40 px-1 py-0.5 rounded text-sky-300">/newbot</code> یک بات جدید بسازید و توکن آن را کپی کنید.
              </li>
              <li>
                وارد چت باتی که ساخته‌اید شوید و دکمه <b>Start</b> یا دستور <code className="bg-black/40 px-1 py-0.5 rounded text-sky-300">/start</code> را ارسال نمایید (تا ربات اجازه ارسال پیام به شما را داشته باشد).
              </li>
              <li>
                در تلگرام به بات <b>userinfobot@</b> پیام دهید تا <b>Id عددی</b> شما را نمایش دهد؛ آن را کپی کرده و در فیلد <b>شناسه چت (Chat ID)</b> بالا قرار دهید.
              </li>
              <li>
                دکمه <b>«ارسال پیام نمونه تستی به تلگرام»</b> را بزنید؛ با دریافت پیام تستی، دکمه <b>ذخیره تنظیمات</b> را بزنید.
              </li>
            </ol>
          </div>
        </form>
      </div>

      {/* 5. Subscription & Developer Licensing Management */}
      <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-6 shadow-xl font-sans" dir="rtl">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" />
            وضعیت اشتراک سالانه و مدیریت لایسنس
          </h3>
          <p className="text-[10px] text-slate-400 leading-normal">
            اطلاعات اشتراک فعال روی این کامپیوتر. تعریف و تمدید لایسنس‌ها فقط از پنل مدیریت روی سرور لایسنس انجام می‌شود.
          </p>
        </div>

        {/* Client Current Subscription Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-surface-0b0e14/60 border border-white/5 p-4 rounded-xl space-y-3">
            <span className="text-xs font-bold text-slate-300 block border-b border-white/5 pb-1.5 text-right">مشخصات لایسنس فعال روی این سیستم</span>
            
            {lic.currentClient ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1 text-slate-400 text-right">
                  <div>مجموعه خریدار: <strong className="text-white">{lic.currentClient.businessName}</strong></div>
                  <div>مدیر کلوب: <strong className="text-slate-300">{lic.currentClient.ownerName}</strong></div>
                  <div>شماره تماس: <strong className="text-slate-300 font-mono">{lic.currentClient.phoneNumber || '-'}</strong></div>
                </div>
                <div className="space-y-1 text-slate-400 text-right">
                  <div>نام کاربری لایسنس: <strong className="text-blue-400 font-mono">{lic.currentClient.username}</strong></div>
                  <div>نوع اشتراک: <strong className="text-indigo-400">
                    {lic.currentClient.subscriptionType === 'lifetime' ? 'مادام‌العمر (طلایی)' :
                     lic.currentClient.subscriptionType === '12months' ? '12 ماهه' : 
                     lic.currentClient.subscriptionType === '6months' ? '6 ماهه' : 'سفارشی'}
                  </strong></div>
                  <div>وضعیت انقضاء: <strong className={`font-mono ${lic.getRemainingDays(lic.currentClient) <= 30 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {lic.getRemainingDaysLabel(lic.currentClient)}
                  </strong></div>
                  <div>ریموت موبایل: <strong className={lic.currentClient.features?.remote ? 'text-emerald-400' : 'text-slate-500'}>
                    {lic.currentClient.features?.remote ? 'فعال' : 'غیرفعال'}
                  </strong></div>
                  {lic.licenseStatus.tokenExpiresAt && (
                    <div>اعتبار آفلاین تا: <strong className="text-slate-300">{lic.getPersianDateLabel(lic.licenseStatus.tokenExpiresAt)}</strong></div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-right">هیچ لایسنس فعالی بارگذاری نشده است.</p>
            )}

            <div className="flex flex-wrap gap-2.5 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={lic.handleLogout}
                className="px-4 py-2 bg-rose-600/10 hover:bg-rose-600 border border-rose-500/30 hover:text-white text-rose-400 font-bold text-[10px] rounded-lg transition-all cursor-pointer"
              >
                خروج از حساب لایسنس 🔒
              </button>

              <button
                type="button"
                onClick={() => {
                  lic.refreshSubscription();
                }}
                disabled={lic.isSyncingWithRealHost}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded-lg transition-all cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${lic.isSyncingWithRealHost ? 'animate-spin' : ''}`} />
                <span>بررسی مجدد و همگام‌سازی لایسنس</span>
              </button>
            </div>

            {lic.isSyncingWithRealHost && (
              <p className="text-[10px] text-amber-400 font-bold animate-pulse text-right">{lic.syncStatusText}</p>
            )}
          </div>

          {/* Master Developer Console Access */}
          <div className="bg-surface-0b0e14/60 border border-white/5 p-4 rounded-xl flex flex-col justify-between space-y-3">
            <div className="space-y-1 text-right">
              <span className="text-xs font-bold text-slate-300 block border-b border-white/5 pb-1.5">ورود به پنل توسعه‌دهنده</span>
              <p className="text-[10px] text-slate-500 leading-normal">
                تنظیمات پیشرفته (مثل سرویس پیامک) با رمز مدیر همین برنامه باز می‌شود.
              </p>
            </div>

            {lic.isDevConsoleUnlocked ? (
              <div className="space-y-2">
                <div className="p-2 bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[10px] rounded-lg font-bold text-center">
                  🔓 پیشخوان مدیریت باز است
                </div>
                <button
                  type="button"
                  onClick={lic.handleLockConsole}
                  className="w-full py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/25 font-bold text-[10px] rounded-lg transition-all cursor-pointer"
                >
                  قفل مجدد دسترسی ارشد 🔒
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => lic.setShowUnlockModal(true)}
                className="w-full py-2 bg-amber-600/10 hover:bg-amber-600 border border-amber-500/30 text-amber-400 hover:text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>ورود به پیشخوان مدیریت</span>
              </button>
            )}
          </div>
        </div>

        {/* Developer Console & SMS.ir Web Service (Visible only if Unlocked) */}
        {lic.isDevConsoleUnlocked && (
          <div className="pt-6 border-t border-white/10 space-y-6 animate-in slide-in-from-top duration-300 text-right">
            {/* SMS.IR API GATEWAY DIRECT INTEGRATION CARD */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 bg-surface-0f131c p-5 rounded-2xl border border-amber-500/20 shadow-xl">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <h3 className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      تنظیمات اتصال مستقیم به وب‌سرویس پیامکی SMS.ir
                    </h3>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold rounded-lg font-mono">
                    SMS.ir API Active
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] text-slate-200 font-bold block">
                        کلید دسترسی مستقیم API پیامک (SMS.ir API Key):
                      </label>
                      {smsApiKeyLocal === DEFAULT_SMS_API_KEY && (
                        <span className="text-[9.5px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                          ✓ کلید اختصاصی SMS.ir ست شده است
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        dir="ltr"
                        value={smsApiKeyLocal}
                        onChange={(e) => handleUpdateSmsApiKey(e.target.value)}
                        placeholder="pBA7mhPzUHUCPzUqqVvU321gWgTIytTh4RCWdsL65RC3Zi0D"
                        className="flex-1 px-3 py-2 bg-surface-06080d border border-amber-500/30 rounded-xl text-amber-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-xs text-left"
                      />
                      <button
                        type="button"
                        onClick={handleCheckSmsCredit}
                        disabled={isTestingSms}
                        className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] rounded-xl transition-all cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {isTestingSms ? 'در حال برقراری ارتباط...' : 'استعلام اعتبار SMS.ir'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] text-slate-200 font-bold block">
                        شماره خط فرستنده SMS.ir (Line Number):
                      </label>
                      <a
                        href="https://app.sms.ir/developer/help/likeToLike"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[9.5px] text-amber-400/80 hover:text-amber-300 hover:underline flex items-center gap-1"
                      >
                        مستندات متد likeToLike ↗
                      </a>
                    </div>
                    <input
                      type="text"
                      dir="ltr"
                      value={smsLineNumberLocal}
                      onChange={(e) => handleUpdateSmsLineNumber(e.target.value)}
                      placeholder="مثال: 300077... (در صورت خالی بودن خودکار شناسایی می‌شود)"
                      className="w-full px-3 py-2 bg-surface-06080d border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-xs text-left"
                    />
                    {availableSmsLines.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[10px] text-slate-400">خطوط شناسایی‌شده در پنل شما:</span>
                        {availableSmsLines.map((line) => (
                          <button
                            key={line}
                            type="button"
                            onClick={() => handleUpdateSmsLineNumber(line)}
                            className={`px-2 py-0.5 text-[10.5px] font-mono rounded-lg border transition-all cursor-pointer ${
                              smsLineNumberLocal === line
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold shadow-xs'
                                : 'bg-surface-030508 text-slate-300 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            {line}
                          </button>
                        ))}
                      </div>
                    )}
                    <span className="text-[9.5px] text-slate-400 block leading-relaxed mt-1">
                      💡 طبق مستندات وب‌سرویس نظیر به نظیر (likeToLike)، ارسال پیامک از طریق خط اختصاصی یا فعال حساب SMS.ir شما انجام می‌شود.
                    </span>
                  </div>

                  {smsCredit !== null && (
                    <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl flex justify-between items-center text-xs">
                      <span className="text-emerald-300 font-bold">اعتبار حساب SMS.ir:</span>
                      <span className="font-mono text-emerald-400 font-bold text-sm">
                        {smsCredit.toLocaleString('fa-IR')} ریال
                      </span>
                    </div>
                  )}

                  {smsStatusText && (
                    <div className="p-2.5 bg-blue-950/40 border border-blue-500/20 rounded-xl text-[11px] text-blue-300 font-sans">
                      {smsStatusText}
                    </div>
                  )}
                </div>

                {/* Local Storage Mode Status */}
                <div className="p-3 bg-surface-131a28 rounded-xl border border-white/5 space-y-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-amber-300 font-bold">وضعیت ذخیره‌سازی لایسنس‌ها (حالت لوکال / آفلاین)</span>
                    <span className="text-[9px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Local Storage Active
                    </span>
                  </div>
                  <p className="text-[9.5px] text-slate-400 leading-relaxed">
                    برنامه در حالت کاملاً لوکال و بدون نیاز به سرور خارجی تنظیم شده است. تمامی اطلاعات لایسنس‌ها و اشتراک‌ها مستقیماً در حافظه محلی سیستم ذخیره و مدیریت می‌شوند.
                  </p>
                </div>
              </div>

              {/* TEST SMS SENDER BOX */}
              <div className="bg-surface-080b12 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between text-right space-y-3">
                <div className="space-y-1 border-b border-white/5 pb-2">
                  <span className="text-[11px] font-bold text-amber-300 block flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-amber-400" />
                    ارسال آزمایشی نظیر به نظیر (SMS.ir LikeToLike)
                  </span>
                  <p className="text-[9.5px] text-slate-400 leading-relaxed">
                    ارسال طبق مستندات وب‌سرویس <code className="text-amber-400 font-mono">send/likeToLike</code> با شماره خط فعال پنل.
                  </p>
                </div>

                <form onSubmit={handleSendTestSmsSubmit} className="space-y-2.5 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-300 font-bold block">شماره دریافت کننده:</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={testMobile}
                      onChange={(e) => setTestMobile(e.target.value)}
                      placeholder="09123456789"
                      className="w-full px-3 py-1.5 bg-surface-030508 border border-white/10 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500 text-left"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-300 font-bold block">متن پیامک:</label>
                    <textarea
                      rows={2}
                      value={testSmsMessage}
                      onChange={(e) => setTestSmsMessage(e.target.value)}
                      className="w-full p-2 bg-surface-030508 border border-white/10 rounded-lg text-slate-200 text-[10px] focus:ring-1 focus:ring-amber-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isTestingSms}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10.5px] rounded-lg transition-all cursor-pointer shadow-lg shadow-emerald-950/30 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>ارسال پیامک با متد LikeToLike</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {showRemote && <RemoteAccessPanel />}

    </div>
  );
}
