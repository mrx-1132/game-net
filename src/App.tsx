import React, { useState, useEffect } from 'react';
import { 
  Monitor, ShoppingCart, Users, ClipboardCheck, BarChart3, 
  Settings, Flame, Info, Clock, AlertTriangle, RefreshCw,
  Lock, Key, LayoutGrid, LayoutList, Database, Sun, Moon,
  ChevronDown, Sparkles, Play, FileText, Trash2, Edit3, Check, X,
  User, Shield, LogOut
} from 'lucide-react';

import { 
  System, RatesTable, BuffetItem, DebtCustomer, 
  SessionHistory, DirectBuffetSale, SystemType, RateConfig,
  DailyWorkingDayBackup, CardReader, ActiveSession, UserPermissions, SystemLog,
  SessionBuffetItem, PartialPayment, Operator, ExtraServicePreset, TelegramConfig
} from './types';
import { sendTelegramMessage, formatDailyFinancialTelegramReport } from './services/telegramService';

import { 
  DEFAULT_RATES, DEFAULT_SYSTEMS, DEFAULT_BUFFET, 
  DEFAULT_DEBTORS, DEFAULT_HISTORY, DEFAULT_CARD_READERS,
  DEFAULT_EXTRA_SERVICE_PRESETS
} from './initialData';

const DEFAULT_OPERATORS: Operator[] = [
  {
    id: 'op-1',
    name: 'اپراتور شیفت اصلی',
    username: 'operator',
    password: '123',
    isActive: true,
    permissions: {
      buffet: false,
      debt: false,
      reports: false,
      backups: false,
      settings: false,
      closeWorkingDay: false,
      allowUserEdits: false,
    },
    createdAt: new Date().toISOString(),
  },
];

import { formatCurrency, formatDatePersian, getSessionMetrics, downloadDatabaseBackupPayload } from './utils';

// Import sub components
import SystemCard from './components/SystemCard';
import StartSessionModal from './components/StartSessionModal';
import SettleSessionModal from './components/SettleSessionModal';
import AddBuffetItemModal from './components/AddBuffetItemModal';
import AddExtraServiceModal from './components/AddExtraServiceModal';
import BuffetTab from './components/BuffetTab';
import DebtTab from './components/DebtTab';
import ReportsTab from './components/ReportsTab';
import SettingsTab from './components/SettingsTab';
import AdminLoginModal from './components/AdminLoginModal';
import BuffetPOSDesk from './components/BuffetPOSDesk';
import CloseWorkingDayModal from './components/CloseWorkingDayModal';
import BackupsTab from './components/BackupsTab';
import LicensingPortal from './components/LicensingPortal';
import defaultLogo from './assets/images/gamenet-logo.png';
import GroupSettleModal from './components/GroupSettleModal';
import TransferSessionModal from './components/TransferSessionModal';
import SpecialServicesTab from './components/SpecialServicesTab';
import SystemLogsModal from './components/SystemLogsModal';
import { useRemoteBridge } from './remote/useRemoteBridge';

const LOCAL_STORAGE_KEY_PREFIX = 'gamenet_mfr_v2_';

const getStoredLocal = (key: string, defaults: any) => {
  try {
    const item = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + key);
    if (!item || item === 'undefined' || item === 'null' || item === 'NaN') {
      return defaults;
    }
    return JSON.parse(item);
  } catch (err) {
    console.warn(`Could not parse localStorage item for ${key}:`, err);
    return defaults;
  }
};

export default function App() {
  // Tabs active state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'buffet' | 'debt' | 'reports' | 'settings' | 'backups' | 'services'>('dashboard');

  // Theme state switcher: 'dark' | 'light'
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('gamenet_theme') as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('gamenet_theme', nextTheme);
  };

  // کلاس تم روی <html> هم بنشیند تا مودال‌ها و پس‌زمینه صفحه هم هم‌رنگ شوند
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  // Layout mode switcher state
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>(() => getStoredLocal('layoutMode', 'grid'));

  // Interactive user session roles: 'admin' (all-access) or 'user' (only systems dashboard)
  const [userRole, setUserRole] = useState<'admin' | 'user'>('user');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isBuffetPOSOpen, setIsBuffetPOSOpen] = useState(false);

  // Core Data models
  const [rates, setRates] = useState<RatesTable>(() => getStoredLocal('rates', DEFAULT_RATES));
  const [systems, setSystems] = useState<System[]>(() => getStoredLocal('systems', DEFAULT_SYSTEMS));
  const [buffetItems, setBuffetItems] = useState<BuffetItem[]>(() => getStoredLocal('buffetItems', DEFAULT_BUFFET));
  const [debtors, setDebtors] = useState<DebtCustomer[]>(() => getStoredLocal('debtors', DEFAULT_DEBTORS));
  const [history, setHistory] = useState<SessionHistory[]>(() => getStoredLocal('history', DEFAULT_HISTORY));
  const [directSales, setDirectSales] = useState<DirectBuffetSale[]>(() => getStoredLocal('directSales', []));
  const [dailyBackups, setDailyBackups] = useState<DailyWorkingDayBackup[]>(() => getStoredLocal('dailyBackups', []));
  const [alarmIntervalSeconds, setAlarmIntervalSeconds] = useState<number>(() => getStoredLocal('alarmIntervalSeconds', 45));
  const [presetTimerMinutes, setPresetTimerMinutes] = useState<number[]>(() => getStoredLocal('presetTimerMinutes', [30, 45, 60]));
  const [cashDivisors, setCashDivisors] = useState<number[]>(() => getStoredLocal('cashDivisors', [2, 3, 4]));
  const [cardReaders, setCardReaders] = useState<CardReader[]>(() => getStoredLocal('cardReaders', DEFAULT_CARD_READERS));
  const [adminPassword, setAdminPassword] = useState<string>(() => getStoredLocal('adminPassword', '123'));
  const [adminUsername, setAdminUsername] = useState<string>(() => getStoredLocal('adminUsername', 'admin'));
  const [adminAutoLogoutMinutes, setAdminAutoLogoutMinutes] = useState<number>(() => getStoredLocal('adminAutoLogoutMinutes', 0));
  const [showAutoLogoutBanner, setShowAutoLogoutBanner] = useState<boolean>(false);
  const [appName, setAppName] = useState<string>(() => getStoredLocal('appName', 'سامانه هوشمند مدیریت گیم‌نت'));
  const [appLogo, setAppLogo] = useState<string | undefined>(() => getStoredLocal('appLogo', undefined));
  const [userPermissions, setUserPermissions] = useState<UserPermissions>(() => getStoredLocal('userPermissions', {
    buffet: false,
    debt: false,
    reports: false,
    backups: false,
    settings: false,
    closeWorkingDay: false,
  }));
  const [operators, setOperators] = useState<Operator[]>(() => getStoredLocal('operators', DEFAULT_OPERATORS));
  const [requireOperatorLogin, setRequireOperatorLogin] = useState<boolean>(() => getStoredLocal('requireOperatorLogin', false));
  const [currentOperator, setCurrentOperator] = useState<Operator | null>(null);
  const [extraServicePresets, setExtraServicePresets] = useState<ExtraServicePreset[]>(() => getStoredLocal('extraServicePresets', DEFAULT_EXTRA_SERVICE_PRESETS));
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => getStoredLocal('telegramConfig', {
    botToken: '',
    chatId: '',
    enabled: false,
    apiEndpoint: 'https://api.telegram.org',
  }));

  const handleSaveOperators = (newOperators: Operator[]) => {
    setOperators(newOperators);
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}operators`, JSON.stringify(newOperators));
    
    // If the currently active operator was edited, immediately synchronize their active state and permissions
    if (currentOperator) {
      const updatedCurrent = newOperators.find(op => op.id === currentOperator.id);
      if (updatedCurrent) {
        setCurrentOperator(updatedCurrent);
        setUserPermissions(updatedCurrent.permissions);
      }
    }
  };
  const [selectedGroupSystemIds, setSelectedGroupSystemIds] = useState<string[]>([]);
  const [showGroupSettleModal, setShowGroupSettleModal] = useState(false);
  const [showStatsDropdown, setShowStatsDropdown] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showGroupSelectDropdown, setShowGroupSelectDropdown] = useState(false);

  // System Event Logs state
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}system_logs`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        type: 'system',
        message: 'سامانه و سیستم‌های بازی راه‌اندازی و آماده به کار شدند.',
        details: 'ورود موفق به نرم‌افزار مدیریت کلوب گیم‌نت'
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}system_logs`, JSON.stringify(systemLogs));
  }, [systemLogs]);

  const addSystemLog = (message: string, type: SystemLog['type'] = 'system', systemName?: string, details?: string) => {
    const newLog: SystemLog = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      type,
      message,
      systemName,
      details
    };
    setSystemLogs(prev => [newLog, ...prev].slice(0, 300));
  };

  // Power outage notification banner state
  const [powerOutageNotice, setPowerOutageNotice] = useState<{
    show: boolean;
    outageTimeISO: string;
    affectedSystems: string[];
  }>({
    show: false,
    outageTimeISO: '',
    affectedSystems: [],
  });

  // Custom confirmation dialog state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: 'تأیید عملیات',
    message: '',
    onConfirm: () => {},
  });

  // Modals operations state
  const [startModalSysId, setStartModalSysId] = useState<string | null>(null);
  const [settleModalSysId, setSettleModalSysId] = useState<string | null>(null);
  const [transferSourceSysId, setTransferSourceSysId] = useState<string | null>(null);
  const [addBuffetSysId, setAddBuffetSysId] = useState<string | null>(null);
  const [addExtraServiceSysId, setAddExtraServiceSysId] = useState<string | null>(null);
  const [isCloseDayModalOpen, setIsCloseDayModalOpen] = useState(false);

  // Live time ticker for general header stats (optional)
  const [headerTime, setHeaderTime] = useState(new Date());

  // LocalStorage Loading Cycle & Power Outage Detection
  useEffect(() => {
    try {
      const getStored = (key: string, defaults: any) => {
        try {
          const item = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + key);
          if (!item || item === 'undefined' || item === 'null' || item === 'NaN') {
            return defaults;
          }
          return JSON.parse(item);
        } catch (err) {
          console.warn(`Could not parse localStorage item for ${key}:`, err);
          return defaults;
        }
      };

      setRates(getStored('rates', DEFAULT_RATES));
      
      const storedSystems: System[] = getStored('systems', DEFAULT_SYSTEMS);

      // Heartbeat detection for power outage / unexpected shutdown gap
      const lastHeartbeatStr = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'last_heartbeat');
      const nowMs = Date.now();

      if (lastHeartbeatStr) {
        const lastHeartbeatMs = Number(lastHeartbeatStr);
        const gapMs = nowMs - lastHeartbeatMs;

        // Gap larger than 45 seconds means browser/machine crashed or power went out
        if (!isNaN(lastHeartbeatMs) && lastHeartbeatMs > 0 && gapMs > 45000) {
          const outageISO = new Date(lastHeartbeatMs).toISOString();
          const affectedNames: string[] = [];

          const adjustedSystems = storedSystems.map((sys) => {
            if (sys.status === 'active' && sys.activeSession && !sys.activeSession.pausedTime) {
              affectedNames.push(sys.name);
              return {
                ...sys,
                activeSession: {
                  ...sys.activeSession,
                  pausedTime: outageISO,
                  isPowerOutagePaused: true,
                  powerOutageTime: outageISO,
                },
              };
            }
            return sys;
          });

          if (affectedNames.length > 0) {
            setPowerOutageNotice({
              show: true,
              outageTimeISO: outageISO,
              affectedSystems: affectedNames,
            });
            setSystems(adjustedSystems);
          } else {
            setSystems(storedSystems);
          }
        } else {
          setSystems(storedSystems);
        }
      } else {
        setSystems(storedSystems);
      }

      setBuffetItems(getStored('buffetItems', DEFAULT_BUFFET));
      setDebtors(getStored('debtors', DEFAULT_DEBTORS));
      setHistory(getStored('history', DEFAULT_HISTORY));
      setDirectSales(getStored('directSales', []));
      setDailyBackups(getStored('dailyBackups', []));
      setLayoutMode(getStored('layoutMode', 'grid'));
      setAlarmIntervalSeconds(getStored('alarmIntervalSeconds', 45));
      setPresetTimerMinutes(getStored('presetTimerMinutes', [30, 45, 60]));
      setCashDivisors(getStored('cashDivisors', [2, 3, 4]));
      setCardReaders(getStored('cardReaders', DEFAULT_CARD_READERS));
      setAdminPassword(getStored('adminPassword', '123'));
      setAdminUsername(getStored('adminUsername', 'admin'));
      setAdminAutoLogoutMinutes(getStored('adminAutoLogoutMinutes', 0));
      setAppName(getStored('appName', 'سامانه هوشمند مدیریت گیم‌نت'));
      setAppLogo(getStored('appLogo', undefined));
      setOperators(getStored('operators', DEFAULT_OPERATORS));
      setRequireOperatorLogin(getStored('requireOperatorLogin', false));
      setExtraServicePresets(getStored('extraServicePresets', DEFAULT_EXTRA_SERVICE_PRESETS));
      setUserPermissions(getStored('userPermissions', {
        buffet: false,
        debt: false,
        reports: false,
        backups: false,
        settings: false,
        closeWorkingDay: false,
      }));
    } catch (e) {
      console.error('Failed reading localStorage databases', e);
    }
  }, []);

  // Live Heartbeat Interval for power outage monitoring
  useEffect(() => {
    const updateHeartbeat = () => {
      localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + 'last_heartbeat', Date.now().toString());
    };

    updateHeartbeat();
    const intervalId = setInterval(updateHeartbeat, 3000);

    const handleBeforeUnload = () => {
      updateHeartbeat();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Save to LocalStorage whenever state modifies
  useEffect(() => {
    const saveStore = (key: string, data: any) => {
      if (data === undefined) {
        localStorage.removeItem(LOCAL_STORAGE_KEY_PREFIX + key);
      } else {
        localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + key, JSON.stringify(data));
      }
    };
    saveStore('rates', rates);
    saveStore('systems', systems);
    saveStore('buffetItems', buffetItems);
    saveStore('debtors', debtors);
    saveStore('history', history);
    saveStore('directSales', directSales);
    saveStore('dailyBackups', dailyBackups);
    saveStore('layoutMode', layoutMode);
    saveStore('alarmIntervalSeconds', alarmIntervalSeconds);
    saveStore('presetTimerMinutes', presetTimerMinutes);
    saveStore('cashDivisors', cashDivisors);
    saveStore('cardReaders', cardReaders);
    saveStore('adminPassword', adminPassword);
    saveStore('adminUsername', adminUsername);
    saveStore('adminAutoLogoutMinutes', adminAutoLogoutMinutes);
    saveStore('appName', appName);
    saveStore('appLogo', appLogo);
    saveStore('userPermissions', userPermissions);
    saveStore('operators', operators);
    saveStore('requireOperatorLogin', requireOperatorLogin);
    saveStore('extraServicePresets', extraServicePresets);
    saveStore('telegramConfig', telegramConfig);
  }, [rates, systems, buffetItems, debtors, history, directSales, dailyBackups, layoutMode, alarmIntervalSeconds, presetTimerMinutes, cashDivisors, cardReaders, adminPassword, adminUsername, adminAutoLogoutMinutes, appName, appLogo, userPermissions, operators, requireOperatorLogin, extraServicePresets, telegramConfig]);

  // General Clock Tick
  useEffect(() => {
    const id = setInterval(() => setHeaderTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Admin Auto-logout on Inactivity
  useEffect(() => {
    if (userRole !== 'admin' || adminAutoLogoutMinutes <= 0) {
      return;
    }

    let timeoutId: any;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        setUserRole('user');
        setActiveTab('dashboard');
        setShowAutoLogoutBanner(true);
      }, adminAutoLogoutMinutes * 60 * 1000);
    };

    resetTimer();

    const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'click'];
    
    const handleActivity = () => {
      resetTimer();
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [userRole, adminAutoLogoutMinutes]);

  // Enforce Mandatory Operator / Admin Login if configured
  useEffect(() => {
    if (requireOperatorLogin && userRole !== 'admin' && !currentOperator) {
      setIsLoginModalOpen(true);
    }
  }, [requireOperatorLogin, userRole, currentOperator]);

  // HANDLERS: Session controls
  const handleOpenStartModal = (systemId: string) => setStartModalSysId(systemId);

  const handleOpenSettleModal = (systemId: string) => {
    const nowISO = new Date().toISOString();
    setSystems((prev) =>
      prev.map((sys) => {
        if (sys.id === systemId && sys.activeSession && !sys.activeSession.pausedTime) {
          return {
            ...sys,
            activeSession: {
              ...sys.activeSession,
              pausedTime: nowISO,
              autoPausedForSettle: true,
            },
          };
        }
        return sys;
      })
    );
    setSettleModalSysId(systemId);
  };

  const handleCloseSettleModal = () => {
    if (settleModalSysId) {
      const now = new Date();
      setSystems((prev) =>
        prev.map((sys) => {
          if (
            sys.id === settleModalSysId &&
            sys.activeSession &&
            sys.activeSession.pausedTime &&
            sys.activeSession.autoPausedForSettle
          ) {
            const pausedAt = new Date(sys.activeSession.pausedTime);
            const msPaused = now.getTime() - pausedAt.getTime();
            return {
              ...sys,
              activeSession: {
                ...sys.activeSession,
                pausedTime: undefined,
                autoPausedForSettle: undefined,
                totalPausedMs: sys.activeSession.totalPausedMs + msPaused,
                lastResumeTime: now.toISOString(),
              },
            };
          }
          return sys;
        })
      );
    }
    setSettleModalSysId(null);
  };

  const handleOpenAddBuffetModal = (systemId: string) => setAddBuffetSysId(systemId);
  const handleOpenAddExtraServiceModal = (systemId: string) => setAddExtraServiceSysId(systemId);

  const startSessionOnSystem = (
    systemId: string,
    customerName: string,
    playersCount: 1 | 2 | 3 | 4,
    debtorId?: string,
    backdateMinutes?: number
  ) => {
    const targetSys = systems.find(s => s.id === systemId);
    const startDateTime = new Date();
    if (backdateMinutes && backdateMinutes > 0) {
      startDateTime.setMinutes(startDateTime.getMinutes() - backdateMinutes);
    }
    const startTimeISO = startDateTime.toISOString();

    addSystemLog(
      `شروع نشست بازی جدید توسط ${customerName || 'مشتری'} (تعداد دسته: ${playersCount})`,
      'session_start',
      targetSys?.name,
      `تعداد دسته: ${playersCount} - نام مشتری: ${customerName || 'ثبت نشده'}`
    );

    setSystems((prev) =>
      prev.map((sys) => {
        if (sys.id === systemId) {
          return {
            ...sys,
            status: 'active',
            activeSession: {
              customerName,
              customerPhone: debtorId ? debtors.find((d) => d.id === debtorId)?.phone : undefined,
              startTime: startTimeISO,
              totalPausedMs: 0,
              lastResumeTime: startTimeISO,
              playersCount,
              buffetItems: [],
              playerCountChanges: [{ playersCount, atElapsedMs: 0 }],
            },
          };
        }
        return sys;
      })
    );
  };

  const handleStartSession = (
    customerName: string,
    playersCount: 1 | 2 | 3 | 4,
    debtorId?: string,
    backdateMinutes?: number
  ) => {
    if (!startModalSysId) return;
    startSessionOnSystem(startModalSysId, customerName, playersCount, debtorId, backdateMinutes);
    setStartModalSysId(null);
  };

  const handlePauseSession = (systemId: string) => {
    const nowISO = new Date().toISOString();
    const targetSys = systems.find(s => s.id === systemId);
    if (targetSys) {
      addSystemLog(
        `توقف موقت دستی سیستم ${targetSys.name}`,
        'session_pause',
        targetSys.name,
        'توقف دستی بازی توسط کاربر'
      );
    }
    setSystems((prev) =>
      prev.map((sys) => {
        if (sys.id === systemId && sys.activeSession && !sys.activeSession.pausedTime) {
          return {
            ...sys,
            activeSession: {
              ...sys.activeSession,
              pausedTime: nowISO,
              isPowerOutagePaused: false,
              powerOutageTime: undefined,
            },
          };
        }
        return sys;
      })
    );
  };

  const handleResumeSession = (systemId: string) => {
    const now = new Date();
    setSystems((prev) =>
      prev.map((sys) => {
        if (sys.id === systemId && sys.activeSession && sys.activeSession.pausedTime) {
          const pausedAt = new Date(sys.activeSession.pausedTime);
          const msPaused = now.getTime() - pausedAt.getTime();
          return {
            ...sys,
            activeSession: {
              ...sys.activeSession,
              pausedTime: undefined,
              isPowerOutagePaused: false,
              powerOutageTime: undefined,
              totalPausedMs: sys.activeSession.totalPausedMs + msPaused,
              lastResumeTime: now.toISOString(),
            },
          };
        }
        return sys;
      })
    );
  };

  const handlePowerOutagePauseAll = () => {
    const nowISO = new Date().toISOString();
    setSystems((prev) =>
      prev.map((sys) => {
        if (sys.status === 'active' && sys.activeSession && !sys.activeSession.pausedTime) {
          return {
            ...sys,
            activeSession: {
              ...sys.activeSession,
              pausedTime: nowISO,
              isPowerOutagePaused: true,
              powerOutageTime: nowISO,
            },
          };
        }
        return sys;
      })
    );
  };

  const handleResumeAllPowerOutage = () => {
    const now = new Date();
    setSystems((prev) =>
      prev.map((sys) => {
        if (sys.status === 'active' && sys.activeSession && sys.activeSession.pausedTime && sys.activeSession.isPowerOutagePaused) {
          const pausedAt = new Date(sys.activeSession.pausedTime);
          const msPaused = now.getTime() - pausedAt.getTime();
          return {
            ...sys,
            activeSession: {
              ...sys.activeSession,
              pausedTime: undefined,
              isPowerOutagePaused: false,
              powerOutageTime: undefined,
              totalPausedMs: sys.activeSession.totalPausedMs + msPaused,
              lastResumeTime: now.toISOString(),
            },
          };
        }
        return sys;
      })
    );
    setPowerOutageNotice({ show: false, outageTimeISO: '', affectedSystems: [] });
  };

  const handleResumeAllManualPaused = () => {
    const now = new Date();
    setSystems((prev) =>
      prev.map((sys) => {
        if (sys.status === 'active' && sys.activeSession && sys.activeSession.pausedTime && !sys.activeSession.isPowerOutagePaused) {
          const pausedAt = new Date(sys.activeSession.pausedTime);
          const msPaused = now.getTime() - pausedAt.getTime();
          return {
            ...sys,
            activeSession: {
              ...sys.activeSession,
              pausedTime: undefined,
              isPowerOutagePaused: false,
              powerOutageTime: undefined,
              totalPausedMs: sys.activeSession.totalPausedMs + msPaused,
              lastResumeTime: now.toISOString(),
            },
          };
        }
        return sys;
      })
    );
  };

  const handleCancelSession = (systemId: string) => {
    const sys = systems.find((s) => s.id === systemId);
    if (!sys || !sys.activeSession) return;

    setConfirmState({
      isOpen: true,
      title: 'انصراف و لغو بدون پرداخت',
      message: `آیا واقعاً می‌خواهید جلسه بازی دستگاه "${sys.name}" را بدون ثبت فاکتور و پرداخت لغو کنید؟ تمام هزینه‌ها کسر شده و اقلام بوفه متصل شده به بازی (در صورت وجود) به انبار بوفه بازگردانده خواهند شد.`,
      onConfirm: () => {
        // Return buffet items back to stock
        if (sys.activeSession && sys.activeSession.buffetItems.length > 0) {
          const sessionBuffet = sys.activeSession.buffetItems;
          setBuffetItems((prev) =>
            prev.map((item) => {
              const matched = sessionBuffet.find((b) => b.id === item.id);
              if (matched && item.stock !== undefined) {
                return { ...item, stock: item.stock + matched.quantity };
              }
              return item;
            })
          );
        }

        // Clean up the active session and set status back to free
        setSystems((prev) =>
          prev.map((s) => {
            if (s.id === systemId) {
              return {
                ...s,
                status: 'free',
                activeSession: undefined,
              };
            }
            return s;
          })
        );

        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleTransferSession = (sourceId: string, targetId: string) => {
    const sourceSys = systems.find((s) => s.id === sourceId);
    const targetSys = systems.find((s) => s.id === targetId);
    if (!sourceSys || !sourceSys.activeSession || !targetSys) return;

    const buildTransferredSession = (sys: System): ActiveSession => {
      const sess = sys.activeSession!;
      const metrics = getSessionMetrics(sess, rates[sys.type]);
      const accumulatedGameplayCost = metrics.gamePlayCost;
      const currentElapsedMs = metrics.elapsedMs;
      const totalDurationMinutesSoFar = metrics.durationMinutes;
      const totalElapsedMsSoFar = currentElapsedMs + (sess.previousElapsedMs || 0);

      const nowISO = new Date().toISOString();

      return {
        customerName: sess.customerName,
        customerPhone: sess.customerPhone,
        startTime: nowISO,
        pausedTime: undefined,
        totalPausedMs: 0,
        lastResumeTime: nowISO,
        playersCount: sess.playersCount,
        buffetItems: sess.buffetItems,
        previousGamePlayCost: accumulatedGameplayCost,
        previousDurationMinutes: totalDurationMinutesSoFar,
        previousElapsedMs: totalElapsedMsSoFar,
        playerCountChanges: [
          { playersCount: sess.playersCount, atElapsedMs: 0 }
        ],
        customTimerLimitType: sess.customTimerLimitType,
        customTimerValue: sess.customTimerValue,
        customTimerNotified: sess.customTimerNotified
      };
    };

    const transferredSourceSession = buildTransferredSession(sourceSys);

    // Case 1: Target system is FREE
    if (targetSys.status === 'free') {
      const sourceNote = sourceSys.note || '';
      setSystems((prev) =>
        prev.map((s) => {
          if (s.id === sourceId) {
            return {
              ...s,
              status: 'free',
              activeSession: undefined,
              note: '',
            };
          }
          if (s.id === targetId) {
            return {
              ...s,
              status: 'active',
              activeSession: transferredSourceSession,
              note: sourceNote,
            };
          }
          return s;
        })
      );
    } 
    // Case 2: Target system is ACTIVE (Swap / Exchange invoices)
    else if (targetSys.status === 'active' && targetSys.activeSession) {
      const transferredTargetSession = buildTransferredSession(targetSys);
      const sourceNote = sourceSys.note || '';
      const targetNote = targetSys.note || '';

      setSystems((prev) =>
        prev.map((s) => {
          if (s.id === sourceId) {
            return {
              ...s,
              status: 'active',
              activeSession: transferredTargetSession,
              note: targetNote,
            };
          }
          if (s.id === targetId) {
            return {
              ...s,
              status: 'active',
              activeSession: transferredSourceSession,
              note: sourceNote,
            };
          }
          return s;
        })
      );
    }

    setTransferSourceSysId(null);
  };

  const handleResetSession = (systemId: string) => {
    const sys = systems.find((s) => s.id === systemId);
    if (!sys || !sys.activeSession) return;

    const session = sys.activeSession;
    const changes = session.playerCountChanges || [{ playersCount: session.playersCount, atElapsedMs: 0 }];
    const lastChange = changes[changes.length - 1];
    const lastChangeStart = lastChange ? lastChange.atElapsedMs : 0;

    // Calculate current elapsed time
    let elapsedMs = session.totalPausedMs;
    const nowMs = Date.now();
    if (session.pausedTime) {
      const pausedTimeMs = new Date(session.pausedTime).getTime();
      const startTimeMs = new Date(session.startTime).getTime();
      elapsedMs = pausedTimeMs - startTimeMs - session.totalPausedMs;
    } else {
      const startTimeMs = new Date(session.startTime).getTime();
      elapsedMs = nowMs - startTimeMs - session.totalPausedMs;
    }
    if (elapsedMs < 0) elapsedMs = 0;

    let segmentDurationMs = elapsedMs - lastChangeStart;
    if (segmentDurationMs < 0) segmentDurationMs = 0;

    const isMultiSegment = changes.length > 1;

    if (isMultiSegment) {
      setConfirmState({
        isOpen: true,
        title: 'ریست زمان بخش فعلی',
        message: `آیا واقعاً می‌خواهید زمان بخش بازی فعلی (${lastChange.playersCount} نفره) را صفر (ریست) کنید؟ زمان بازی این بخش از صفر شروع خواهد شد و بخش‌های قبلی کاملاً حفظ می‌شوند.`,
        onConfirm: () => {
          setSystems((prev) =>
            prev.map((s) => {
              if (s.id === systemId && s.activeSession) {
                return {
                  ...s,
                  activeSession: {
                    ...s.activeSession,
                    totalPausedMs: s.activeSession.totalPausedMs + segmentDurationMs,
                  },
                };
              }
              return s;
            })
          );
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      });
    } else {
      setConfirmState({
        isOpen: true,
        title: 'ریست کامل تایمر',
        message: `آیا واقعاً می‌خواهید تایمر بازی ${sys.name} را از ابتدا راه‌اندازی (ریست) کنید؟ زمان و هزینه بازی صفر می‌شود ولی اقلام بوفه کاملاً حفظ خواهند شد.`,
        onConfirm: () => {
          setSystems((prev) =>
            prev.map((s) => {
              if (s.id === systemId && s.activeSession) {
                const nowISO = new Date().toISOString();
                return {
                  ...s,
                  activeSession: {
                    ...s.activeSession,
                    startTime: nowISO,
                    pausedTime: undefined,
                    totalPausedMs: 0,
                    lastResumeTime: nowISO,
                    playerCountChanges: [{ playersCount: s.activeSession.playersCount, atElapsedMs: 0 }],
                  },
                };
              }
              return s;
            })
          );
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      });
    }
  };

  const handleDeleteSessionSegment = (systemId: string, segmentIndex: number) => {
    const sys = systems.find((s) => s.id === systemId);
    if (!sys || !sys.activeSession) return;

    const session = sys.activeSession;
    const changes = [...(session.playerCountChanges || [{ playersCount: session.playersCount, atElapsedMs: 0 }])];
    
    if (segmentIndex < 0 || segmentIndex >= changes.length) return;

    // Calculate segment duration
    let start = changes[segmentIndex].atElapsedMs;
    let elapsedMs = session.totalPausedMs;
    const nowMs = Date.now();
    if (session.pausedTime) {
      const pausedTimeMs = new Date(session.pausedTime).getTime();
      const startTimeMs = new Date(session.startTime).getTime();
      elapsedMs = pausedTimeMs - startTimeMs - session.totalPausedMs;
    } else {
      const startTimeMs = new Date(session.startTime).getTime();
      elapsedMs = nowMs - startTimeMs - session.totalPausedMs;
    }
    if (elapsedMs < 0) elapsedMs = 0;

    let end = segmentIndex < changes.length - 1 ? changes[segmentIndex + 1].atElapsedMs : elapsedMs;
    let durationMs = end - start;
    if (durationMs < 0) durationMs = 0;

    const segmentLabel = `${changes[segmentIndex].playersCount} نفره`;

    setConfirmState({
      isOpen: true,
      title: 'کسر و حذف بخش بازی',
      message: `آیا واقعاً می‌خواهید بخش بازی ${segmentLabel} را کسر و حذف کنید؟ زمان سپری‌شده در این بخش کسر خواهد شد.`,
      onConfirm: () => {
        // Update changes
        const updatedChanges = changes.filter((_, idx) => idx !== segmentIndex);
        
        // Shift subsequent elements left
        for (let i = segmentIndex; i < updatedChanges.length; i++) {
          updatedChanges[i].atElapsedMs = Math.max(0, updatedChanges[i].atElapsedMs - durationMs);
        }

        // Ensure first is always atElapsedMs: 0
        if (updatedChanges.length > 0) {
          updatedChanges[0].atElapsedMs = 0;
        } else {
          updatedChanges.push({ playersCount: session.playersCount, atElapsedMs: 0 });
        }

        const nextPlayersCount = updatedChanges[updatedChanges.length - 1].playersCount;

        setSystems((prev) =>
          prev.map((s) => {
            if (s.id === systemId && s.activeSession) {
              return {
                ...s,
                activeSession: {
                  ...s.activeSession,
                  playersCount: nextPlayersCount,
                  totalPausedMs: s.activeSession.totalPausedMs + durationMs,
                  playerCountChanges: updatedChanges,
                },
              };
            }
            return s;
          })
        );
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleChangePlayersCount = (systemId: string, playersCount: 1 | 2 | 3 | 4) => {
    setSystems((prev) =>
      prev.map((sys) => {
        if (sys.id === systemId && sys.activeSession) {
          const session = sys.activeSession;
          if (session.playersCount === playersCount) return sys;

          const nowMs = Date.now();
          let elapsedMs = session.totalPausedMs;

          if (session.pausedTime) {
            const pausedTimeMs = new Date(session.pausedTime).getTime();
            const startTimeMs = new Date(session.startTime).getTime();
            elapsedMs = pausedTimeMs - startTimeMs - session.totalPausedMs;
          } else {
            const startTimeMs = new Date(session.startTime).getTime();
            elapsedMs = nowMs - startTimeMs - session.totalPausedMs;
          }
          if (elapsedMs < 0) elapsedMs = 0;

          const existingChanges = session.playerCountChanges || [
            { playersCount: session.playersCount, atElapsedMs: 0 }
          ];

          const nextChanges = [
            ...existingChanges,
            { playersCount, atElapsedMs: elapsedMs }
          ];

          return {
            ...sys,
            activeSession: {
              ...session,
              playersCount,
              playerCountChanges: nextChanges,
            },
          };
        }
        return sys;
      })
    );
  };

  const handleUpdateCustomTimer = (
    systemId: string,
    limitType: 'none' | 'time' | 'amount',
    value?: number,
    notified?: boolean
  ) => {
    setSystems((prev) =>
      prev.map((sys) => {
        if (sys.id === systemId && sys.activeSession) {
          return {
            ...sys,
            activeSession: {
              ...sys.activeSession,
              customTimerLimitType: limitType,
              customTimerValue: value,
              customTimerNotified: notified === undefined ? sys.activeSession.customTimerNotified : notified,
            },
          };
        }
        return sys;
      })
    );
  };

  const handleAdjustSessionTime = (systemId: string, targetMinutes: number) => {
    setSystems((prev) =>
      prev.map((sys) => {
        if (sys.id === systemId && sys.activeSession) {
          const session = sys.activeSession;
          const nowMs = Date.now();
          const targetMs = targetMinutes * 60000;

          const baseTimeMs = session.pausedTime ? new Date(session.pausedTime).getTime() : nowMs;
          const newStartTimeMs = baseTimeMs - session.totalPausedMs - targetMs;
          const newStartTimeISO = new Date(newStartTimeMs).toISOString();
          
          return {
            ...sys,
            activeSession: {
              ...session,
              startTime: newStartTimeISO,
              lastResumeTime: session.lastResumeTime === session.startTime ? newStartTimeISO : session.lastResumeTime,
            }
          };
        }
        return sys;
      })
    );
  };

  const handleUpdateCustomerInfo = (systemId: string, customerName: string, customerPhone?: string) => {
    setSystems((prev) =>
      prev.map((sys) => {
        if (sys.id === systemId && sys.activeSession) {
          return {
            ...sys,
            activeSession: {
              ...sys.activeSession,
              customerName: customerName.trim() || 'مشتری عمومی',
              customerPhone: customerPhone?.trim() || undefined,
            },
          };
        }
        return sys;
      })
    );
  };

  const addBuffetToSystem = (
    systemId: string,
    itemSelections: { id: string; name: string; price: number; quantity: number }[]
  ) => {
    setSystems((prev) =>
      prev.map((sys) => {
        if (sys.id === systemId && sys.activeSession) {
          const mergedBuffet = [...sys.activeSession.buffetItems];
          
          itemSelections.forEach((sel) => {
            const index = mergedBuffet.findIndex((b) => b.id === sel.id);
            if (index > -1) {
              mergedBuffet[index] = { ...mergedBuffet[index], quantity: mergedBuffet[index].quantity + sel.quantity };
            } else {
              mergedBuffet.push({
                id: sel.id,
                name: sel.name,
                price: sel.price,
                quantity: sel.quantity,
              });
            }
          });

          return {
            ...sys,
            activeSession: {
              ...sys.activeSession,
              buffetItems: mergedBuffet,
            },
          };
        }
        return sys;
      })
    );

    // Subtract stock quantities
    setBuffetItems((prev) =>
      prev.map((item) => {
        const sold = itemSelections.find((sel) => sel.id === item.id);
        if (sold && item.stock !== undefined) {
          return { ...item, stock: Math.max(0, item.stock - sold.quantity) };
        }
        return item;
      })
    );

  };

  const handleAddBuffetToSession = (
    itemSelections: { id: string; name: string; price: number; quantity: number }[]
  ) => {
    if (!addBuffetSysId) return;
    addBuffetToSystem(addBuffetSysId, itemSelections);
    setAddBuffetSysId(null);
  };

  const handleRemoveBuffetItemFromSession = (systemId: string, itemId: string, qtyToRemove?: number) => {
    const targetSys = systems.find((s) => s.id === systemId);
    if (!targetSys || !targetSys.activeSession) return;

    const currentBuffet = targetSys.activeSession.buffetItems || [];
    const targetItem = currentBuffet.find((b) => b.id === itemId);
    if (!targetItem) return;

    const countReturned = qtyToRemove || targetItem.quantity;
    const removedItemName = targetItem.name;

    setConfirmState({
      isOpen: true,
      title: 'تأیید حذف خوراکی از بوفه',
      message: `آیا از حذف "${removedItemName}" (${countReturned} عدد) از حساب ${targetSys.name} و بازگشت آن به انبار بوفه اطمینان دارید؟`,
      onConfirm: () => {
        setSystems((prev) =>
          prev.map((sys) => {
            if (sys.id === systemId && sys.activeSession) {
              const buffetList = sys.activeSession.buffetItems || [];
              const updatedBuffet = buffetList
                .map((b) => {
                  if (b.id === itemId) {
                    const newQty = b.quantity - countReturned;
                    return newQty > 0 ? { ...b, quantity: newQty } : null;
                  }
                  return b;
                })
                .filter(Boolean) as SessionBuffetItem[];

              return {
                ...sys,
                activeSession: {
                  ...sys.activeSession,
                  buffetItems: updatedBuffet,
                },
              };
            }
            return sys;
          })
        );

        // Return stock back to inventory
        if (countReturned > 0) {
          setBuffetItems((prev) =>
            prev.map((item) => {
              if (item.id === itemId && item.stock !== undefined) {
                return { ...item, stock: item.stock + countReturned };
              }
              return item;
            })
          );

          addSystemLog(
            `حذف خوراکی بوفه (${removedItemName}) از ${targetSys.name}`,
            'buffet',
            targetSys.name,
            `تعداد: ${countReturned} عدد بازگشت داده شد به انبار`
          );
        }

        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleAddExtraServiceToSession = (
    serviceSelections: { id: string; name: string; price: number; quantity: number }[]
  ) => {
    if (!addExtraServiceSysId) return;

    setSystems((prev) =>
      prev.map((sys) => {
        if (sys.id === addExtraServiceSysId && sys.activeSession) {
          const mergedServices = [...(sys.activeSession.extraServices || [])];
          
          serviceSelections.forEach((sel) => {
            const index = mergedServices.findIndex((s) => s.id === sel.id);
            if (index > -1) {
              mergedServices[index].quantity += sel.quantity;
            } else {
              mergedServices.push({
                id: sel.id,
                name: sel.name,
                price: sel.price,
                quantity: sel.quantity,
              });
            }
          });

          return {
            ...sys,
            activeSession: {
              ...sys.activeSession,
              extraServices: mergedServices,
            },
          };
        }
        return sys;
      })
    );

    setAddExtraServiceSysId(null);
  };

  const handleRemoveExtraServiceItemFromSession = (systemId: string, itemId: string, qtyToRemove?: number) => {
    const targetSys = systems.find((s) => s.id === systemId);
    if (!targetSys || !targetSys.activeSession) return;

    const currentServices = targetSys.activeSession.extraServices || [];
    const targetItem = currentServices.find((s) => s.id === itemId);
    if (!targetItem) return;

    const countRemoved = qtyToRemove || targetItem.quantity;
    const removedItemName = targetItem.name;

    setConfirmState({
      isOpen: true,
      title: 'تأیید حذف خدمات جانبی / تجهیزات',
      message: `آیا از حذف "${removedItemName}" (${countRemoved} عدد) از حساب ${targetSys.name} اطمینان دارید؟`,
      onConfirm: () => {
        setSystems((prev) =>
          prev.map((sys) => {
            if (sys.id === systemId && sys.activeSession) {
              const servicesList = sys.activeSession.extraServices || [];
              const updatedServices = servicesList
                .map((s) => {
                  if (s.id === itemId) {
                    const newQty = s.quantity - countRemoved;
                    return newQty > 0 ? { ...s, quantity: newQty } : null;
                  }
                  return s;
                })
                .filter(Boolean) as SessionBuffetItem[];

              return {
                ...sys,
                activeSession: {
                  ...sys.activeSession,
                  extraServices: updatedServices,
                },
              };
            }
            return sys;
          })
        );

        addSystemLog(
          `حذف خدمات/امکانات جانبی (${removedItemName}) از ${targetSys.name}`,
          'system',
          targetSys.name,
          `تعداد: ${countRemoved} عدد حذف شد`
        );

        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleAddPartialPayment = (
    systemId: string,
    payment: PartialPayment,
    reducePlayerCount: boolean
  ) => {
    setSystems((prevSystems) =>
      prevSystems.map((sys) => {
        if (sys.id !== systemId || !sys.activeSession) return sys;

        const updatedPartialPayments = [
          ...(sys.activeSession.partialPayments || []),
          payment,
        ];
        return {
          ...sys,
          activeSession: {
            ...sys.activeSession,
            partialPayments: updatedPartialPayments,
          },
        };
      })
    );

    const targetSys = systems.find((s) => s.id === systemId);
    if (targetSys) {
      addSystemLog(
        `دریافت علی‌الحساب ${formatCurrency(payment.amount)} (${payment.paymentMethod === 'card' ? 'کارت‌خوان' : 'نقدی'}) از ${targetSys.name}`,
        'session_settle',
        targetSys.name,
        payment.note || 'سهم بازیکن'
      );
    }

    if (reducePlayerCount && targetSys && targetSys.activeSession && targetSys.activeSession.playersCount > 1) {
      handleChangePlayersCount(
        systemId,
        (targetSys.activeSession.playersCount - 1) as 1 | 2 | 3 | 4
      );
    }
  };

  const handleRemovePartialPayment = (systemId: string, paymentId: string) => {
    setSystems((prevSystems) =>
      prevSystems.map((sys) => {
        if (sys.id !== systemId || !sys.activeSession) return sys;
        const updatedPartialPayments = (
          sys.activeSession.partialPayments || []
        ).filter((p) => p.id !== paymentId);
        return {
          ...sys,
          activeSession: {
            ...sys.activeSession,
            partialPayments: updatedPartialPayments,
          },
        };
      })
    );
  };

  const settleSessionOnSystem = (systemId: string, params: {
    paymentMethod: 'cash' | 'card' | 'debt' | 'mixed';
    debtCustomerId?: string;
    newDebtCustomer?: { name: string; phone: string };
    totalCost: number;
    gamePlayCost: number;
    buffetCost: number;
    extraServicesCost?: number;
    extraServices?: any[];
    durationMinutes: number;
    cashPaidAmount?: number;
    cardPaidAmount?: number;
    debtAmount?: number;
    debtDetails?: { debtorId?: string; name: string; phone?: string; amount: number }[];
    cardReaderId?: string;
    cardReaderName?: string;
    notes?: string;
    roundingOffset?: number;
  }) => {
    const sys = systems.find((s) => s.id === systemId);
    if (!sys || !sys.activeSession) return;

    const session = sys.activeSession;
    let finalDebtorId = params.debtCustomerId;
    let updatedDebtors = [...debtors];
    const registeredDebtDetailLogs: { debtorId?: string; name: string; phone?: string; amount: number }[] = [];
    const totalDebtShare = (params.debtDetails || []).reduce((sum, di) => sum + di.amount, 0);
    const playMinutesShare = (amount: number) =>
      params.debtDetails && params.debtDetails.length > 1 && totalDebtShare > 0
        ? Math.round(params.durationMinutes * (amount / totalDebtShare))
        : params.durationMinutes;

    // 1. Debt registration in Ledger
    if (params.debtDetails && params.debtDetails.length > 0) {
      params.debtDetails.forEach((debtItem, idx) => {
        if (!debtItem.debtorId) {
          // Create new debtor
          const newDId = `debt-${Date.now()}-${idx}`;
          const newDebtor: DebtCustomer = {
            id: newDId,
            name: debtItem.name,
            phone: debtItem.phone || '',
            balance: debtItem.amount,
            transactions: [
              {
                id: `tx-${Date.now()}-${idx}`,
                type: 'debt_added',
                amount: debtItem.amount,
                date: new Date().toISOString(),
                description: `سهم بدهی سیستم بازی ${sys.name} (مدت: ${params.durationMinutes} دقیقه)`,
                playMinutes: playMinutesShare(debtItem.amount),
              },
            ],
          };
          updatedDebtors.push(newDebtor);
          registeredDebtDetailLogs.push({
            debtorId: newDId,
            name: debtItem.name,
            phone: debtItem.phone,
            amount: debtItem.amount,
          });
          if (idx === 0) finalDebtorId = newDId; // fallback field
        } else {
          // Add to existing debtor
          updatedDebtors = updatedDebtors.map((d) => {
            if (d.id === debtItem.debtorId) {
              return {
                ...d,
                balance: d.balance + debtItem.amount,
                transactions: [
                  {
                    id: `tx-${Date.now()}-${idx}`,
                    type: 'debt_added',
                    amount: debtItem.amount,
                    date: new Date().toISOString(),
                    description: `سهم بدهی سیستم بازی ${sys.name} (مدت: ${params.durationMinutes} دقیقه)`,
                    playMinutes: playMinutesShare(debtItem.amount),
                  },
                  ...d.transactions,
                ],
              };
            }
            return d;
          });
          registeredDebtDetailLogs.push({
            debtorId: debtItem.debtorId,
            name: debtItem.name,
            phone: debtItem.phone,
            amount: debtItem.amount,
          });
        }
      });
      setDebtors(updatedDebtors);
    } else if (params.paymentMethod === 'debt') {
      // Fallback fallback if debtDetails is somehow empty but payment is debt
      if (params.newDebtCustomer) {
        const newDId = `debt-${Date.now()}`;
        finalDebtorId = newDId;
        const newDebtor: DebtCustomer = {
          id: newDId,
          name: params.newDebtCustomer.name,
          phone: params.newDebtCustomer.phone,
          balance: params.totalCost,
          transactions: [
            {
              id: `tx-${Date.now()}`,
              type: 'debt_added',
              amount: params.totalCost,
              date: new Date().toISOString(),
              description: `حساب دفتری سیستم بازی ${sys.name}`,
              playMinutes: params.durationMinutes,
            },
          ],
        };
        setDebtors((prev) => [...prev, newDebtor]);
      } else if (params.debtCustomerId) {
        setDebtors((prev) =>
          prev.map((d) => {
            if (d.id === params.debtCustomerId) {
              return {
                ...d,
                balance: d.balance + params.totalCost,
                transactions: [
                  {
                    id: `tx-${Date.now()}`,
                    type: 'debt_added',
                    amount: params.totalCost,
                    date: new Date().toISOString(),
                    description: `حساب دفتری سیستم بازی ${sys.name}`,
                    playMinutes: params.durationMinutes,
                  },
                  ...d.transactions,
                ],
              };
            }
            return d;
          })
        );
      }
    }

    // 2. Add record log to completed gameplay logs
    const partialPayments = session.partialPayments || [];
    const partialCash = partialPayments.filter(p => p.paymentMethod === 'cash').reduce((sum, p) => sum + p.amount, 0);
    const partialCard = partialPayments.filter(p => p.paymentMethod === 'card').reduce((sum, p) => sum + p.amount, 0);

    const totalCashPaid = (params.cashPaidAmount || 0) + partialCash;
    const totalCardPaid = (params.cardPaidAmount || 0) + partialCard;

    const historyItem: SessionHistory = {
      id: `hist-${Date.now()}`,
      systemId: sys.id,
      systemName: sys.name,
      systemType: sys.type,
      customerName: session.customerName,
      customerPhone: session.customerPhone,
      startTime: session.startTime,
      endTime: new Date().toISOString(),
      durationMinutes: params.durationMinutes,
      playersCount: session.playersCount,
      hourlyRateUsed: rates[sys.type][`hourlyRate${session.playersCount}P` as keyof RateConfig] || rates[sys.type].hourlyRate1P,
      gamePlayCost: params.gamePlayCost,
      buffetCost: params.buffetCost,
      buffetItems: session.buffetItems && session.buffetItems.length > 0 ? session.buffetItems : undefined,
      extraServicesCost: params.extraServicesCost,
      extraServices: params.extraServices,
      totalCost: params.totalCost,
      paymentMethod: params.paymentMethod,
      debtCustomerId: finalDebtorId,
      cashPaidAmount: totalCashPaid > 0 ? totalCashPaid : undefined,
      cardPaidAmount: totalCardPaid > 0 ? totalCardPaid : undefined,
      debtAmount: params.debtAmount,
      debtDetails: registeredDebtDetailLogs.length > 0 ? registeredDebtDetailLogs : undefined,
      cardReaderId: params.cardReaderId,
      cardReaderName: params.cardReaderName,
      partialPayments: partialPayments.length > 0 ? partialPayments : undefined,
      notes: params.notes || sys.note || undefined,
      roundingOffset: params.roundingOffset,
    };

    setHistory((prev) => [historyItem, ...prev]);

    addSystemLog(
      `تسویه حساب نهایی ${sys.name} - مبلغ: ${formatCurrency(params.totalCost)} (مدت: ${params.durationMinutes} دقیقه)`,
      'session_settle',
      sys.name,
      `کد فاکتور: INV-${sys.name.replace(/\s+/g, '')}-${historyItem.id.slice(-4)} | بازی: ${formatCurrency(params.gamePlayCost)} | بوفه: ${formatCurrency(params.buffetCost)}${session.customerName ? ` | مشتری: ${session.customerName}` : ''}`
    );

    // 3. Reset and clear active system status
    setSystems((prev) =>
      prev.map((s) => {
        if (s.id === systemId) {
          return {
            ...s,
            status: 'free',
            activeSession: undefined,
            note: '',
          };
        }
        return s;
      })
    );

  };

  const handleSettleSessionInvoice = (params: Parameters<typeof settleSessionOnSystem>[1]) => {
    if (!settleModalSysId) return;
    settleSessionOnSystem(settleModalSysId, params);
    setSettleModalSysId(null);
  };

  const handleSettleGroupInvoice = (params: {
    systemIds: string[];
    paymentMethod: 'cash' | 'card' | 'debt' | 'mixed';
    debtCustomerId?: string;
    newDebtCustomer?: { name: string; phone: string };
    totalCost: number;
    cashPaidAmount?: number;
    cardPaidAmount?: number;
    debtAmount?: number;
    debtDetails?: { debtorId?: string; name: string; phone?: string; amount: number }[];
    groupCustomerName?: string;
    cardReaderId?: string;
    cardReaderName?: string;
  }) => {
    if (params.systemIds.length === 0) return;

    // First, let's gather all calculations for each system
    const systemSessions = params.systemIds.map((id) => {
      const s = systems.find((sys) => sys.id === id);
      if (!s || !s.activeSession) return null;
      const metrics = getSessionMetrics(s.activeSession, rates[s.type]);
      return {
        system: s,
        session: s.activeSession,
        metrics,
      };
    }).filter(Boolean) as Array<{
      system: System;
      session: any;
      metrics: any;
    }>;

    if (systemSessions.length === 0) return;

    const groupSumRaw = systemSessions.reduce((sum, item) => sum + item.metrics.totalCost, 0);
    // If we have rounding offset or minor adjustments, ratio works splendidly
    const actualSubmitedCost = params.totalCost;
    const groupDurationMinutes = systemSessions.reduce((sum, item) => sum + (item.metrics.durationMinutes || 0), 0);
    const groupTotalDebtShare = (params.debtDetails || []).reduce((sum, di) => sum + di.amount, 0);
    const groupPlayMinutesShare = (amount: number) =>
      params.debtDetails && params.debtDetails.length > 1 && groupTotalDebtShare > 0
        ? Math.round(groupDurationMinutes * (amount / groupTotalDebtShare))
        : groupDurationMinutes;


    // Proportional ratios allocation
    const newHistoryItems: SessionHistory[] = [];
    let updatedDebtors = [...debtors];

    // Handle ledger debts additions if any
    const registeredDebtDetailLogs: { debtorId?: string; name: string; phone?: string; amount: number }[] = [];

    if (params.debtDetails && params.debtDetails.length > 0) {
      params.debtDetails.forEach((debtItem, idx) => {
        if (!debtItem.debtorId) {
          // Create new debtor
          const newDId = `debt-${Date.now()}-${idx}`;
          const newDebtor: DebtCustomer = {
            id: newDId,
            name: debtItem.name,
            phone: debtItem.phone || '',
            balance: debtItem.amount,
            transactions: [
              {
                id: `tx-${Date.now()}-${idx}`,
                type: 'debt_added',
                amount: debtItem.amount,
                date: new Date().toISOString(),
                description: `سهم بدهی فاکتور گروهی دستگاه‌ها (مبلغ کل: ${actualSubmitedCost.toLocaleString()})`,
                playMinutes: groupPlayMinutesShare(debtItem.amount),
              },
            ],
          };
          updatedDebtors.push(newDebtor);
          registeredDebtDetailLogs.push({
            debtorId: newDId,
            name: debtItem.name,
            phone: debtItem.phone,
            amount: debtItem.amount,
          });
        } else {
          // Add to existing debtor
          updatedDebtors = updatedDebtors.map((d) => {
            if (d.id === debtItem.debtorId) {
              return {
                ...d,
                balance: d.balance + debtItem.amount,
                transactions: [
                  {
                    id: `tx-${Date.now()}-${idx}`,
                    type: 'debt_added',
                    amount: debtItem.amount,
                    date: new Date().toISOString(),
                    description: `سهم بدهی فاکتور گروهی دستگاه‌ها (مجموع: ${actualSubmitedCost.toLocaleString()})`,
                    playMinutes: groupPlayMinutesShare(debtItem.amount),
                  },
                  ...d.transactions,
                ],
              };
            }
            return d;
          });
          registeredDebtDetailLogs.push({
            debtorId: debtItem.debtorId,
            name: debtItem.name,
            phone: debtItem.phone,
            amount: debtItem.amount,
          });
        }
      });
      setDebtors(updatedDebtors);
    }

    // Now, create individual history records for each of the group's systems
    systemSessions.forEach((item, index) => {
      const sys = item.system;
      const session = item.session;
      const m = item.metrics;

      // Ratio of this device to overall calculated total
      const ratio = groupSumRaw > 0 ? (m.totalCost / groupSumRaw) : (1 / systemSessions.length);

      // Distribute paid amounts proportionally
      const cashAlloc = params.cashPaidAmount ? Math.round(params.cashPaidAmount * ratio) : undefined;
      const cardAlloc = params.cardPaidAmount ? Math.round(params.cardPaidAmount * ratio) : undefined;
      const debtAlloc = params.debtAmount ? Math.round(params.debtAmount * ratio) : undefined;
      const roundedTotalItemCost = Math.round(actualSubmitedCost * ratio);

      // Build intermediate logs for this individual history record
      // We attribute proportionate debtDetails if they exists
      let itemDebtDetails: { debtorId?: string; name: string; phone?: string; amount: number }[] | undefined = undefined;
      if (registeredDebtDetailLogs.length > 0) {
        itemDebtDetails = registeredDebtDetailLogs.map((rd) => ({
          ...rd,
          amount: Math.round(rd.amount * ratio),
        }));
      }

      const historyItem: SessionHistory = {
        id: `hist-${Date.now()}-${index}`,
        systemId: sys.id,
        systemName: sys.name,
        systemType: sys.type,
        customerName: params.groupCustomerName || session.customerName,
        startTime: session.startTime,
        endTime: new Date().toISOString(),
        durationMinutes: m.durationMinutes,
        playersCount: session.playersCount,
        hourlyRateUsed: rates[sys.type][`hourlyRate${session.playersCount}P` as keyof RateConfig] || rates[sys.type].hourlyRate1P,
        gamePlayCost: m.gamePlayCost,
        buffetCost: m.buffetCost,
        totalCost: roundedTotalItemCost,
        paymentMethod: params.paymentMethod,
        cashPaidAmount: cashAlloc,
        cardPaidAmount: cardAlloc,
        debtAmount: debtAlloc,
        debtDetails: itemDebtDetails,
        cardReaderId: params.cardReaderId,
        cardReaderName: params.cardReaderName,
        notes: sys.note || undefined,
      };

      newHistoryItems.push(historyItem);
    });

    // Record the newly created histories
    setHistory((prev) => [...newHistoryItems, ...prev]);

    // Reset all group systems to 'free'
    setSystems((prev) =>
      prev.map((s) => {
        if (params.systemIds.includes(s.id)) {
          return {
            ...s,
            status: 'free',
            activeSession: undefined,
            note: '',
          };
        }
        return s;
      })
    );

    // Empty group selection and close the modal!
    setSelectedGroupSystemIds([]);
    setShowGroupSettleModal(false);
  };

  const handleOpenGroupSettleModal = () => {
    const nowISO = new Date().toISOString();
    setSystems((prev) =>
      prev.map((sys) => {
        if (
          selectedGroupSystemIds.includes(sys.id) &&
          sys.activeSession &&
          !sys.activeSession.pausedTime
        ) {
          return {
            ...sys,
            activeSession: {
              ...sys.activeSession,
              pausedTime: nowISO,
              autoPausedForSettle: true,
            },
          };
        }
        return sys;
      })
    );
    setShowGroupSettleModal(true);
    setShowGroupSelectDropdown(false);
  };

  const handleCloseGroupSettleModal = () => {
    const now = new Date();
    setSystems((prev) =>
      prev.map((sys) => {
        if (
          selectedGroupSystemIds.includes(sys.id) &&
          sys.activeSession &&
          sys.activeSession.pausedTime &&
          sys.activeSession.autoPausedForSettle
        ) {
          const pausedAt = new Date(sys.activeSession.pausedTime);
          const msPaused = now.getTime() - pausedAt.getTime();
          return {
            ...sys,
            activeSession: {
              ...sys.activeSession,
              pausedTime: undefined,
              autoPausedForSettle: undefined,
              totalPausedMs: sys.activeSession.totalPausedMs + msPaused,
              lastResumeTime: now.toISOString(),
            },
          };
        }
        return sys;
      })
    );
    setShowGroupSettleModal(false);
    setSelectedGroupSystemIds([]);
  };

  const handleToggleDeviceStatus = (systemId: string, nextStatus: 'free' | 'inactive') => {
    setSystems((prev) =>
      prev.map((s) => {
        if (s.id === systemId) {
          return { ...s, status: nextStatus };
        }
        return s;
      })
    );
  };

  const handleUpdateSystemNote = (systemId: string, note: string) => {
    setSystems((prev) =>
      prev.map((s) => {
        if (s.id === systemId) {
          return { ...s, note };
        }
        return s;
      })
    );
  };

  // HANDLERS: Buffet management
  const handleAddBuffetItem = (name: string, price: number, cost?: number, stock?: number, category?: 'fridge' | 'cafe' | 'snack', priority?: number) => {
    const newItem: BuffetItem = {
      id: `b-${Date.now()}`,
      name,
      price,
      cost,
      stock,
      category,
      priority: priority || 0,
    };
    setBuffetItems((prev) => [...prev, newItem]);
  };

  const handleRecordDirectSale = (
    items: { id: string; name: string; price: number; quantity: number }[],
    customerName: string
  ) => {
    const nextSale: DirectBuffetSale = {
      id: `sale-${Date.now()}`,
      date: new Date().toISOString(),
      customerName,
      totalCost: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      items,
    };

    setDirectSales((prev) => [nextSale, ...prev]);

    // Subtract stock quantities
    setBuffetItems((prev) =>
      prev.map((shelf) => {
        const matched = items.find((sold) => sold.id === shelf.id);
        if (matched && shelf.stock !== undefined) {
          return { ...shelf, stock: Math.max(0, shelf.stock - matched.quantity) };
        }
        return shelf;
      })
    );
  };

  const handleRecordDetailedBuffetSale = (
    items: { id: string; name: string; price: number; quantity: number }[],
    customerName: string,
    paymentMethod: 'cash' | 'card' | 'debt' | 'mixed',
    debtCustomerId?: string,
    cashPaidAmount?: number,
    cardPaidAmount?: number,
    debtAmount?: number,
    cardReaderId?: string,
    cardReaderName?: string
  ) => {
    const totalCost = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const saleId = `sale-${Date.now()}`;
    const dateISO = new Date().toISOString();

    const nextSale: DirectBuffetSale = {
      id: saleId,
      date: dateISO,
      customerName,
      totalCost,
      items,
      paymentMethod,
      debtCustomerId,
      cashPaidAmount,
      cardPaidAmount,
      debtAmount,
      cardReaderId,
      cardReaderName,
    };

    setDirectSales((prev) => [nextSale, ...prev]);

    // 1. Subtract stock quantities
    setBuffetItems((prev) =>
      prev.map((shelf) => {
        const matched = items.find((sold) => sold.id === shelf.id);
        if (matched && shelf.stock !== undefined) {
          return { ...shelf, stock: Math.max(0, shelf.stock - matched.quantity) };
        }
        return shelf;
      })
    );

    // 2. Add to Debt Ledger if there is a debt component
    if (debtCustomerId && debtAmount && debtAmount > 0) {
      setDebtors((prev) =>
        prev.map((d) => {
          if (d.id === debtCustomerId) {
            const nextBalance = d.balance + debtAmount;
            const itemsListText = items.map((it) => `${it.name} (${it.quantity}عدد)`).join('، ');
            const description = `خرید بوفه (مستقیم): ${itemsListText}`;

            return {
              ...d,
              balance: nextBalance,
              transactions: [
                {
                  id: `ledger-tx-${Date.now()}`,
                  type: 'debt_added',
                  amount: debtAmount,
                  date: dateISO,
                  description,
                },
                ...d.transactions,
              ],
            };
          }
          return d;
        })
      );
    }

    addSystemLog(
      `فروش مستقیم بوفه - مبلغ: ${formatCurrency(totalCost)}${customerName ? ` (${customerName})` : ''}`,
      'buffet',
      'بوفه',
      `اقلام: ${items.map(it => `${it.name} × ${it.quantity}`).join('، ')} | پرداخت: ${paymentMethod === 'cash' ? 'نقدی' : paymentMethod === 'card' ? 'کارتخوان' : paymentMethod === 'debt' ? 'نسیه' : 'ترکیبی'}`
    );
  };

  const handleDeleteBuffetItem = (id: string) => {
    setBuffetItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateBuffetItemPriority = (id: string, newPriority: number) => {
    setBuffetItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, priority: newPriority } : item))
    );
  };

  const handleUpdateBuffetItem = (id: string, updates: Partial<BuffetItem>) => {
    setBuffetItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  // HANDLERS: Debt Ledger transactions
  const handleAddDebtor = (name: string, phone: string, totalPlayTimeMinutes?: number) => {
    if (userRole !== 'admin' && !userPermissions.debt) {
      alert('ایجاد پرونده مشتری در دفتر نسیه غیرفعال است. لطفاً ابتدا دسترسی «دفتر نسیه» را از بخش تنظیمات فعال کنید.');
      return;
    }
    const newDebtor: DebtCustomer = {
      id: `debt-${Date.now()}`,
      name,
      phone,
      balance: 0,
      totalPlayTimeMinutes: totalPlayTimeMinutes || 0,
      transactions: [],
    };
    setDebtors((prev) => [...prev, newDebtor]);
  };

  const handleDeleteDebtor = (debtorId: string) => {
    setDebtors((prev) => prev.filter((d) => d.id !== debtorId));
  };

  const handleUpdateDebtor = (debtorId: string, name: string, phone: string, totalPlayTimeMinutes?: number) => {
    setDebtors((prev) =>
      prev.map((d) => (d.id === debtorId ? { 
        ...d, 
        name: name.trim(), 
        phone: phone.trim(),
        totalPlayTimeMinutes: totalPlayTimeMinutes !== undefined ? totalPlayTimeMinutes : d.totalPlayTimeMinutes
      } : d))
    );
  };

  const handleRecordLedgerTransaction = (
    debtorId: string,
    type: 'debt_added' | 'payment_made',
    amount: number,
    description: string
  ) => {
    if (userRole !== 'admin' && !userPermissions.debt) {
      alert('ثبت تراکنش در دفتر نسیه غیرفعال است. لطفاً ابتدا دسترسی «دفتر نسیه» را از بخش تنظیمات فعال کنید.');
      return;
    }
    recordLedgerCore(debtorId, type, amount, description);
  };

  const recordLedgerCore = (
    debtorId: string,
    type: 'debt_added' | 'payment_made',
    amount: number,
    description: string
  ) => {
    setDebtors((prev) =>
      prev.map((d) => {
        if (d.id === debtorId) {
          const multiplier = type === 'payment_made' ? -1 : 1;
          const nextBalance = d.balance + amount * multiplier;
          return {
            ...d,
            balance: nextBalance,
            transactions: [
              {
                id: `ledger-tx-${Date.now()}`,
                type,
                amount,
                date: new Date().toISOString(),
                description,
              },
              ...d.transactions,
            ],
          };
        }
        return d;
      })
    );
  };

  // HANDLERS: Settings & config
  const handleSaveRates = (nextRates: RatesTable) => {
    setRates(nextRates);
  };

  const handleAddCardReader = (name: string) => {
    const newReader: CardReader = {
      id: `pos-${Date.now()}`,
      name: name.trim(),
    };
    setCardReaders((prev) => [...prev, newReader]);
  };

  const handleRemoveCardReader = (id: string) => {
    setCardReaders((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddSystemToCenter = (name: string, type: SystemType) => {
    // Auto-initialize rate config if it doesn't exist for the type
    if (!rates[type]) {
      const defaultRateConfig: RateConfig = {
        hourlyRate1P: 45000,
        hourlyRate2P: 60000,
        hourlyRate3P: 75000,
        hourlyRate4P: 90000,
      };
      setRates((prev) => ({
        ...prev,
        [type]: defaultRateConfig,
      }));
    }

    const newSys: System = {
      id: `sys-${Date.now()}`,
      name,
      type,
      status: 'free',
    };
    setSystems((prev) => [...prev, newSys]);
  };

  const handleRemoveSystemNode = (systemId: string) => {
    setSystems((prev) => prev.filter((s) => s.id !== systemId));
  };

  const handleResetFactoryDefaults = () => {
    localStorage.clear();
    setRates(DEFAULT_RATES);
    setSystems(DEFAULT_SYSTEMS);
    setBuffetItems(DEFAULT_BUFFET);
    setDebtors(DEFAULT_DEBTORS);
    setHistory(DEFAULT_HISTORY);
    setDirectSales([]);
    setDailyBackups([]);
    setActiveTab('dashboard');
  };

  const handleConfirmCloseDay = (notes: string, targetDatePersian?: string) => {
    const totalGameplayRevenue = history.reduce((sum, h) => sum + h.gamePlayCost, 0);
    const totalSessionBuffetCost = history.reduce((sum, h) => sum + h.buffetCost, 0);
    const totalDirectBuffetSales = directSales.reduce((sum, s) => sum + s.totalCost, 0);
    const totalGrossRevenue = totalGameplayRevenue + totalSessionBuffetCost + totalDirectBuffetSales;
    
    const paidCardAmount = history.reduce((sum, h) => {
      if (h.paymentMethod === 'card') return sum + h.totalCost;
      if (h.paymentMethod === 'mixed' && h.cardPaidAmount) return sum + h.cardPaidAmount;
      return sum;
    }, 0) + directSales.reduce((sum, s) => {
      const pm = s.paymentMethod || 'cash';
      if (pm === 'card') return sum + s.totalCost;
      if (pm === 'mixed' && s.cardPaidAmount) return sum + s.cardPaidAmount;
      return sum;
    }, 0);

    const paidCashAmount = history.reduce((sum, h) => {
      if (h.paymentMethod === 'cash') return sum + h.totalCost;
      if (h.paymentMethod === 'mixed' && h.cashPaidAmount) return sum + h.cashPaidAmount;
      return sum;
    }, 0) + directSales.reduce((sum, s) => {
      const pm = s.paymentMethod || 'cash';
      if (pm === 'cash') return sum + s.totalCost;
      if (pm === 'mixed' && s.cashPaidAmount) return sum + s.cashPaidAmount;
      return sum;
    }, 0);

    const debtAccumulatedAmount = history.reduce((sum, h) => {
      if (h.paymentMethod === 'debt') return sum + h.totalCost;
      if (h.paymentMethod === 'mixed' && h.debtAmount) return sum + h.debtAmount;
      return sum;
    }, 0) + directSales.reduce((sum, s) => {
      const pm = s.paymentMethod || 'cash';
      if (pm === 'debt') return sum + s.totalCost;
      if (pm === 'mixed' && s.debtAmount) return sum + s.debtAmount;
      return sum;
    }, 0);

    const workingDatePersian = targetDatePersian || new Date().toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const backup: DailyWorkingDayBackup = {
      id: `day-backup-${Date.now()}`,
      dateISO: new Date().toISOString(),
      workingDatePersian,
      closedAt: new Date().toISOString(),
      notes,
      closedBy: userRole,
      totalGameplayRevenue,
      totalSessionBuffetCost,
      totalDirectBuffetSales,
      totalGrossRevenue,
      paidCardAmount,
      paidCashAmount,
      debtAccumulatedAmount,
      history: [...history],
      directSales: [...directSales],
      systemLogs: [...systemLogs]
    };

    const updatedDailyBackups = [backup, ...dailyBackups];

    // Build complete database payload and download .db file directly so local memory stays light
    const dbPayload = {
      gamenet_backup_version: 1,
      exportedAt: new Date().toISOString(),
      workingDateClosed: workingDatePersian,
      rates,
      systems,
      buffetItems,
      debtors,
      history,
      directSales,
      systemLogs,
      dailyBackups: updatedDailyBackups,
      cardReaders,
      alarmIntervalSeconds,
      layoutMode,
      adminPassword,
      adminUsername,
      operators,
      requireOperatorLogin,
      extraServicePresets,
      appName,
      appLogo,
      userPermissions,
      telegramConfig
    };

    downloadDatabaseBackupPayload(dbPayload, `gamenet_day_${workingDatePersian.replace(/\//g, '-')}`);

    setDailyBackups(updatedDailyBackups);
    setHistory([]);
    setDirectSales([]);
    setSystemLogs([]);
    addSystemLog(`پایان روز کاری ${workingDatePersian} و تهیه موفق فایل دیتابیس پشتیبان (.db)`, 'system');

    // Automatically send daily financial summary via Telegram Bot if enabled
    if (telegramConfig.enabled && telegramConfig.botToken && telegramConfig.chatId) {
      const telegramMessage = formatDailyFinancialTelegramReport(backup, appName || 'کلوب و گیم‌نت');
      sendTelegramMessage(telegramConfig.botToken, telegramConfig.chatId, telegramMessage, telegramConfig.apiEndpoint)
        .then((res) => {
          if (res.success) {
            addSystemLog(`گزارش مالی روز کاری ${workingDatePersian} با موفقیت به بات تلگرام ارسال شد.`, 'system');
          } else {
            addSystemLog(`خطا در ارسال گزارش به بات تلگرام: ${res.error}`, 'system');
          }
        })
        .catch((err) => {
          addSystemLog(`خطا در ارتباط با سرور تلگرام: ${err?.message || err}`, 'system');
        });
    }
  };

  const handleDeleteBackup = (id: string) => {
    setDailyBackups((prev) => prev.filter((b) => b.id !== id));
  };

  const handleRestoreBackupToCurrent = (backup: DailyWorkingDayBackup) => {
    setHistory([...backup.history]);
    setDirectSales([...backup.directSales]);
    if (backup.systemLogs && backup.systemLogs.length > 0) {
      setSystemLogs([...backup.systemLogs]);
    }
    addSystemLog(`بازنشانی اطلاعات روز کاری ${backup.workingDatePersian} به صندوق و گزارشات زنده سیستم`, 'system');
  };

  const handleImportFullDatabase = (backupData: any) => {
    if (backupData.rates) setRates(backupData.rates);
    if (backupData.systems) setSystems(backupData.systems);
    if (backupData.buffetItems) setBuffetItems(backupData.buffetItems);
    if (backupData.debtors) setDebtors(backupData.debtors);
    if (backupData.history) setHistory(backupData.history);
    if (backupData.directSales) setDirectSales(backupData.directSales);
    if (backupData.systemLogs) setSystemLogs(backupData.systemLogs);
    if (backupData.dailyBackups) setDailyBackups(backupData.dailyBackups);
    if (backupData.cardReaders) setCardReaders(backupData.cardReaders);
    if (backupData.alarmIntervalSeconds !== undefined) setAlarmIntervalSeconds(backupData.alarmIntervalSeconds);
    if (backupData.layoutMode) setLayoutMode(backupData.layoutMode);
    if (backupData.adminPassword !== undefined) setAdminPassword(backupData.adminPassword);
    if (backupData.adminUsername !== undefined) setAdminUsername(backupData.adminUsername);
    if (backupData.operators) handleSaveOperators(backupData.operators);
    if (backupData.requireOperatorLogin !== undefined) setRequireOperatorLogin(backupData.requireOperatorLogin);
    if (backupData.extraServicePresets) setExtraServicePresets(backupData.extraServicePresets);
    if (backupData.appName) setAppName(backupData.appName);
    if (backupData.appLogo !== undefined) setAppLogo(backupData.appLogo);
    if (backupData.userPermissions) setUserPermissions(backupData.userPermissions);
    if (backupData.telegramConfig) setTelegramConfig(backupData.telegramConfig);
  };

  // Stats Calculations for Quick Overview Dashboard Header
  const countActiveSystems = systems.filter((s) => s.status === 'active').length;
  const countFreeSystems = systems.filter((s) => s.status === 'free').length;
  // ===== Remote (گوشی) =====
  // دسترسی گوشی با جفت‌سازی دستگاه کنترل می‌شود، نه نقش اپراتور فعلی روی PC
  // قیمت‌ها همیشه از منوی بوفه/نرخ‌های خود برنامه خوانده می‌شود، نه از گوشی.
  const remoteResolveItems = (list: { id: string; quantity: number }[]) => {
    const items: { id: string; name: string; price: number; quantity: number }[] = [];
    for (const it of list) {
      const b = buffetItems.find((x) => x.id === it.id);
      if (!b) return { error: 'آیتم بوفه پیدا نشد', items };
      if (b.stock !== undefined && b.stock < it.quantity) return { error: `موجودی «${b.name}» کافی نیست`, items };
      items.push({ id: b.id, name: b.name, price: b.price, quantity: it.quantity });
    }
    return { error: null as string | null, items };
  };

  useRemoteBridge({ systems, debtors, buffetItems, cardReaders, rates, presetTimerMinutes, alarmIntervalSeconds }, {
    timer: (systemId, limitType, value, device) => {
      const sys = systems.find((s) => s.id === systemId);
      if (!sys?.activeSession) return 'نشست فعالی وجود ندارد';
      handleUpdateCustomTimer(systemId, limitType, limitType === 'none' ? undefined : value, false);
      const label = limitType === 'none' ? 'خاموش' : limitType === 'time' ? `${value} دقیقه` : `${(value || 0).toLocaleString('fa-IR')} تومان`;
      addSystemLog(`تایمر دلخواه از موبایل: ${label} (${device})`, 'system', sys.name);
      return { message: limitType === 'none' ? 'تایمر خاموش شد' : 'تایمر تنظیم شد' };
    },
    start: (systemId, customerName, playersCount, device) => {
      const sys = systems.find((s) => s.id === systemId);
      if (!sys) return 'سیستم پیدا نشد';
      if (sys.status !== 'free') return 'این سیستم آزاد نیست';
      startSessionOnSystem(systemId, customerName, playersCount);
      addSystemLog(`ثبت از موبایل (${device})`, 'system', sys.name);
      return null;
    },
    pause: (systemId, device) => {
      const sys = systems.find((s) => s.id === systemId);
      if (!sys?.activeSession) return 'نشست فعالی وجود ندارد';
      if (sys.activeSession.pausedTime) return 'سیستم از قبل متوقف است';
      handlePauseSession(systemId);
      addSystemLog(`توقف از موبایل (${device})`, 'session_pause', sys.name);
      return null;
    },
    resume: (systemId, device) => {
      const sys = systems.find((s) => s.id === systemId);
      if (!sys?.activeSession) return 'نشست فعالی وجود ندارد';
      if (!sys.activeSession.pausedTime) return 'سیستم متوقف نیست';
      handleResumeSession(systemId);
      addSystemLog(`ادامه از موبایل (${device})`, 'session_resume', sys.name);
      return null;
    },
    ledger: (debtorId, kind, amount, description, device) => {
      const d = debtors.find((x) => x.id === debtorId);
      if (!d) return 'مشتری پیدا نشد';
      if (kind === 'payment_made' && amount > d.balance) return 'مبلغ پرداخت بیشتر از بدهی است';
      const note = `${description ? description + ' — ' : ''}ثبت از موبایل (${device})`;
      recordLedgerCore(debtorId, kind, amount, note);
      addSystemLog(
        `${kind === 'debt_added' ? 'ثبت بدهی' : 'ثبت پرداخت'} ${amount.toLocaleString('fa-IR')} برای ${d.name} از موبایل`,
        'debt',
        undefined,
        `دستگاه: ${device}`
      );
      return null;
    },
    players: (systemId, playersCount, device) => {
      const sys = systems.find((s) => s.id === systemId);
      if (!sys?.activeSession) return 'نشست فعالی وجود ندارد';
      if (sys.activeSession.playersCount === playersCount) return null;
      handleChangePlayersCount(systemId, playersCount);
      addSystemLog(`تغییر تعداد دسته به ${playersCount} از موبایل (${device})`, 'system', sys.name);
      return null;
    },
    adjustTime: (systemId, minutes, device) => {
      const sys = systems.find((s) => s.id === systemId);
      if (!sys?.activeSession) return 'نشست فعالی وجود ندارد';
      handleAdjustSessionTime(systemId, minutes);
      addSystemLog(`ویرایش زمان بازی به ${minutes} دقیقه از موبایل (${device})`, 'system', sys.name);
      return null;
    },
    transfer: (sourceId, targetId, device) => {
      const src = systems.find((s) => s.id === sourceId);
      const tgt = systems.find((s) => s.id === targetId);
      if (!src?.activeSession) return 'نشست فعالی روی سیستم مبدأ نیست';
      if (!tgt) return 'سیستم مقصد پیدا نشد';
      if (tgt.status === 'inactive') return 'سیستم مقصد غیرفعال است';
      handleTransferSession(sourceId, targetId);
      addSystemLog(
        `${tgt.status === 'free' ? 'انتقال' : 'جابجایی'} ${src.name} به ${tgt.name} از موبایل (${device})`,
        'system',
        src.name
      );
      return null;
    },
    addBuffet: (systemId, list, device) => {
      const sys = systems.find((s) => s.id === systemId);
      if (!sys?.activeSession) return 'نشست فعالی وجود ندارد';
      const r = remoteResolveItems(list);
      if (r.error) return r.error;
      addBuffetToSystem(systemId, r.items);
      addSystemLog(
        `افزودن بوفه از موبایل (${device}): ${r.items.map((i) => `${i.name}×${i.quantity}`).join('، ')}`,
        'buffet',
        sys.name
      );
      return null;
    },
    settle: (systemId, opts, device) => {
      const sys = systems.find((s) => s.id === systemId);
      if (!sys?.activeSession) return 'نشست فعالی وجود ندارد';
      const sysRates = rates[sys.type];
      if (!sysRates) return 'نرخ این سیستم تعریف نشده';
      const session = sys.activeSession;
      const m = getSessionMetrics(session, sysRates);
      const roundingOffset = opts.round ? Math.round(m.totalCost / 1000) * 1000 - m.totalCost : 0;
      const finalTotal = Math.max(0, m.totalCost + roundingOffset);
      const partialPaid = (session.partialPayments || []).reduce((acc, p) => acc + p.amount, 0);
      const net = Math.max(0, finalTotal - partialPaid);

      let reader: CardReader | undefined;
      if (opts.method === 'card' && cardReaders.length > 0) {
        reader = cardReaders.find((r) => r.id === opts.cardReaderId);
        if (!reader) return 'کارتخوان را انتخاب کنید';
      }
      let debtDetails: { debtorId: string; name: string; phone?: string; amount: number }[] | undefined;
      if (opts.method === 'debt') {
        const d = debtors.find((x) => x.id === opts.debtorId);
        if (!d) return 'مشتری بدهکار را انتخاب کنید';
        debtDetails = [{ debtorId: d.id, name: d.name, phone: d.phone, amount: net }];
      }

      settleSessionOnSystem(systemId, {
        paymentMethod: opts.method,
        debtCustomerId: opts.method === 'debt' ? opts.debtorId : undefined,
        totalCost: finalTotal,
        gamePlayCost: m.gamePlayCost,
        buffetCost: m.buffetCost,
        extraServicesCost: m.extraServicesCost,
        extraServices: session.extraServices,
        durationMinutes: m.durationMinutes,
        cashPaidAmount: opts.method === 'cash' ? net : undefined,
        cardPaidAmount: opts.method === 'card' ? net : undefined,
        debtAmount: opts.method === 'debt' ? net : 0,
        debtDetails,
        cardReaderId: reader?.id,
        cardReaderName: reader?.name,
        notes: `تسویه از موبایل (${device})`,
        roundingOffset: roundingOffset !== 0 ? roundingOffset : undefined,
      });
      return { message: `تسویه شد — ${formatCurrency(finalTotal)}${partialPaid ? ` (علی‌الحساب ${formatCurrency(partialPaid)})` : ''}` };
    },
    directSale: (list, customerName, opts, device) => {
      const r = remoteResolveItems(list);
      if (r.error) return r.error;
      const total = r.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
      if (opts.method === 'debt') {
        const d = debtors.find((x) => x.id === opts.debtorId);
        if (!d) return 'مشتری بدهکار را انتخاب کنید';
        handleRecordDetailedBuffetSale(r.items, customerName || d.name, 'debt', d.id, 0, 0, total);
      } else {
        let reader: CardReader | undefined;
        if (opts.method === 'card' && cardReaders.length > 0) {
          reader = cardReaders.find((x) => x.id === opts.cardReaderId);
          if (!reader) return 'کارتخوان را انتخاب کنید';
        }
        handleRecordDetailedBuffetSale(
          r.items, customerName, opts.method,
          undefined,
          opts.method === 'cash' ? total : 0,
          opts.method === 'card' ? total : 0,
          0, reader?.id, reader?.name
        );
      }
      addSystemLog(`فروش بوفه از موبایل (${device})`, 'buffet', 'بوفه');
      return { message: `فروش ثبت شد — ${formatCurrency(total)}` };
    },
  });

  const totalLedgerDebts = debtors.reduce((sum, d) => sum + d.balance, 0);

  // Modal target elements query helper
  const startingSystem = startModalSysId ? systems.find((s) => s.id === startModalSysId) : null;
  const settlingSystem = settleModalSysId ? systems.find((s) => s.id === settleModalSysId) : null;
  const transferSourceSystem = transferSourceSysId ? systems.find((s) => s.id === transferSourceSysId) : null;
  const addBuffetSystem = addBuffetSysId ? systems.find((s) => s.id === addBuffetSysId) : null;
  const addExtraServiceSystem = addExtraServiceSysId ? systems.find((s) => s.id === addExtraServiceSysId) : null;

  return (
    <LicensingPortal theme={theme} adminPassword={adminPassword} adminUsername={adminUsername}>
      <div className={`min-h-screen bg-surface-0b0e14 text-fg flex flex-col font-sans selection:bg-blue-500/30 selection:text-white antialiased ${theme === 'light' ? 'light' : ''}`} dir="rtl">
      
      {/* Dynamic Top Status Strip Bar */}
      <header className="bg-surface-0f1219/90 border-b border-white/5 shrink-0 sticky top-0 z-40 shadow-xl shadow-black/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Main Logo section */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              {appLogo ? (
                <div className="w-11 h-11 rounded-xl overflow-hidden bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/30 shrink-0 border border-white/10">
                  <img
                    src={appLogo}
                    alt={appName || 'لوگوی گیم‌نت'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <img
                  src={defaultLogo}
                  alt="GameNet"
                  className="w-11 h-11 rounded-xl shadow-lg shadow-black/20 shrink-0"
                />
              )}
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white">{appName || 'سامانه هوشمند مدیریت گیم‌نت'}</h1>
            </div>
          </div>

          {/* Dynamic counter and server status cards */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs">
            
            {/* Interactive Unified Admin Control */}
            {userRole === 'admin' ? (
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-bold rounded-lg flex items-center gap-1">
                  <Shield className="w-3 h-3 text-amber-400" />
                  مدیر کل سیستم
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setUserRole('user');
                    if (currentOperator) {
                      setUserPermissions(currentOperator.permissions);
                    }
                    setActiveTab('dashboard');
                    addSystemLog('خروج از حالت مدیریت کل', 'system');
                  }}
                  className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-600 border border-rose-500/25 text-rose-400 hover:text-white font-bold text-[11px] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950/20"
                  title="خروج از حساب مدیریت"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>خروج از مدیریت</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {currentOperator ? (
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded-lg flex items-center gap-1">
                      <User className="w-3 h-3 text-indigo-400" />
                      اپراتور: {currentOperator.name}
                    </span>

                    {/* Unified Combined Action Group */}
                    <div className="inline-flex items-center rounded-xl bg-slate-900/90 border border-white/10 p-0.5 shadow-lg shadow-black/40">
                      <button
                        type="button"
                        onClick={() => setIsLoginModalOpen(true)}
                        className="px-3 py-1.5 hover:bg-blue-600/20 text-slate-300 hover:text-blue-300 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                        title="تعویض اپراتور یا ورود به عنوان مدیر کل"
                      >
                        <Key className="w-3.5 h-3.5 rotate-90 text-blue-400" />
                        <span>تعویض کاربر</span>
                      </button>

                      <div className="w-px h-4 bg-white/15 mx-0.5" />

                      <button
                        type="button"
                        onClick={() => {
                          const opName = currentOperator.name;
                          setCurrentOperator(null);
                          setUserRole('user');
                          setUserPermissions({
                            buffet: false,
                            debt: false,
                            reports: false,
                            backups: false,
                            settings: false,
                            closeWorkingDay: false,
                          });
                          setActiveTab('dashboard');
                          addSystemLog(`خروج اپراتور: ${opName}`, 'system');
                        }}
                        className="px-2.5 py-1.5 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                        title="خروج از حساب این اپراتور"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>خروج</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsLoginModalOpen(true)}
                    className="px-3.5 py-2 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/25 text-blue-400 hover:text-white font-bold text-[11px] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-950/20"
                  >
                    <Key className="w-3.5 h-3.5 rotate-90" />
                    <span>ورود اپراتور / مدیریت</span>
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 transition-colors cursor-pointer"
              title={theme === 'dark' ? 'حالت روشن' : 'حالت تیره'}
              aria-label={theme === 'dark' ? 'تغییر به حالت روشن' : 'تغییر به حالت تیره'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>

            <div className="hidden md:flex flex-col text-left items-end justify-center">
              <span className="text-white text-base sm:text-xl font-black font-mono tracking-wide leading-none">{headerTime.toLocaleTimeString('fa-IR')}</span>
              <span className="text-zinc-300 text-base sm:text-xl font-black font-mono tracking-wide leading-none mt-1 select-none" dir="ltr">
                {headerTime.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
              </span>
            </div>

            <div className="h-8 w-px bg-white/5 hidden md:block"></div>

            {/* In Use metric */}
            <div className="relative group px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 font-bold flex items-center gap-1.5 shadow-sm cursor-help">
              <Flame className="w-4 h-4 fill-rose-500/10" />
              <span>{countActiveSystems} فعال</span>

              <div className="absolute right-1/2 translate-x-1/2 top-full mt-2 w-48 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 bg-surface-0f1219/95 border border-white/10 rounded-xl p-3 shadow-2xl z-55 text-right text-slate-300 font-sans cursor-default normal-case tracking-normal">
                <div className="text-[10px] text-rose-400 font-bold border-b border-white/5 pb-1 mb-1.5">دستگاه‌های فعال:</div>
                {systems.filter(s => s.status === 'active').length > 0 ? (
                  <ul className="space-y-1">
                    {systems.filter(s => s.status === 'active').map((s) => (
                      <li key={s.id} className="text-[10px] flex items-center justify-between gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 inline-block"></span>
                        <span className="text-slate-300 font-medium grow text-right truncate">{s.name}</span>
                        <span className="text-slate-500 text-[9px] shrink-0">({s.type})</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[10px] text-slate-500 pt-0.5 text-center">هیچ دستگاهی فعال نیست</p>
                )}
              </div>
            </div>

            {/* Available metrics */}
            <div className="relative group px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 font-bold flex items-center gap-1.5 shadow-sm cursor-help">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 inline-block animate-pulse"></span>
              <span>{countFreeSystems} دستگاه آزاد</span>

              <div className="absolute right-1/2 translate-x-1/2 top-full mt-2 w-48 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 bg-surface-0f1219/95 border border-white/10 rounded-xl p-3 shadow-2xl z-55 text-right text-slate-300 font-sans cursor-default normal-case tracking-normal">
                <div className="text-[10px] text-emerald-400 font-bold border-b border-white/5 pb-1 mb-1.5">دستگاه‌های آزاد:</div>
                {systems.filter(s => s.status === 'free').length > 0 ? (
                  <ul className="space-y-1">
                    {systems.filter(s => s.status === 'free').map((s) => (
                      <li key={s.id} className="text-[10px] flex items-center justify-between gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 inline-block"></span>
                        <span className="text-slate-300 font-medium grow text-right truncate">{s.name}</span>
                        <span className="text-slate-500 text-[9px] shrink-0">({s.type})</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[10px] text-slate-500 pt-0.5 text-center">هیچ دستگاهی آزاد نیست</p>
                )}
              </div>
            </div>

            {/* Total Balance Outstanding debits indicator removed from top bar, only shown on DebtTab */}
          </div>

        </div>
      </header>

      {/* Primary Tabbed Navigation Row */}
      <nav className="bg-surface-0f1219/60 border-b border-white/5 text-sm shrink-0 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 sm:gap-3 overflow-x-auto py-2 scrollbar-none">
            
            <button
              onClick={() => setActiveTab('dashboard')}
              aria-current={activeTab === 'dashboard' ? 'page' : undefined}
              className={`px-4 py-2.5 rounded-xl transition-all font-bold flex items-center gap-2 shrink-0 border cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600/10 text-blue-400 border-blue-500/30 shadow-lg shadow-blue-500/5'
                  : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>داشبورد سیستم‌ها</span>
            </button>

            {(userRole === 'admin' || userPermissions.buffet) && (
              <button
                onClick={() => setActiveTab('buffet')}
                aria-current={activeTab === 'buffet' ? 'page' : undefined}
                className={`px-4 py-2.5 rounded-xl transition-all font-bold flex items-center gap-2 shrink-0 border cursor-pointer ${
                  activeTab === 'buffet'
                    ? 'bg-blue-600/10 text-blue-400 border-blue-500/30 shadow-lg shadow-blue-500/5'
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span>فروش صندوق بوفه</span>
              </button>
            )}

            {(userRole === 'admin' || userPermissions.debt) && (
              <button
                onClick={() => setActiveTab('debt')}
                aria-current={activeTab === 'debt' ? 'page' : undefined}
                className={`px-4 py-2.5 rounded-xl transition-all font-bold flex items-center gap-2 shrink-0 border cursor-pointer ${
                  activeTab === 'debt'
                    ? 'bg-blue-600/10 text-blue-400 border-blue-500/30 shadow-lg shadow-blue-500/5'
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>دفتر نسیه</span>
              </button>
            )}

            {(userRole === 'admin' || userPermissions.reports) && (
              <button
                onClick={() => setActiveTab('reports')}
                aria-current={activeTab === 'reports' ? 'page' : undefined}
                className={`px-4 py-2.5 rounded-xl transition-all font-bold flex items-center gap-2 shrink-0 border cursor-pointer ${
                  activeTab === 'reports'
                    ? 'bg-blue-600/10 text-blue-400 border-blue-500/30 shadow-lg shadow-blue-500/5'
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>صورت‌های مالی و سود</span>
              </button>
            )}

            {(userRole === 'admin' || userPermissions.backups) && (
              <button
                onClick={() => setActiveTab('backups')}
                aria-current={activeTab === 'backups' ? 'page' : undefined}
                className={`px-4 py-2.5 rounded-xl transition-all font-bold flex items-center gap-2 shrink-0 border cursor-pointer ${
                  activeTab === 'backups'
                    ? 'bg-blue-600/10 text-blue-400 border-blue-500/30 shadow-lg shadow-blue-500/5'
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
                }`}
              >
                <Database className="w-4 h-4" />
                <span>دیتابیس بکاپ‌ها</span>
              </button>
            )}

            {(userRole === 'admin' || userPermissions.settings) && (
              <button
                onClick={() => setActiveTab('settings')}
                aria-current={activeTab === 'settings' ? 'page' : undefined}
                className={`px-4 py-2.5 rounded-xl transition-all font-bold flex items-center gap-1.5 shrink-0 border cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-blue-600/10 text-blue-400 border-blue-500/30 shadow-lg shadow-blue-500/5'
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>تنظیمات عمومی</span>
              </button>
            )}

          </div>
        </div>
      </nav>

      {/* Main Content Pane */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
        
        {/* TAB Panel: SYSTEMS LIVE GRID DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">

            {/* Power Outage Auto-Pause Banner */}
            {(powerOutageNotice.show || systems.some(s => s.status === 'active' && s.activeSession?.isPowerOutagePaused)) && (
              <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 shadow-xl text-right animate-in fade-in duration-200" dir="rtl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
                      <Flame className="w-6 h-6 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-amber-300 font-bold text-sm flex items-center gap-2">
                        <span>⚡ سیستم بازیابی تایمر بعد از قطع برق و خاموشی غیرمنتظره</span>
                      </h4>
                      <p className="text-amber-200/80 text-xs leading-relaxed">
                        دستگاه‌های در حال بازی برای جلوگیری از صدمه به تایمر و محاسبه اشتباه هزینه‌ها به صورت خودکار در زمان خاموشی متوقف شدند. تایمر به صورت دقیق تا همان لحظه قطعی برق ذخیره گردید.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={handleResumeAllPowerOutage}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>وصل برق و ادامه بازی همه دستگاه‌ها</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPowerOutageNotice({ show: false, outageTimeISO: '', affectedSystems: [] });
                        setSystems((prev) =>
                          prev.map((s) =>
                            s.activeSession?.isPowerOutagePaused
                              ? {
                                  ...s,
                                  activeSession: {
                                    ...s.activeSession,
                                    isPowerOutagePaused: false,
                                    powerOutageTime: undefined,
                                  },
                                }
                              : s
                          )
                        );
                      }}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      بستن هشدار
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard Sub-Header / Layout & Statistics Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-151921 border border-white/5 rounded-2xl p-4 shadow-lg" dir="rtl">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-center sm:justify-start">
                <span className="text-xs text-slate-400 font-bold ml-1">بخش دستگاه‌ها:</span>
                
                <div>
                  <button 
                    type="button"
                    onClick={() => setShowLogsModal(true)}
                    className="px-3.5 py-1.5 bg-surface-0b0e14 hover:bg-slate-800/60 border border-amber-500/30 hover:border-amber-500/60 rounded-xl text-[11px] font-bold text-amber-300 hover:text-amber-200 cursor-pointer flex items-center gap-1.5 transition-all shadow-md shadow-amber-950/10"
                    title="مشاهده ثبت و لاگ تمام رویدادهای سیستم"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>📜 لاگ‌های سیستم</span>
                    {systemLogs.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-full text-[9.5px] font-mono font-bold">
                        {systemLogs.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Action buttons & tools for devices dashboard */}
              <div className="flex flex-wrap items-center gap-3 justify-center sm:justify-end">
                {/* Standalone Group Settle Selector Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowGroupSelectDropdown(!showGroupSelectDropdown);
                    }}
                    className={`px-3 py-1.5 rounded-xl transition-all font-bold text-[10px] flex items-center gap-1.5 cursor-pointer border ${
                      selectedGroupSystemIds.length > 0
                        ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40 shadow-lg shadow-indigo-950/20'
                        : 'bg-surface-0b0e14 hover:bg-white/5 text-slate-350 border-white/5 hover:text-white'
                    }`}
                    id="toggle-group-settle-dropdown-btn"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>تسویه گروهی</span>
                    {selectedGroupSystemIds.length > 0 && (
                      <span className="px-1.5 py-0.5 text-[8px] font-mono bg-indigo-500 text-white rounded-full leading-none">
                        {selectedGroupSystemIds.length}
                      </span>
                    )}
                    <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${showGroupSelectDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown menu */}
                  {showGroupSelectDropdown && (
                    <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-80 bg-surface-0f1219/98 border border-white/10 rounded-2xl p-4 shadow-2xl z-55 text-right font-sans font-normal cursor-default normal-case tracking-normal space-y-3 max-h-[80vh] overflow-y-auto">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-[11px] text-zinc-305 font-bold flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          <span>انتخاب گروهی دستگاه‌ها برای پرداخت</span>
                        </span>
                        <button 
                          onClick={() => setShowGroupSelectDropdown(false)}
                          className="text-xs text-slate-500 hover:text-slate-300 p-0.5"
                          title="بستن"
                        >
                          ×
                        </button>
                      </div>

                      {systems.filter(s => s.status === 'active' && s.activeSession).length > 0 && (
                        <div className="flex gap-2 justify-start pb-1">
                          <button
                            type="button"
                            onClick={() => {
                              const activeIds = systems.filter(s => s.status === 'active' && s.activeSession).map(s => s.id);
                              setSelectedGroupSystemIds(activeIds);
                            }}
                            className="px-2 py-1 text-[8.5px] font-black bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/15 rounded-lg cursor-pointer transition-all"
                          >
                            انتخاب همه دستگاه‌های فعال
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedGroupSystemIds([]);
                            }}
                            className="px-2 py-1 text-[8.5px] font-black bg-surface-151921 hover:bg-slate-800 text-slate-400 border border-white/5 rounded-lg cursor-pointer transition-all"
                          >
                            پاک‌کردن انتخاب‌ها
                          </button>
                        </div>
                      )}

                      {systems.filter(s => s.status === 'active' && s.activeSession).length > 0 ? (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {systems.filter(s => s.status === 'active' && s.activeSession).map((s) => {
                            const sysRates = rates[s.type];
                            const metrics = getSessionMetrics(s.activeSession!, sysRates);
                            const isChecked = selectedGroupSystemIds.includes(s.id);
                            return (
                              <div key={s.id} className="flex items-center justify-between p-1.5 rounded-lg bg-white/5 text-[9px] hover:bg-white/10 transition-all">
                                <label className="flex items-center gap-1.5 cursor-pointer grow select-none justify-start">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setSelectedGroupSystemIds(prev => 
                                        prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]
                                      );
                                    }}
                                    className="rounded bg-surface-0b0e14 border-white/10 text-indigo-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                                  />
                                  <span className="font-bold text-slate-300">{s.name} <span className="text-slate-500 font-normal">({s.type})</span></span>
                                </label>
                                <span className="font-mono text-zinc-300 font-bold">{formatCurrency(metrics.totalCost)}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[9px] text-slate-500 text-center py-3 bg-black/15 border border-white/5 rounded-lg leading-relaxed">
                          دستگاه فعال با سانس در حال بازی حضور ندارد.
                        </p>
                      )}

                      {/* Group checkout button */}
                      {selectedGroupSystemIds.length > 0 ? (
                        <div className="pt-2.5 border-t border-white/5 space-y-2">
                          <div className="flex items-center justify-between text-[10px] bg-indigo-950/20 p-2 rounded-xl border border-indigo-500/10">
                            <span className="text-slate-405">مجموع فاکتور ({selectedGroupSystemIds.length} دستگاه):</span>
                            <span className="font-mono text-indigo-400 font-bold text-[10px]">
                              {formatCurrency(
                                selectedGroupSystemIds.reduce((sum, id) => {
                                  const s = systems.find(x => x.id === id);
                                  if (s && s.activeSession) {
                                    return sum + getSessionMetrics(s.activeSession, rates[s.type]).totalCost;
                                  }
                                  return sum;
                                }, 0)
                              )}
                            </span>
                          </div>
                          
                          <button
                            type="button"
                            onClick={handleOpenGroupSettleModal}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-lg text-center cursor-pointer transition-all text-[9.5px] shadow-lg shadow-indigo-950/25"
                          >
                            ثبت و تسویه نهایی گروهی ({selectedGroupSystemIds.length}) سیستم
                          </button>
                        </div>
                      ) : (
                        <p className="text-[9px] text-slate-500 text-center leading-normal pt-1">
                          لطفاً حداقل 1 سیستم را برای تسویه انتخاب کنید.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Buffet POS Toggler Button */}
                <button
                  type="button"
                  onClick={() => setIsBuffetPOSOpen(!isBuffetPOSOpen)}
                  className={`px-3 py-1.5 rounded-xl transition-all font-bold text-[10px] flex items-center gap-1.5 cursor-pointer border ${
                    isBuffetPOSOpen
                      ? 'bg-amber-600/20 text-amber-400 border-amber-500/40 shadow-lg shadow-amber-950/20'
                      : 'bg-surface-0b0e14 hover:bg-white/5 text-slate-350 border-white/5 hover:text-white'
                  }`}
                  id="toggle-buffet-pos-btn"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>{isBuffetPOSOpen ? 'بستن صندوق بوفه' : 'صندوق مستقل بوفه'}</span>
                  {isBuffetPOSOpen && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                </button>

                {/* Close Working Day (End of shift) Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (userRole !== 'admin' && !userPermissions?.closeWorkingDay && !userPermissions?.backups && !userPermissions?.allowUserEdits) {
                      alert('پایان دادن به روز کاری و تهیه بکاپ دیتابیس نیازمند دسترسی مدیریت است. جهت اعطای دسترسی به اپراتور، در بخش "تنظیمات عمومی > سطح دسترسی اپراتور"، گزینه "اتمام روز کاری (ثبت شیفت)" را فعال فرمایید.');
                      return;
                    }
                    setIsCloseDayModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600 border border-rose-500/30 hover:text-white text-rose-400 font-bold text-[10px] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950/20"
                  id="close-working-day-btn"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>اتمام روز کاری (تهیه بکاپ)</span>
                </button>

                {/* Power Outage Resume All Control (ONLY for actual power outage pauses) */}
                {systems.some(s => s.status === 'active' && s.activeSession && s.activeSession.pausedTime && s.activeSession.isPowerOutagePaused) && (
                  <button
                    type="button"
                    onClick={handleResumeAllPowerOutage}
                    className="px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/30 hover:text-white text-emerald-400 font-bold text-[10px] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/20"
                    title="وصل برق و ادامه بازی سیستم‌های متوقف در قطعی برق"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                    <span>⚡ وصل مجدد برق (ادامه)</span>
                  </button>
                )}

                {/* Manual Pause Resume Control (Clean styling, no power outage indicator) */}
                {systems.some(s => s.status === 'active' && s.activeSession && s.activeSession.pausedTime && !s.activeSession.isPowerOutagePaused) && (
                  <button
                    type="button"
                    onClick={handleResumeAllManualPaused}
                    className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/30 hover:text-white text-blue-400 font-bold text-[10px] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-950/20"
                    title="ادامه بازی همه سیستم‌های دارای توقف موقت"
                  >
                    <Play className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
                    <span>ادامه دستگاه‌های متوقف</span>
                  </button>
                )}

                {/* Layout switcher buttons group */}
                <div className="flex items-center gap-1 bg-surface-090c11 p-1 border border-white/5 rounded-xl">
                  <span className="text-slate-500 text-[9px] font-bold px-2">نمایش:</span>
                  <button
                    type="button"
                    onClick={() => setLayoutMode('grid')}
                    className={`px-3 py-1.5 rounded-lg transition-all font-bold text-[10px] flex items-center gap-1 cursor-pointer ${
                      layoutMode === 'grid'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="نمایش شبکه‌ای ابزارک‌ها"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>شبکه‌ای</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayoutMode('list')}
                    className={`px-3 py-1.5 rounded-lg transition-all font-bold text-[10px] flex items-center gap-1 cursor-pointer ${
                      layoutMode === 'list'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="نمایش لیستی سطر به سطر"
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                    <span>لیستی</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Standalone Buffet POS desk with Debt Ledger access as requested */}
            {isBuffetPOSOpen && (
              <BuffetPOSDesk
                buffetItems={buffetItems}
                debtors={debtors}
                onRecordSale={handleRecordDetailedBuffetSale}
                cardReaders={cardReaders}
                cashDivisors={cashDivisors}
                userRole={userRole}
                userPermissions={userPermissions}
              />
            )}

            {/* Core systems grid list layout */}
            {systems.length === 0 ? (
              <div className="text-center py-24 border border-dashed border-white/15 rounded-2xl text-slate-500 space-y-4">
                <Monitor className="w-12 h-12 text-slate-700 mx-auto" />
                <p className="text-sm font-bold text-slate-400">هیچ سیستمی در سیستم پیکربندی گیم‌نت وجود ندارد.</p>
                {userRole === 'admin' ? (
                  <>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                      می‌توانید به بخش تنظیمات عمومی از روی نوار بالای برنامه هدایت شوید و دستگاه‌های جدید مرکز را تعریف نمایید.
                    </p>
                    <button
                      onClick={() => setActiveTab('settings')}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-lg font-bold text-xs cursor-pointer"
                    >
                      افزودن دستگاه از تنظیمات
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    لطفاً از مدیریت درخواست کنید تا دستگاه‌های جدید مرکز را در سیستم تعریف کند.
                  </p>
                )}
              </div>
            ) : (() => {
              const systemCount = systems.length;
              // Dynamically configure scale size based on systems density:
              // - <= 2: 'lg' (spacious large panels)
              // - 3-6: 'md' (balanced standard view)
              // - > 6: 'sm' (compact layouts to prevent overflow/scrolling)
              const cardSize = systemCount <= 2 ? 'lg' : systemCount <= 6 ? 'md' : 'sm';
              
              const containerClass = layoutMode === 'grid'
                ? systemCount === 1
                  ? "grid grid-cols-1 max-w-md mx-auto gap-6"
                  : systemCount === 2
                    ? "grid grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto gap-6"
                    : systemCount <= 4
                      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                      : systemCount <= 6
                        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
                        : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                : systemCount <= 3
                  ? "flex flex-col gap-4 max-w-4xl mx-auto"
                  : "flex flex-col gap-3";

              return (
                <div className={containerClass} id="systems-grid">
                  {systems.map((sys) => (
                    <SystemCard
                      key={sys.id}
                      system={sys}
                      systemRates={rates[sys.type]}
                      onStartSession={handleOpenStartModal}
                      onPauseSession={handlePauseSession}
                      onResumeSession={handleResumeSession}
                      onResetSession={handleResetSession}
                      onEndSession={handleOpenSettleModal}
                      onCancelSession={handleCancelSession}
                      onTransferSession={setTransferSourceSysId}
                      onAddBuffet={handleOpenAddBuffetModal}
                      onAddExtraService={handleOpenAddExtraServiceModal}
                      onChangeStatus={handleToggleDeviceStatus}
                      onUpdateNote={handleUpdateSystemNote}
                      layoutMode={layoutMode}
                      onChangePlayersCount={handleChangePlayersCount}
                      cardSize={cardSize}
                      onDeleteSessionSegment={handleDeleteSessionSegment}
                      onUpdateCustomTimer={handleUpdateCustomTimer}
                      onAdjustSessionTime={handleAdjustSessionTime}
                      onUpdateCustomerInfo={handleUpdateCustomerInfo}
                      onRemoveBuffetItem={handleRemoveBuffetItemFromSession}
                      onRemoveExtraServiceItem={handleRemoveExtraServiceItemFromSession}
                      alarmIntervalSeconds={alarmIntervalSeconds}
                      userRole={userRole}
                      userPermissions={userPermissions}
                      presetTimerMinutes={presetTimerMinutes}
                      cardReaders={cardReaders}
                      onAddPartialPayment={handleAddPartialPayment}
                      onRemovePartialPayment={handleRemovePartialPayment}
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB Panel: PRODUCTS & CONSUMABLES SHELF POS COIN */}
        {activeTab === 'buffet' && (
          <BuffetTab
            buffetItems={buffetItems}
            onAddBuffetItem={handleAddBuffetItem}
            onRecordDirectSale={handleRecordDirectSale}
            onDeleteBuffetItem={handleDeleteBuffetItem}
            onUpdateBuffetItemPriority={handleUpdateBuffetItemPriority}
            onUpdateBuffetItem={handleUpdateBuffetItem}
            userRole={userRole}
            userPermissions={userPermissions}
            operators={operators}
            currentOperator={currentOperator}
            adminPassword={adminPassword}
          />
        )}

        {/* TAB Panel: OUTSTANDING DEBTORS LEDGER BOOK */}
        {activeTab === 'debt' && (
          <DebtTab
            debtors={debtors}
            history={history}
            onAddDebtor={handleAddDebtor}
            onUpdateDebtor={handleUpdateDebtor}
            onRecordTransaction={handleRecordLedgerTransaction}
            onDeleteDebtor={handleDeleteDebtor}
            userRole={userRole}
            userPermissions={userPermissions}
            operators={operators}
            currentOperator={currentOperator}
            adminPassword={adminPassword}
          />
        )}

        {/* TAB Panel: ANALYTICS PERFORMANCE AUDITING */}
        {activeTab === 'reports' && (
          <ReportsTab
            history={history}
            directSales={directSales}
            dailyBackups={dailyBackups}
          />
        )}

        {/* TAB Panel: CONFIGURATION MATRIX SETTINGS */}
        {activeTab === 'settings' && (
          <SettingsTab
            showRemote={userRole === 'admin'}
            rates={rates}
            systems={systems}
            onSaveRates={handleSaveRates}
            onAddSystem={handleAddSystemToCenter}
            onRemoveSystem={handleRemoveSystemNode}
            onResetAllData={handleResetFactoryDefaults}
            alarmIntervalSeconds={alarmIntervalSeconds}
            onSaveAlarmInterval={setAlarmIntervalSeconds}
            cardReaders={cardReaders}
            onAddCardReader={handleAddCardReader}
            onRemoveCardReader={handleRemoveCardReader}
            adminPassword={adminPassword}
            onSaveAdminPassword={setAdminPassword}
            adminUsername={adminUsername}
            onSaveAdminUsername={setAdminUsername}
            userPermissions={userPermissions}
            onUpdateUserPermissions={setUserPermissions}
            operators={operators}
            onSaveOperators={handleSaveOperators}
            presetTimerMinutes={presetTimerMinutes}
            onSavePresetTimerMinutes={setPresetTimerMinutes}
            cashDivisors={cashDivisors}
            onSaveCashDivisors={setCashDivisors}
            adminAutoLogoutMinutes={adminAutoLogoutMinutes}
            onSaveAdminAutoLogoutMinutes={setAdminAutoLogoutMinutes}
            userRole={userRole}
            appName={appName}
            onSaveAppName={setAppName}
            appLogo={appLogo}
            onSaveAppLogo={setAppLogo}
            extraServicePresets={extraServicePresets}
            onSaveExtraServicePresets={setExtraServicePresets}
            requireOperatorLogin={requireOperatorLogin}
            onSaveRequireOperatorLogin={setRequireOperatorLogin}
            telegramConfig={telegramConfig}
            onSaveTelegramConfig={setTelegramConfig}
          />
        )}

        {/* TAB Panel: BACKUP DATABASE LOGS */}
        {activeTab === 'backups' && (
          <BackupsTab
            dailyBackups={dailyBackups}
            onDeleteBackup={handleDeleteBackup}
            onRestoreBackupToCurrent={handleRestoreBackupToCurrent}
            onNavigateToReports={() => setActiveTab('reports')}
            rates={rates}
            systems={systems}
            buffetItems={buffetItems}
            debtors={debtors}
            history={history}
            directSales={directSales}
            systemLogs={systemLogs}
            cardReaders={cardReaders}
            alarmIntervalSeconds={alarmIntervalSeconds}
            layoutMode={layoutMode}
            onImportFullBackup={handleImportFullDatabase}
            adminPassword={adminPassword}
            adminUsername={adminUsername}
            operators={operators}
            extraServicePresets={extraServicePresets}
            appName={appName}
            appLogo={appLogo}
            userPermissions={userPermissions}
            telegramConfig={telegramConfig}
          />
        )}

        {/* TAB Panel: SPECIAL SERVICES */}
        {activeTab === 'services' && (
          <SpecialServicesTab />
        )}

      </main>

      {/* FOOTER credit and legal indicators lines */}
      <footer className="bg-surface-0f1219/80 border-t border-white/5 text-slate-500 py-4 shrink-0 mt-auto text-xs text-center select-none">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2.5">
          <p className="font-medium font-sans tracking-wide text-slate-400" dir="ltr">Developed by AT Team © 2026</p>
          <p className="text-[10px] font-mono tracking-wide text-slate-600">
            تمامی گزارشات در مرورگر و فضای امن حافظه ذخیره می‌شوند.
          </p>
        </div>
      </footer>

      {/* MODALS INJECTIONS WINDOWS */}
      {startingSystem && (
        <StartSessionModal
          isOpen={true}
          system={startingSystem}
          onClose={() => setStartModalSysId(null)}
          onStart={handleStartSession}
        />
      )}

      {settlingSystem && (
        <SettleSessionModal
          isOpen={true}
          system={settlingSystem}
          systemRates={rates[settlingSystem.type]}
          debtors={debtors}
          onClose={handleCloseSettleModal}
          onSettle={handleSettleSessionInvoice}
          cardReaders={cardReaders}
          cashDivisors={cashDivisors}
          onRemoveBuffetItem={handleRemoveBuffetItemFromSession}
          onRemoveExtraServiceItem={handleRemoveExtraServiceItemFromSession}
          userRole={userRole}
          userPermissions={userPermissions}
        />
      )}

      {addBuffetSystem && (
        <AddBuffetItemModal
          isOpen={true}
          system={addBuffetSystem}
          buffetItems={buffetItems}
          onClose={() => setAddBuffetSysId(null)}
          onAdd={handleAddBuffetToSession}
          onRemoveAttachedItem={(itemId) => handleRemoveBuffetItemFromSession(addBuffetSystem.id, itemId)}
        />
      )}

      {addExtraServiceSystem && (
        <AddExtraServiceModal
          isOpen={true}
          system={addExtraServiceSystem}
          onClose={() => setAddExtraServiceSysId(null)}
          onAdd={handleAddExtraServiceToSession}
          extraServicePresets={extraServicePresets}
          onRemoveAttachedItem={(itemId) => handleRemoveExtraServiceItemFromSession(addExtraServiceSystem.id, itemId)}
        />
      )}

      {transferSourceSystem && (
        <TransferSessionModal
          isOpen={true}
          onClose={() => setTransferSourceSysId(null)}
          sourceSystem={transferSourceSystem}
          systems={systems}
          rates={rates}
          onTransfer={handleTransferSession}
        />
      )}

      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => {
          if (requireOperatorLogin && userRole !== 'admin' && !currentOperator) {
            // Cannot dismiss when mandatory login is enabled without being logged in
            return;
          }
          setIsLoginModalOpen(false);
        }}
        isMandatory={requireOperatorLogin && userRole !== 'admin' && !currentOperator}
        onLoginSuccess={() => {
          setUserRole('admin');
          setIsLoginModalOpen(false);
          addSystemLog('ورود موفق به عنوان مدیریت کل سیستم', 'system');
        }}
        operators={operators}
        onOperatorLoginSuccess={(op) => {
          setUserRole('user');
          setCurrentOperator(op);
          setUserPermissions(op.permissions);
          setIsLoginModalOpen(false);
          addSystemLog(`ورود موفق اپراتور: ${op.name} (${op.username})`, 'system');
        }}
        adminPassword={adminPassword}
        adminUsername={adminUsername}
      />

      <CloseWorkingDayModal
        isOpen={isCloseDayModalOpen}
        onClose={() => setIsCloseDayModalOpen(false)}
        onConfirmCloseDay={handleConfirmCloseDay}
        history={history}
        directSales={directSales}
        systemLogs={systemLogs}
        userRole={userRole}
        userPermissions={userPermissions}
        dailyBackups={dailyBackups}
        telegramConfig={telegramConfig}
      />

      <GroupSettleModal
        isOpen={showGroupSettleModal}
        onClose={handleCloseGroupSettleModal}
        selectedSystems={systems.filter((s) => selectedGroupSystemIds.includes(s.id))}
        rates={rates}
        debtors={debtors}
        onSettleGroup={handleSettleGroupInvoice}
        cardReaders={cardReaders}
        cashDivisors={cashDivisors}
        userRole={userRole}
        userPermissions={userPermissions}
      />

      {/* Custom interactive Confirmation Modal */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 bg-surface-06070a/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in" style={{ direction: 'rtl' }}>
          <div className="bg-surface-121620 border border-red-500/20 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl p-6 space-y-5 relative">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold text-white leading-normal">{confirmState.title}</h3>
                <p className="text-[10px] text-zinc-500 leading-normal">عملیات غیر قابل برگشت است</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed text-right font-sans">
              {confirmState.message}
            </p>

            <div className="flex items-center gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-surface-1b202e hover:bg-surface-232a3d text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer font-bold text-xs"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={confirmState.onConfirm}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-lg shadow-red-950/20 font-black transition-all cursor-pointer text-xs"
              >
                تأیید و اعمال
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Logout Dialog Notification */}
      {showAutoLogoutBanner && (
        <div className="fixed inset-0 bg-surface-06070a/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in" style={{ direction: 'rtl' }}>
          <div className="bg-surface-121620 border border-blue-500/20 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl p-6 space-y-5 relative text-right">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-normal">خروج خودکار از حساب مدیریت</h3>
                <p className="text-[10px] text-zinc-500 leading-normal">محافظت خودکار از پنل</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
              به دلیل عدم فعالیت شما به مدت <span className="text-amber-400 font-bold font-mono">{adminAutoLogoutMinutes}</span> دقیقه در سامانه، جهت حفظ امنیت به طور خودکار از حساب مدیریت خارج شدید.
            </p>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowAutoLogoutBanner(false)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-950/20 font-bold transition-all cursor-pointer text-xs"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* System Event Logs Modal */}
      <SystemLogsModal
        isOpen={showLogsModal}
        onClose={() => setShowLogsModal(false)}
        logs={systemLogs}
        onClearLogs={() => setSystemLogs([])}
        onAddLog={(message, type) => addSystemLog(message, type || 'system')}
        history={history}
        directSales={directSales}
        systems={systems}
        rates={rates}
        appName={appName}
        appLogo={appLogo}
      />

    </div>
    </LicensingPortal>
  );
}
