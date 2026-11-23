import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Plus, Receipt, LogOut, CheckCircle, 
  Terminal, ShieldAlert, Monitor, Circle, Flame, Trash2, Clock, Bell,
  XCircle, ArrowRightLeft, ChevronDown, ChevronUp, History, Sparkles,
  User, Phone, X, CreditCard, Wallet, MoreVertical
} from 'lucide-react';
import { System, RateConfig, UserPermissions, CardReader, PartialPayment } from '../types';
import { formatCurrency, formatDuration, getSessionMetrics, getGameplaySegments, toPersianDigits } from '../utils';
import { playAlarmSound } from '../utils/alarmSound';
import PartialPaymentModal from './PartialPaymentModal';
import InvoiceReceiptModal, { InvoiceReceiptData } from './InvoiceReceiptModal';

interface SystemCardProps {
  key?: React.Key;
  system: System;
  systemRates: RateConfig;
  onStartSession: (systemId: string) => void;
  onPauseSession: (systemId: string) => void;
  onResumeSession: (systemId: string) => void;
  onResetSession: (systemId: string) => void;
  onEndSession: (systemId: string) => void;
  onCancelSession?: (systemId: string) => void;
  onTransferSession?: (systemId: string) => void;
  onAddBuffet: (systemId: string) => void;
  onAddExtraService?: (systemId: string) => void;
  onChangeStatus: (systemId: string, nextStatus: 'free' | 'inactive') => void;
  onUpdateNote?: (systemId: string, note: string) => void;
  layoutMode?: 'grid' | 'list';
  onChangePlayersCount?: (systemId: string, playersCount: 1 | 2 | 3 | 4) => void;
  cardSize?: 'sm' | 'md' | 'lg';
  onDeleteSessionSegment?: (systemId: string, segmentIndex: number) => void;
  onUpdateCustomTimer?: (systemId: string, limitType: 'none' | 'time' | 'amount', value?: number, notified?: boolean) => void;
  onAdjustSessionTime?: (systemId: string, totalMinutes: number) => void;
  onUpdateCustomerInfo?: (systemId: string, customerName: string, customerPhone?: string) => void;
  onRemoveBuffetItem?: (systemId: string, itemId: string) => void;
  onRemoveExtraServiceItem?: (systemId: string, itemId: string) => void;
  alarmIntervalSeconds?: number;
  userRole?: 'admin' | 'user';
  userPermissions?: UserPermissions;
  presetTimerMinutes?: number[];
  cardReaders?: CardReader[];
  onAddPartialPayment?: (systemId: string, payment: PartialPayment, reducePlayerCount: boolean) => void;
  onRemovePartialPayment?: (systemId: string, paymentId: string) => void;
}

export default function SystemCard({
  system,
  systemRates,
  onStartSession,
  onPauseSession,
  onResumeSession,
  onResetSession,
  onEndSession,
  onCancelSession,
  onTransferSession,
  onAddBuffet,
  onAddExtraService,
  onChangeStatus,
  onUpdateNote,
  layoutMode = 'grid',
  onChangePlayersCount,
  cardSize = 'md',
  onDeleteSessionSegment,
  onUpdateCustomTimer,
  onAdjustSessionTime,
  onUpdateCustomerInfo,
  onRemoveBuffetItem,
  onRemoveExtraServiceItem,
  alarmIntervalSeconds = 45,
  userRole = 'user',
  userPermissions,
  presetTimerMinutes = [30, 45, 60],
  cardReaders = [],
  onAddPartialPayment,
  onRemovePartialPayment,
}: SystemCardProps) {
  const canEdit = userRole === 'admin' || !!userPermissions?.allowUserEdits;
  // Local reactive timestamp triggers high-performance UI counter ticks inside this card only!
  const [now, setNow] = useState(Date.now());

  // Editing session time state
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [tempMinutes, setTempMinutes] = useState<string>('');

  // Editing customer info state
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [tempCustomerName, setTempCustomerName] = useState('');
  const [tempCustomerPhone, setTempCustomerPhone] = useState('');

  const handleOpenCustomerEdit = () => {
    if (!system.activeSession) return;
    if (!canEdit) {
      alert('تغییر نام یا تلفن مشتری نیازمند دسترسی مدیریت است. (جهت اعطای دسترسی به اپراتور عادی، در تنظیمات عمومی گزینه مربوطه را فعال کنید)');
      return;
    }
    setTempCustomerName(system.activeSession.customerName || '');
    setTempCustomerPhone(system.activeSession.customerPhone || '');
    setIsEditingCustomer(true);
  };

  const handleSaveCustomerInfo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (onUpdateCustomerInfo) {
      onUpdateCustomerInfo(
        system.id,
        tempCustomerName.trim() || 'مشتری عمومی',
        tempCustomerPhone.trim() || undefined
      );
    }
    setIsEditingCustomer(false);
  };

  // Track last repetition alarm epoch millisecond
  const lastAlarmTimeRef = React.useRef<number>(0);

  const isActive = system.status === 'active' && system.activeSession;
  const isPaused = isActive && !!system.activeSession?.pausedTime;

  // More Options Menu State
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu]);

  // Custom Timer States
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [tempType, setTempType] = useState<'none' | 'time' | 'amount'>('none');
  const [tempValue, setTempValue] = useState<string>('');
  const [isTimerHovered, setIsTimerHovered] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false);
  const [showLiveInvoiceModal, setShowLiveInvoiceModal] = useState(false);
  const [liveInvoiceData, setLiveInvoiceData] = useState<InvoiceReceiptData | null>(null);

  const handleOpenLiveInvoice = () => {
    if (!system.activeSession) return;
    const metrics = getSessionMetrics(system.activeSession, systemRates);
    const durationMin = Math.floor(metrics.elapsedMs / 60000);
    const sess = system.activeSession;
    const totalPartial = sess.partialPayments?.reduce((s, p) => s + p.amount, 0) || 0;

    const invoice: InvoiceReceiptData = {
      invoiceNumber: `PRE-${system.name.replace(/\s+/g, '')}-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString(),
      customerName: sess.customerName || 'مشتری آزاد (پیش‌فاکتور)',
      customerPhone: sess.customerPhone,
      systemName: system.name,
      systemType: system.type,
      startTime: sess.startTime,
      endTime: new Date().toISOString(),
      durationMinutes: durationMin,
      playersCount: sess.playersCount,
      hourlyRate: systemRates[`hourlyRate${sess.playersCount}P` as keyof RateConfig] || systemRates.hourlyRate1P,
      gamePlayCost: metrics.gamePlayCost,
      buffetItems: sess.buffetItems,
      buffetCost: metrics.buffetCost,
      extraServices: sess.extraServices,
      extraServicesCost: metrics.extraServicesCost,
      partialPayments: sess.partialPayments,
      totalPartialPaid: totalPartial,
      totalCost: metrics.totalCost,
      netPayable: Math.max(0, metrics.totalCost - totalPartial),
      notes: `پیش‌فاکتور جاری سیستم ${system.name}`,
    };

    setLiveInvoiceData(invoice);
    setShowLiveInvoiceModal(true);
  };

  // Player/Controller Count confirmation state
  const [pendingPlayerCount, setPendingPlayerCount] = useState<1 | 2 | 3 | 4 | null>(null);

  const handlePlayerCountClick = (count: 1 | 2 | 3 | 4) => {
    if (!system.activeSession) return;
    if (count === system.activeSession.playersCount) return;
    setPendingPlayerCount(count);
  };

  // Sync temp state when popover is opened
  useEffect(() => {
    if (showTimerMenu && system.activeSession) {
      setTempType(system.activeSession.customTimerLimitType || 'none');
      setTempValue((system.activeSession.customTimerValue || '').toString());
    }
  }, [showTimerMenu, system.activeSession]);

  // Calculate live gameplay values if active
  const metrics = isActive && system.activeSession
    ? getSessionMetrics(system.activeSession, systemRates, now)
    : { elapsedMs: 0, durationMinutes: 0, gamePlayCost: 0, buffetCost: 0, extraServicesCost: 0, totalCost: 0 };

  const handleSaveTimer = () => {
    if (onUpdateCustomTimer) {
      const val = tempType === 'none' ? undefined : Number(tempValue) || 0;
      onUpdateCustomTimer(system.id, tempType, val, false);
    }
    setShowTimerMenu(false);
  };

  // Check if custom limit is reached
  const limitType = system.activeSession?.customTimerLimitType || 'none';
  const limitValue = system.activeSession?.customTimerValue || 0;
  const isNotified = system.activeSession?.customTimerNotified || false;

  let isLimitReached = false;
  if (isActive && limitType !== 'none' && limitValue > 0) {
    if (limitType === 'time') {
      const limitMs = limitValue * 60 * 1000;
      isLimitReached = metrics.elapsedMs >= limitMs;
    } else if (limitType === 'amount') {
      isLimitReached = metrics.gamePlayCost >= limitValue;
    }
  }

  // Play alarm via shared helper (respects the user's custom sound choice)
  const playChimeSound = () => playAlarmSound();

  // Browser notification helper
  const triggerBrowserNotification = (title: string, body: string) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification(title, { body });
        }
      });
    }
  };

  useEffect(() => {
    if (!isLimitReached) {
      lastAlarmTimeRef.current = 0;
    }
  }, [isLimitReached, limitType, limitValue]);

  useEffect(() => {
    if (isLimitReached && onUpdateCustomTimer) {
      if (!isNotified) {
        playChimeSound();
        triggerBrowserNotification(
          `پایان وقت بازی ${system.name}`,
          `زمان تعیین‌شده برای سیستم ${system.name} به پایان رسیده است.`
        );
        lastAlarmTimeRef.current = Date.now();
        onUpdateCustomTimer(system.id, limitType, limitValue, true);
      } else {
        const nowMs = Date.now();
        if (lastAlarmTimeRef.current === 0) {
          lastAlarmTimeRef.current = nowMs;
        } else if (nowMs - lastAlarmTimeRef.current >= alarmIntervalSeconds * 1000) {
          playChimeSound();
          triggerBrowserNotification(
            `هشدار مجدد پایان وقت ${system.name}`,
            `توجه: زمان تعیین‌شده برای سیستم ${system.name} به اتمام رسیده است.`
          );
          lastAlarmTimeRef.current = nowMs;
        }
      }
    }
  }, [isLimitReached, isNotified, system.id, limitType, limitValue, onUpdateCustomTimer, system.name, alarmIntervalSeconds, now]);

  useEffect(() => {
    let intervalId: number | undefined;

    if (isActive && !isPaused) {
      intervalId = window.setInterval(() => {
        setNow(Date.now());
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isActive, isPaused]);

  const segments = isActive && system.activeSession
    ? getGameplaySegments(system.activeSession, systemRates, metrics.elapsedMs)
    : [];

  const consoleColorClass = 
    system.type === 'PS5' ? 'border-purple-500/30 ring-purple-500/10 text-purple-400 bg-purple-500/5' :
    system.type === 'PS4' ? 'border-indigo-500/30 ring-indigo-500/10 text-indigo-400 bg-indigo-500/5' :
    system.type === 'PS4_VIP' ? 'border-amber-500/30 ring-amber-500/10 text-amber-400 bg-amber-500/5' :
    system.type === 'PC' ? 'border-teal-500/30 ring-teal-500/10 text-teal-400 bg-teal-500/5' :
    'border-emerald-500/30 ring-emerald-500/10 text-emerald-400 bg-emerald-500/5';

  // Size configurations mapping for LIST view
  const listStyles = {
    sm: {
      container: "p-2.5 rounded-xl gap-2",
      iconBox: "p-1.5 rounded-lg",
      iconSize: "w-4 h-4",
      titleText: "text-xs font-bold",
      badgeText: "px-1.5 py-0.5 text-[8px] font-bold",
      indicatorText: "text-[10px]",
      playersBox: "mt-1 p-0.5 rounded-md",
      playersLabel: "text-[9px] px-1",
      playersBtn: "px-1 py-0.5 text-[9px]",
      timerBox: "px-2.5 py-1 min-w-[100px] gap-1",
      timerLabel: "text-[8px]",
      timerVal: "text-sm",
      costsContainer: "gap-2.5 text-[10px]",
      costsItem: "gap-1 md:gap-2",
      totalCostLabel: "text-[10px]",
      totalCostVal: "text-xs font-bold",
      readyLabel: "text-[10px]",
      btn: "px-2 py-1.5 text-[9px] rounded-lg gap-0.5",
      btnIcon: "w-3 h-3",
    },
    md: {
      container: "p-4 rounded-2xl gap-4",
      iconBox: "p-2 rounded-xl",
      iconSize: "w-5 h-5",
      titleText: "text-sm font-bold/90",
      badgeText: "px-2 py-0.5 text-[9px] font-bold",
      indicatorText: "text-[11px]",
      playersBox: "mt-2 p-0.5 rounded-lg",
      playersLabel: "text-[10px] px-1.5",
      playersBtn: "px-1.5 py-0.5 text-[10px]",
      timerBox: "px-3 py-1.5 min-w-[130px]",
      timerLabel: "text-[10px]",
      timerVal: "text-lg",
      costsContainer: "gap-4 text-xs",
      costsItem: "gap-1.5 md:gap-3",
      totalCostLabel: "text-xs",
      totalCostVal: "text-sm font-semibold",
      readyLabel: "text-xs",
      btn: "px-3 py-2 text-[11px] rounded-xl gap-1",
      btnIcon: "w-3.5 h-3.5",
    },
    lg: {
      container: "p-5 md:p-6 rounded-2xl gap-6",
      iconBox: "p-2.5 rounded-xl",
      iconSize: "w-6 h-6",
      titleText: "text-base font-black",
      badgeText: "px-2.5 py-0.5 text-[10px] font-bold border-2",
      indicatorText: "text-xs font-semibold",
      playersBox: "mt-3 p-1 rounded-xl",
      playersLabel: "text-[11px] px-2",
      playersBtn: "px-2.5 py-1 text-xs",
      timerBox: "px-4 py-2 min-w-[150px]",
      timerLabel: "text-[11px] tracking-wider",
      timerVal: "text-xl",
      costsContainer: "gap-6 text-sm",
      costsItem: "gap-2.5 md:gap-4",
      totalCostLabel: "text-sm",
      totalCostVal: "text-base font-bold",
      readyLabel: "text-sm",
      btn: "px-4 py-2.5 text-xs rounded-xl gap-1.5",
      btnIcon: "w-4 h-4",
    }
  };

  // Size configurations mapping for GRID view
  const gridStyles = {
    sm: {
      container: "p-3 pt-3.5 pb-2.5 rounded-xl",
      hSpacing: "pb-2",
      titleText: "text-sm font-bold",
      badgeText: "px-1.5 py-0.5 text-[8px] font-bold",
      indicatorText: "text-[10px]",
      iconBox: "p-1.5 rounded-lg",
      iconSize: "w-4 h-4",
      contentPadding: "px-3 py-2.5 border-t border-b",
      contentSpacing: "space-y-2.5",
      playersLabel: "text-[9px]",
      playersBtn: "px-2 py-0.5 text-[9px]",
      timerBox: "py-1 rounded-lg",
      timerLabel: "text-[8px] tracking-wide",
      timerVal: "text-lg font-bold tracking-widest",
      financialBoxPadding: "p-2 rounded-lg",
      financialBoxSpacing: "space-y-0.5 text-[10px]",
      totalCostVal: "text-xs font-semibold",
      footerPadding: "p-2 gap-1.5",
      btnUpper: "py-1.5 rounded-lg text-[10px] gap-0.5",
      btnLower: "w-full py-1.5 rounded-lg text-[10px] gap-0.5",
      btnIcon: "w-3 h-3",
    },
    md: {
      container: "p-4 pt-5 pb-3 rounded-2xl",
      hSpacing: "pb-3",
      titleText: "text-md font-bold",
      badgeText: "px-2 py-0.5 text-[10px] font-bold",
      indicatorText: "text-xs",
      iconBox: "p-2 rounded-xl",
      iconSize: "w-5 h-5",
      contentPadding: "px-4 py-3 border-t border-b",
      contentSpacing: "space-y-3.5",
      playersLabel: "text-slate-400 text-xs",
      playersBtn: "px-2.5 py-0.5 text-[10px]",
      timerBox: "py-1.5 rounded-xl",
      timerLabel: "text-[10px] tracking-wider",
      timerVal: "text-2xl font-bold tracking-widest",
      financialBoxPadding: "p-2.5 rounded-xl",
      financialBoxSpacing: "space-y-1 text-xs",
      totalCostVal: "text-blue-400 text-sm font-semibold",
      footerPadding: "p-3 gap-2",
      btnUpper: "py-2.5 rounded-xl text-xs gap-1",
      btnLower: "w-full py-2.5 rounded-xl text-xs gap-1",
      btnIcon: "w-3.5 h-3.5",
    },
    lg: {
      container: "p-6 pt-7 pb-4 rounded-3xl",
      hSpacing: "pb-4",
      titleText: "text-lg font-black",
      badgeText: "px-2.5 py-0.5 text-[11px] font-bold border-2",
      indicatorText: "text-sm font-semibold",
      iconBox: "p-2.5 rounded-xl",
      iconSize: "w-6 h-6",
      contentPadding: "px-5 py-4 border-t-2 border-b-2",
      contentSpacing: "space-y-4",
      playersLabel: "text-slate-400 text-sm font-semibold",
      playersBtn: "px-3.5 py-0.5 text-xs",
      timerBox: "py-3 rounded-2xl",
      timerLabel: "text-[11px] tracking-widest",
      timerVal: "text-3xl font-black tracking-widest",
      financialBoxPadding: "p-4 rounded-2xl border-dashed border-2",
      financialBoxSpacing: "space-y-1.5 text-sm",
      totalCostVal: "text-blue-400 text-base font-bold",
      footerPadding: "p-4 gap-3",
      btnUpper: "py-3 rounded-xl text-xs gap-1.5",
      btnLower: "w-full py-2.5 rounded-xl text-sm gap-1.5",
      btnIcon: "w-4 h-4",
    },
  };

  if (layoutMode === 'list') {
    const s = listStyles[cardSize];

    return (
      <div 
        className={`relative flex flex-col border transition-all duration-300 ${s.container} ${
          isActive
            ? isPaused
              ? 'bg-surface-151921 border-amber-500/30'
              : isLimitReached
                ? 'bg-surface-181115 border-rose-500/60 ring-2 ring-rose-500/30 animate-pulse'
                : 'bg-surface-151921 border-blue-500/30 ring-1 ring-blue-500/10'
            : system.status === 'inactive'
              ? 'bg-surface-151921/60 border-white/5 opacity-50 grayscale text-slate-500'
              : 'bg-surface-151921 border-white/5 hover:border-white/10'
        }`}
        id={`system-card-${system.id}`}
        dir="rtl"
      >
        <div className="flex flex-col lg:flex-row items-center justify-between w-full gap-4">
        {/* Dynamic Left status indicator border */}
        <div className={`absolute top-0 bottom-0 right-0 w-1 rounded-r-2xl ${
          isActive 
            ? isPaused 
              ? 'bg-amber-500' 
              : isLimitReached 
                ? 'bg-rose-500 animate-pulse' 
                : 'bg-blue-500' 
            : system.status === 'free' 
              ? 'bg-emerald-500' 
              : 'bg-slate-700'
        }`} />

        {/* 1. Device Info Column */}
        <div className="flex items-center gap-3 w-full lg:w-1/4 pr-2">
          <div className={`bg-surface-0b0e14 border border-white/5 shrink-0 ${s.iconBox}`}>
            <Monitor className={`${s.iconSize} ${
              isActive ? (isPaused ? 'text-amber-500' : 'text-accent') : system.status === 'free' ? 'text-emerald-500' : 'text-slate-600'
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className={`text-white tracking-tight ${s.titleText}`}>{system.name}</h4>
              <span className={`rounded-md border ${consoleColorClass} ${s.badgeText}`}>
                {system.type}
              </span>
            </div>
            <div className={`flex items-center gap-1.5 ${s.indicatorText} mt-1`}>
              {isActive ? (
                isPaused ? (
                  <span className="text-amber-400 font-medium flex items-center gap-1">
                    {system.activeSession?.isPowerOutagePaused ? (
                      <>
                        <span className="animate-pulse">⚡</span>
                        <span>متوقف در قطعی برق</span>
                      </>
                    ) : (
                      <span>توقف موقت بازی</span>
                    )}
                    <span>({system.activeSession?.playersCount}P)</span>
                  </span>
                ) : (
                  <span className="text-blue-400 font-semibold animate-pulse flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 fill-blue-500/10" />
                    در حال بازی ({system.activeSession?.playersCount}P)
                  </span>
                )
              ) : system.status === 'free' ? (
                <span className="text-emerald-400 font-medium">آزاد و آماده پذیرش</span>
              ) : (
                <span className="text-slate-500 font-medium">خارج از سرویس</span>
              )}
            </div>

            {isActive && system.activeSession && (
              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex items-center gap-1.5 bg-surface-090c11/80 border border-white/5 w-fit rounded-lg p-0.5 mt-1">
                  <span className="text-slate-500 font-bold text-[10px] px-1.5">دسته:</span>
                  {([1, 2, 3, 4] as const).map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => handlePlayerCountClick(count)}
                      className={`rounded font-bold transition-all cursor-pointer ${s.playersBtn} ${
                        system.activeSession?.playersCount === count
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>

                {/* Custom Timer trigger inline in Column 1 */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTimerMenu(!showTimerMenu)}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                      limitType !== 'none'
                        ? isLimitReached
                          ? 'bg-rose-500/25 border-rose-500/40 text-rose-300 animate-pulse'
                          : 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
                        : 'bg-slate-800/40 border-white/5 hover:border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                    title="تایمر دلخواه"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {limitType === 'none' ? (
                      <span>تایمر دلخواه</span>
                    ) : (
                      <span className="font-mono flex items-center gap-1">
                        {limitType === 'time' ? (
                          <>
                            <span>{limitValue}m</span>
                            {isLimitReached ? (
                              <span className="text-[9px] bg-rose-500 text-white rounded px-1 animate-pulse">پایان وقت</span>
                            ) : (
                              <span className="text-[9px] text-[#A7F3D0] font-sans">
                                ({Math.max(0, Math.ceil(limitValue - metrics.elapsedMs / 60000))} دقیقه مانده)
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span>{formatCurrency(limitValue)}</span>
                            {isLimitReached ? (
                              <span className="text-[9px] bg-rose-500 text-white rounded px-1 animate-pulse">پایان مبلغ</span>
                            ) : (() => {
                              const pCount = system.activeSession?.playersCount || 1;
                              let hRate = systemRates.hourlyRate1P;
                              if (pCount === 2) hRate = systemRates.hourlyRate2P;
                              else if (pCount === 3) hRate = systemRates.hourlyRate3P;
                              else if (pCount === 4) hRate = systemRates.hourlyRate4P;
                              const remCost = Math.max(0, limitValue - metrics.gamePlayCost);
                              const remMinutes = hRate > 0 ? Math.ceil((remCost / hRate) * 60) : 0;
                              return (
                                <span className="text-[9px] text-[#A7F3D0] font-sans">
                                  ({formatCurrency(remCost)} | {toPersianDigits(remMinutes)} دقیقه مانده)
                                </span>
                              );
                            })()}
                          </>
                        )}
                      </span>
                    )}
                  </button>

                  {/* Popover / Mini Menu */}
                  {showTimerMenu && (
                    <div className="absolute right-0 lg:left-0 lg:right-auto mt-1.5 w-64 bg-surface-0f1219 border border-white/10 rounded-xl p-3 shadow-2xl z-40 text-right font-sans cursor-default normal-case tracking-normal">
                      <div className="text-[11px] text-zinc-300 font-bold border-b border-white/5 pb-1.5 mb-2.5 flex items-center justify-between">
                        <span>تنظیم تایمر دلخواه مشتری</span>
                        <button 
                          type="button" 
                          onClick={() => setShowTimerMenu(false)}
                          className="text-slate-500 hover:text-slate-300 text-[11px] font-bold px-1"
                        >
                          ×
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1 mb-2.5 bg-black/30 p-0.5 rounded-lg border border-white/5">
                        <button
                          type="button"
                          onClick={() => setTempType('none')}
                          className={`py-1 text-[9px] rounded font-semibold transition-all ${
                            tempType === 'none' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          غیرفعال
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTempType('time');
                            if (tempValue === '0' || !tempValue) setTempValue('60');
                            if ('Notification' in window && Notification.permission === 'default') {
                              Notification.requestPermission();
                            }
                          }}
                          className={`py-1 text-[9px] rounded font-semibold transition-all ${
                            tempType === 'time' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          زمان (min)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTempType('amount');
                            if (tempValue === '0' || !tempValue) setTempValue('50000');
                            if ('Notification' in window && Notification.permission === 'default') {
                              Notification.requestPermission();
                            }
                          }}
                          className={`py-1 text-[9px] rounded font-semibold transition-all ${
                            tempType === 'amount' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          مبلغ (تومان)
                        </button>
                      </div>

                      {tempType !== 'none' && (
                        <div className="space-y-1.5 mb-2.5">
                          <label className="text-[10px] text-slate-400 block text-right">
                            {tempType === 'time' ? 'مقدار زمان (دقیقه):' : 'مبلغ هدف (تومان):'}
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              dir="ltr"
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              className="w-full bg-surface-050608 border border-white/10 rounded-lg pr-2.5 pl-14 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                              placeholder={tempType === 'time' ? 'مثال: 60' : 'مثال: 50000'}
                              min="1"
                            />
                            {tempType === 'amount' && (
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500">تومان</span>
                            )}
                            {tempType === 'time' && (
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500">دقیقه</span>
                            )}
                          </div>

                          {/* Calculated Target Cost preview according to hourly rates when choosing time */}
                          {tempType === 'time' && Number(tempValue) > 0 && (() => {
                            const pCount = system.activeSession?.playersCount || 1;
                            let hourlyRate = systemRates.hourlyRate1P;
                            if (pCount === 2) hourlyRate = systemRates.hourlyRate2P;
                            else if (pCount === 3) hourlyRate = systemRates.hourlyRate3P;
                            else if (pCount === 4) hourlyRate = systemRates.hourlyRate4P;
                            const targetCalculatedCost = Math.round((hourlyRate / 60) * Number(tempValue));
                            return (
                              <div className="flex items-center justify-between bg-blue-950/40 border border-blue-500/30 px-2 py-1.5 rounded-lg text-[10px] text-blue-300">
                                <span className="text-slate-400">مبلغ هدف ({toPersianDigits(pCount)} دسته):</span>
                                <span className="font-mono font-bold text-blue-300">{formatCurrency(targetCalculatedCost)}</span>
                              </div>
                            );
                          })()}

                          {/* Calculated Playable Minutes preview according to hourly rates when choosing amount */}
                          {tempType === 'amount' && Number(tempValue) > 0 && (() => {
                            const pCount = system.activeSession?.playersCount || 1;
                            let hourlyRate = systemRates.hourlyRate1P;
                            if (pCount === 2) hourlyRate = systemRates.hourlyRate2P;
                            else if (pCount === 3) hourlyRate = systemRates.hourlyRate3P;
                            else if (pCount === 4) hourlyRate = systemRates.hourlyRate4P;

                            if (!hourlyRate || hourlyRate <= 0) {
                              return (
                                <div className="bg-amber-950/40 border border-amber-500/30 p-2 rounded-lg text-[10px] text-amber-300">
                                  نرخ ساعتی برای {pCount} دسته تعریف نشده است.
                                </div>
                              );
                            }

                            const rawMinutes = (Number(tempValue) / hourlyRate) * 60;
                            const roundedMins = Math.round(rawMinutes);
                            const totalWholeMins = Math.floor(rawMinutes);
                            const remainingSeconds = Math.round((rawMinutes - totalWholeMins) * 60);
                            const hours = Math.floor(totalWholeMins / 60);
                            const minsInHour = totalWholeMins % 60;

                            let formattedTime = '';
                            if (hours > 0 && minsInHour > 0) {
                              formattedTime = `${toPersianDigits(hours)} ساعت و ${toPersianDigits(minsInHour)} دقیقه`;
                            } else if (hours > 0) {
                              formattedTime = `${toPersianDigits(hours)} ساعت کامل`;
                            } else {
                              formattedTime = `${toPersianDigits(totalWholeMins)} دقیقه`;
                            }

                            return (
                              <div className="space-y-1.5 bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-xl text-right animate-in fade-in duration-150">
                                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                                  <span className="text-[10px] text-slate-300 font-bold flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>زمان مجاز بازی ({toPersianDigits(pCount)} دسته):</span>
                                  </span>
                                  <span className="text-xs font-black text-emerald-300 font-mono">
                                    {toPersianDigits(roundedMins)} دقیقه
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-slate-400">معادل دقیق:</span>
                                  <span className="font-bold text-white">
                                    {formattedTime}
                                    {remainingSeconds > 0 && hours === 0 && ` و ${toPersianDigits(remainingSeconds)} ثانیه`}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-[9px] text-slate-400 pt-0.5">
                                  <span>نرخ ساعتی {pCount} دسته:</span>
                                  <span className="font-mono text-slate-300">{formatCurrency(hourlyRate)}</span>
                                </div>
                              </div>
                            );
                          })()}

                          {tempType === 'amount' && (
                            <div className="space-y-1 pt-1">
                              <span className="text-[9px] text-slate-400 block text-right">مبالغ سریع:</span>
                              <div className="flex flex-wrap gap-1 justify-end" dir="rtl">
                                {[20000, 30000, 50000, 70000, 100000, 150000].map((amt) => (
                                  <button
                                    key={amt}
                                    type="button"
                                    onClick={() => setTempValue(String(amt))}
                                    className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-600/30 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/30 rounded text-[9px] font-sans transition-all cursor-pointer font-mono"
                                  >
                                    {toPersianDigits(amt >= 1000 ? `${amt / 1000} هزار` : `${amt}`)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {tempType === 'time' && presetTimerMinutes && presetTimerMinutes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5 justify-end" dir="rtl">
                              {presetTimerMinutes.map((mins) => {
                                let label = `${mins}m`;
                                if (mins === 30) label = "۳۰ دقیقه";
                                else if (mins === 45) label = "۴۵ دقیقه";
                                else if (mins === 60) label = "۱ ساعت";
                                else if (mins === 90) label = "۱.۵ ساعت";
                                else if (mins === 120) label = "۲ ساعت";
                                else label = `${mins} دقیقه`;
                                
                                return (
                                  <button
                                    key={mins}
                                    type="button"
                                    onClick={() => setTempValue(String(mins))}
                                    className="px-2 py-0.5 bg-blue-500/10 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-500/30 rounded text-[9px] font-sans transition-all cursor-pointer"
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <button
                        type="button"
                        onClick={handleSaveTimer}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold py-1.5 rounded-lg transition-all"
                      >
                        ثبت و ذخیره
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Timer & Duration Block */}
        {isActive && isEditingTime ? (
          <div className="flex flex-col items-center bg-surface-121620 border-2 border-blue-500 rounded-xl p-2.5 space-y-1.5 z-20 w-full lg:w-52 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between w-full gap-2 border-b border-white/10 pb-1 mb-1">
              <span className="text-blue-400 text-[10px] font-bold shrink-0">ویرایش دستی زمان (دقیقه)</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTime(false);
                }}
                className="text-slate-400 hover:text-white text-sm font-bold px-1 cursor-pointer"
              >
                ×
              </button>
            </div>
            
            <div className="flex items-center gap-1.5 w-full">
              <input
                type="number"
                min="0"
                max="1440"
                value={tempMinutes}
                onChange={(e) => setTempMinutes(e.target.value)}
                className="w-20 bg-surface-080a0f border border-blue-500/50 rounded-lg py-1 px-2 text-center text-white text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="دقیقه"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  const mins = parseInt(tempMinutes, 10);
                  if (!isNaN(mins) && mins >= 0 && onAdjustSessionTime) {
                    onAdjustSessionTime(system.id, mins);
                    setIsEditingTime(false);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-1 px-3 text-[10px] font-bold transition-all cursor-pointer shadow-md"
              >
                ثبت
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1 w-full">
              {[-10, -5, +5, +10].map((offset) => (
                <button
                  key={offset}
                  type="button"
                  onClick={() => {
                    const current = parseInt(tempMinutes, 10) || 0;
                    const next = Math.max(0, current + offset);
                    setTempMinutes(next.toString());
                  }}
                  className="bg-surface-1a202c hover:bg-blue-600/30 text-slate-200 text-[9px] font-mono font-bold py-1 rounded-md border border-white/10 cursor-pointer transition-colors"
                >
                  {offset > 0 ? `+${offset}` : offset}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div 
            onClick={() => {
              if (isActive) {
                setTempMinutes(Math.round(metrics.elapsedMs / 60000).toString());
                setIsEditingTime(true);
              }
            }}
            className={`w-full lg:w-auto flex items-center justify-between lg:justify-center lg:flex-col bg-surface-0b0e14 border border-white/10 hover:border-blue-500/50 rounded-xl relative group transition-all duration-200 ${isActive ? 'cursor-pointer' : ''} ${s.timerBox}`}
            title={isActive ? "برای ویرایش دستی زمان بازی کلیک کنید" : ""}
          >
            <div className="flex items-center gap-1.5">
              <span className={`text-slate-400 font-medium ${s.timerLabel} ${isActive ? 'group-hover:text-blue-400' : ''} transition-colors`}>زمان سپری‌شده</span>
              {isActive && (
                <span className="text-[8px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded shadow-sm opacity-90 group-hover:opacity-100 transition-opacity">
                  ✎ ویرایش
                </span>
              )}
            </div>
            <span className={`font-mono font-bold text-slate-100 leading-none ${s.timerVal} ${isActive ? 'group-hover:text-blue-400' : ''} transition-colors`}>
              {isActive ? formatDuration(metrics.elapsedMs) : '--:--:--'}
            </span>
            {isActive && (
              <div className="absolute inset-0 bg-surface-0e121c opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                <span className="text-[9px] text-white bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg font-bold shadow-lg border border-blue-400/40">
                  ✎ ویرایش دستی زمان
                </span>
              </div>
            )}
          </div>
        )}

        {/* 3. Cost Columns */}
        <div className={`w-full lg:w-auto flex items-center justify-between lg:justify-center ${s.costsContainer}`}>
          {isActive ? (
            <div className={`flex flex-wrap lg:flex-col text-slate-400 text-right ${s.costsItem}`}>
              <div className="flex items-center gap-1.5 md:gap-3">
                <span className="text-slate-500">هزینه بازی:</span>
                <span className="font-mono text-slate-200 font-bold">{formatCurrency(metrics.gamePlayCost)}</span>
              </div>

              {/* Segment breakdown for List layout */}
              {segments.length > 0 && (
                <div className="w-full lg:w-auto mt-1 space-y-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                    className="flex items-center justify-between w-full lg:w-auto gap-2 text-[10px] text-slate-400 hover:text-slate-200 bg-slate-900/45 hover:bg-slate-900/70 px-2 py-1 rounded border border-white/5 cursor-pointer transition-all font-bold"
                  >
                    <div className="flex items-center gap-1.5">
                      <History className="w-3 h-3 text-slate-400" />
                      <span>تاریخچه و ریز حساب ({segments.length} بخش{metrics.buffetCost > 0 ? ' + بوفه' : ''}{metrics.extraServicesCost > 0 ? ' + خدمات' : ''})</span>
                    </div>
                    {isHistoryExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                  </button>

                  {isHistoryExpanded && (
                    <div className="space-y-1 animate-fade-in">
                      {segments.map((seg, idx) => (
                        <div key={idx} className="flex items-center justify-end gap-2 text-[10px] bg-slate-900/60 dark:bg-slate-900/40 px-2 py-0.5 rounded border border-white/5 shadow-sm">
                          {onDeleteSessionSegment && (
                            <button
                              type="button"
                              onClick={() => onDeleteSessionSegment(system.id, idx)}
                              className="p-0.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded cursor-pointer transition-all active:scale-90"
                              title={`حذف و صفر کردن این بخش (${seg.playersCount} نفره)`}
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                          <span className="font-mono text-slate-300">{formatCurrency(seg.cost)}</span>
                          <span className="text-slate-400">{seg.playersCount} دسته ({seg.minutes} دقیقه)</span>
                        </div>
                      ))}

                      {metrics.buffetCost > 0 && (
                        <div className="flex items-center justify-end gap-2 text-[10px] bg-slate-900/60 dark:bg-slate-900/40 px-2 py-0.5 rounded border border-white/5 shadow-sm text-slate-300">
                          <span className="font-mono text-blue-400 font-bold">+{formatCurrency(metrics.buffetCost)}</span>
                          <span className="text-slate-400">🍿 بوفه ({toPersianDigits(system.activeSession?.buffetItems.reduce((acc, i) => acc + i.quantity, 0) || 0)} قلم)</span>
                        </div>
                      )}

                      {metrics.extraServicesCost > 0 && (
                        <div className="flex items-center justify-end gap-2 text-[10px] bg-slate-900/60 dark:bg-slate-900/40 px-2 py-0.5 rounded border border-white/5 shadow-sm text-slate-300">
                          <span className="font-mono text-amber-400 font-bold">+{formatCurrency(metrics.extraServicesCost)}</span>
                          <span className="text-slate-400">✨ خدمات ({toPersianDigits(system.activeSession?.extraServices?.reduce((acc, i) => acc + i.quantity, 0) || 0)} مورد)</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1.5 md:gap-3 text-blue-400 font-bold border-t border-white/5 pt-1 mt-1">
                <span>جمع کل:</span>
                <span className={s.totalCostVal}>{formatCurrency(metrics.totalCost)}</span>
              </div>

              {system.activeSession?.partialPayments && system.activeSession.partialPayments.length > 0 && (() => {
                const partialSum = system.activeSession.partialPayments.reduce((acc, p) => acc + p.amount, 0);
                const remainingCost = Math.max(0, metrics.totalCost - partialSum);
                return (
                  <div className="p-2 bg-emerald-950/20 border border-emerald-500/20 rounded-xl mt-1.5 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between font-bold text-emerald-400">
                      <span>🟢 علی‌الحساب دریافتی:</span>
                      <span className="font-mono">-{formatCurrency(partialSum)}</span>
                    </div>
                    <div className="flex items-center justify-between font-bold text-amber-400 border-t border-white/5 pt-1">
                      <span>خالص مانده:</span>
                      <span className="font-mono text-xs">{formatCurrency(remainingCost)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <span className={`text-slate-500 font-medium ${s.readyLabel}`}>آماده شروع بازی جدید</span>
          )}
        </div>

        {/* 4. Actions Footer */}
        <div className="w-full lg:w-auto flex items-center justify-end gap-2 shrink-0">
          {isActive ? (
            <div className="flex items-center gap-1.5 w-full lg:w-auto justify-end relative" ref={moreMenuRef}>
              {isPaused ? (
                <button
                  type="button"
                  onClick={() => onResumeSession(system.id)}
                  className={`bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-600/20 flex items-center justify-center shrink-0 transition-all cursor-pointer ${s.btn}`}
                  title="ادامه بازی"
                >
                  <Play className={`fill-current ${s.btnIcon}`} />
                  <span>ادامه</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onPauseSession(system.id)}
                  className={`bg-amber-500/15 hover:bg-amber-550 text-amber-400 hover:text-white border border-amber-500/20 flex items-center justify-center shrink-0 transition-all cursor-pointer ${s.btn}`}
                  title="توقف موقت"
                >
                  <Pause className={`fill-current ${s.btnIcon}`} />
                  <span>توقف</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onEndSession(system.id)}
                className={`bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white transition-all border border-rose-500/20 hover:border-rose-600 flex items-center justify-center shrink-0 font-bold cursor-pointer ${s.btn}`}
              >
                <Receipt className={s.btnIcon} />
                <span>تسویه و پایان</span>
              </button>

              {/* More Options Dropdown Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className={`bg-surface-0b0e14 hover:bg-surface-151921 border border-white/10 hover:border-amber-500/30 text-slate-200 flex items-center justify-center shrink-0 transition-all cursor-pointer ${s.btn} ${showMoreMenu ? 'border-amber-500/50 bg-surface-151921' : ''}`}
                  title="گزینه‌های بیشتر سیستم"
                >
                  <MoreVertical className={s.btnIcon} />
                  <span>بیشتر</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showMoreMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* More Menu Dropdown Content */}
                {showMoreMenu && (
                  <div className="absolute left-0 top-full mt-1.5 w-56 bg-surface-121620 border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 space-y-1 text-right animate-in fade-in zoom-in-95 duration-100" dir="rtl">
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); onAddBuffet(system.id); }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-white/5 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>ثبت سفارش بوفه (بوفه+)</span>
                    </button>

                    {onAddExtraService && (
                      <button
                        type="button"
                        onClick={() => { setShowMoreMenu(false); onAddExtraService(system.id); }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-white/5 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>خدمات و تجهیزات جانبی (خدمات+)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); handleOpenCustomerEdit(); }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-white/5 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      <User className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>ویرایش نام / شماره مشتری</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); setShowPartialPaymentModal(true); }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-white/5 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>ثبت پرداخت بخشی / بیعانه</span>
                    </button>

                    {onTransferSession && (
                      <button
                        type="button"
                        onClick={() => { setShowMoreMenu(false); onTransferSession(system.id); }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-white/5 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        <ArrowRightLeft className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>انتقال حساب به سیستم دیگر</span>
                      </button>
                    )}

                    <div className="h-px bg-white/5 my-1"></div>

                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); onResetSession(system.id); }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-white/5 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>ریست تایمر از صفر</span>
                    </button>

                    {onCancelSession && (
                      <button
                        type="button"
                        onClick={() => { setShowMoreMenu(false); onCancelSession(system.id); }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>انصراف بدون پرداخت (لغو جلسه)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : system.status === 'free' ? (
            <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
              <button
                type="button"
                onClick={() => onStartSession(system.id)}
                className={`bg-accent/10 text-accent border border-accent/25 hover:bg-accent hover:text-[#05221a] flex items-center transition-all cursor-pointer ${s.btn}`}
              >
                <Play className={`fill-current ${s.btnIcon}`} />
                <span>شروع بازی</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeStatus(system.id, 'inactive')}
                className={`bg-surface-0b0e14 border border-white/5 hover:border-white/15 hover:text-slate-300 text-slate-400 transition-all cursor-pointer ${s.btn}`}
              >
                <span>غیرفعال‌سازی</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onChangeStatus(system.id, 'free')}
              className={`bg-surface-0b0e14 hover:bg-surface-151921 border border-white/5 hover:border-white/15 text-slate-200 transition-all flex items-center cursor-pointer ${s.btn}`}
            >
              <CheckCircle className={`text-emerald-400 ${s.btnIcon}`} />
              <span>فعال‌سازی مجدد</span>
            </button>
          )}
        </div>

        </div>

        {/* Note (یادداشت) Section for List View */}
        <div className="w-full mt-3 pt-3 border-t border-white/5 space-y-1.5 text-right shrink-0" dir="rtl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 select-none">
              <span>📝 یادداشت سیستم / مشتری</span>
            </span>
            {system.note && (
              <button
                type="button"
                onClick={() => onUpdateNote && onUpdateNote(system.id, '')}
                className="text-[9px] text-rose-400 hover:text-rose-300 font-bold transition-colors cursor-pointer select-none"
                title="پاک کردن یادداشت"
              >
                پاک کردن
              </button>
            )}
          </div>
          <textarea
            value={system.note || ''}
            onChange={(e) => onUpdateNote && onUpdateNote(system.id, e.target.value)}
            placeholder="ثبت یادداشت (تلفن مشتری، گزارش خرابی دستگاه، دسته اضافی و...)"
            rows={1}
            className="w-full text-[11px] px-2.5 py-1.5 bg-surface-07090d hover:bg-surface-0b0e14 focus:bg-surface-0b0e14 border border-white/5 hover:border-white/10 focus:border-blue-500/30 rounded-xl text-slate-300 placeholder-slate-600 focus:outline-none transition-all resize-none h-10 font-sans leading-normal text-right"
          />
        </div>

        {/* Customer Info Edit Modal (List View) */}
        {isEditingCustomer && system.activeSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-surface-121620 border border-blue-500/40 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-right animate-in zoom-in-95 duration-150" dir="rtl">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                  <User className="w-4 h-4 text-blue-400" />
                  <span>ویرایش / ثبت اطلاعات مشتری</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingCustomer(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCustomerInfo} className="space-y-3.5">
                <div>
                  <label className="text-[11px] text-slate-300 font-bold block mb-1">
                    نام و نام خانوادگی مشتری:
                  </label>
                  <input
                    type="text"
                    value={tempCustomerName}
                    onChange={(e) => setTempCustomerName(e.target.value)}
                    className="w-full bg-surface-080a0f border border-white/10 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    placeholder="مثال: علی رضایی"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-300 font-bold block mb-1">
                    شماره موبایل / تماس مشتری:
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      dir="ltr"
                      value={tempCustomerPhone}
                      onChange={(e) => setTempCustomerPhone(e.target.value)}
                      className="w-full bg-surface-080a0f border border-white/10 focus:border-blue-500 rounded-xl px-3 py-2 pl-9 text-xs text-white font-mono focus:outline-none text-left"
                      placeholder="09123456789"
                    />
                    <Phone className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    شماره تماس جهت ثبت فاکتور، یادآوری زمان و مدیریت حساب استفاده می‌شود.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
                  >
                    ذخیره اطلاعات
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingCustomer(false)}
                    className="px-4 py-2 bg-surface-080a0f hover:bg-white/10 text-slate-300 text-xs rounded-xl border border-white/10 transition-all cursor-pointer"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirmation Modal for Controller Count Change (List View) */}
        {pendingPlayerCount !== null && system.activeSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-surface-121620 border border-blue-500/40 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-right animate-in zoom-in-95 duration-150" dir="rtl">
              <div className="flex items-center gap-2.5 text-blue-400 font-bold text-sm border-b border-white/10 pb-2.5">
                <ArrowRightLeft className="w-4 h-4 text-blue-400" />
                <span>تایید تغییر تعداد دسته</span>
              </div>

              <div className="text-xs text-slate-300 leading-relaxed space-y-2.5">
                <p>
                  آیا از تغییر تعداد دسته سیستم <strong className="text-white font-bold">{system.name}</strong> از{' '}
                  <span className="text-amber-400 font-bold font-mono">{system.activeSession.playersCount} دسته</span> به{' '}
                  <span className="text-blue-400 font-bold font-mono">{pendingPlayerCount} دسته</span> اطمینان دارید؟
                </p>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5 text-[11px] text-blue-300">
                  💡 تعرفه محاسبه هزینه از این لحظه به بعد بر اساس نرخ {pendingPlayerCount} دسته محاسبه و در تاریخچه زمان‌های بازی ثبت خواهد شد.
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (onChangePlayersCount && pendingPlayerCount) {
                      onChangePlayersCount(system.id, pendingPlayerCount);
                    }
                    setPendingPlayerCount(null);
                  }}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
                >
                  تایید و تغییر
                </button>
                <button
                  type="button"
                  onClick={() => setPendingPlayerCount(null)}
                  className="px-4 py-2 bg-surface-080a0f hover:bg-white/10 text-slate-300 text-xs rounded-xl border border-white/10 transition-all cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Partial Payment Modal (List View) */}
        {showPartialPaymentModal && system.activeSession && onAddPartialPayment && (
          <PartialPaymentModal
            isOpen={showPartialPaymentModal}
            onClose={() => setShowPartialPaymentModal(false)}
            system={system}
            systemRates={systemRates}
            cardReaders={cardReaders}
            onAddPartialPayment={(systemId, payment, reducePlayerCount) => {
              onAddPartialPayment(systemId, payment, reducePlayerCount);
              setShowPartialPaymentModal(false);
            }}
            onRemovePartialPayment={onRemovePartialPayment}
          />
        )}

      </div>
    );
  }

  // Otherwise, GRID list layout
  const g = gridStyles[cardSize];

  return (
    <div 
      className={`relative flex flex-col justify-between border shadow-lg transition-all duration-300 ${g.container} ${
        isActive
          ? isPaused
            ? 'bg-surface-151921 border-amber-500/30'
            : isLimitReached
              ? 'bg-surface-181115 border-rose-500/60 ring-2 ring-rose-500/30 animate-pulse'
              : 'bg-surface-151921 border-blue-500/30 ring-1 ring-blue-500/10'
          : system.status === 'inactive'
            ? 'bg-surface-151921/60 border-white/5 opacity-50 grayscale text-slate-500'
            : 'bg-surface-151921 border-white/5 hover:border-white/10'
      }`}
      id={`system-card-${system.id}`}
      dir="rtl"
    >
      {/* Dynamic Status bar wrapper */}
      <div className="absolute top-0 right-0 left-0 h-1 flex rounded-t-[inherit] overflow-hidden">
        {isActive ? (
          isPaused ? (
            <div className="bg-amber-500 w-full h-full animate-pulse"></div>
          ) : isLimitReached ? (
            <div className="bg-rose-500 w-full h-full animate-pulse"></div>
          ) : (
            <div className="bg-blue-500 w-full h-full animate-pulse"></div>
          )
        ) : system.status === 'free' ? (
          <div className="bg-emerald-500 w-full h-full opacity-60"></div>
        ) : (
          <div className="bg-slate-700 w-full h-full opacity-30"></div>
        )}
      </div>

      {/* Card Header */}
      <div className={`p-4 pt-5 flex items-start justify-between ${g.hSpacing}`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className={`text-white tracking-tight ${g.titleText}`}>{system.name}</h4>
            <span className={`rounded-md border ${consoleColorClass} ${g.badgeText}`}>
              {system.type}
            </span>
          </div>
          <div className={`flex items-center gap-1.5 ${g.indicatorText}`}>
            {isActive ? (
              isPaused ? (
                <span className="flex items-center gap-1 text-amber-400 font-medium font-sans">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                  {system.activeSession?.isPowerOutagePaused ? '⚡ متوقف در قطعی برق' : 'توقف موقت بازی'}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-blue-400 font-medium font-sans animate-pulse">
                  <Flame className="w-3.5 h-3.5 fill-blue-500/10" />
                  در حال بازی
                </span>
              )
            ) : system.status === 'free' ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium font-sans">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                آزاد و آماده پذیرش
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-500 font-medium font-sans">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                خارج از سرویس
              </span>
            )}
          </div>
        </div>

        {/* Console Type & Custom Timer controls on the left */}
        <div className="flex items-center gap-1.5">
          {isActive && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTimerMenu(!showTimerMenu)}
                className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                  limitType !== 'none'
                    ? isLimitReached
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse'
                      : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                    : 'bg-slate-800/40 border-white/5 hover:border-white/10 text-slate-400 hover:text-slate-200'
                }`}
                title="تایمر دلخواه"
              >
                <Clock className="w-3.5 h-3.5" />
                {limitType !== 'none' && (
                  <span className="font-mono">
                    {limitType === 'time' ? (
                      `${limitValue}m`
                    ) : (() => {
                      const pCount = system.activeSession?.playersCount || 1;
                      let hRate = systemRates.hourlyRate1P;
                      if (pCount === 2) hRate = systemRates.hourlyRate2P;
                      else if (pCount === 3) hRate = systemRates.hourlyRate3P;
                      else if (pCount === 4) hRate = systemRates.hourlyRate4P;
                      const totalMins = hRate > 0 ? Math.round((limitValue / hRate) * 60) : 0;
                      return `${formatCurrency(limitValue)} (${toPersianDigits(totalMins)}m)`;
                    })()}
                  </span>
                )}
              </button>

              {/* Popover / Mini Menu */}
              {showTimerMenu && (
                <div className="absolute left-0 mt-1.5 w-64 bg-surface-0f1219/98 border border-white/10 rounded-xl p-3 shadow-2xl z-40 text-right font-sans cursor-default normal-case tracking-normal">
                  <div className="text-[11px] text-zinc-300 font-bold border-b border-white/5 pb-1.5 mb-2.5 flex items-center justify-between">
                    <span>تنظیم تایمر دلخواه مشتری</span>
                    <button 
                      type="button" 
                      onClick={() => setShowTimerMenu(false)}
                      className="text-slate-500 hover:text-slate-300 text-[11px] font-bold px-1"
                    >
                      ×
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1 mb-2.5 bg-black/30 p-0.5 rounded-lg border border-white/5">
                    <button
                      type="button"
                      onClick={() => setTempType('none')}
                      className={`py-1 text-[9px] rounded font-semibold transition-all ${
                        tempType === 'none' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      غیرفعال
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTempType('time');
                        if (tempValue === '0' || !tempValue) setTempValue('60');
                        if ('Notification' in window && Notification.permission === 'default') {
                          Notification.requestPermission();
                        }
                      }}
                      className={`py-1 text-[9px] rounded font-semibold transition-all ${
                        tempType === 'time' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      زمان (min)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTempType('amount');
                        if (tempValue === '0' || !tempValue) setTempValue('50000');
                        if ('Notification' in window && Notification.permission === 'default') {
                          Notification.requestPermission();
                        }
                      }}
                      className={`py-1 text-[9px] rounded font-semibold transition-all ${
                        tempType === 'amount' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      مبلغ (تومان)
                    </button>
                  </div>

                  {tempType !== 'none' && (
                    <div className="space-y-1.5 mb-2.5">
                      <label className="text-[10px] text-slate-400 block text-right">
                        {tempType === 'time' ? 'مقدار زمان (دقیقه):' : 'مبلغ هدف (تومان):'}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          dir="ltr"
                          value={tempValue}
                          onChange={(e) => setTempValue(e.target.value)}
                          className="w-full bg-surface-050608 border border-white/10 rounded-lg pr-2.5 pl-14 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                          placeholder={tempType === 'time' ? 'مثال: 60' : 'مثال: 50000'}
                          min="1"
                        />
                        {tempType === 'amount' && (
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500">تومان</span>
                        )}
                        {tempType === 'time' && (
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500">دقیقه</span>
                        )}
                      </div>

                      {/* Calculated Target Cost preview according to hourly rates when choosing time */}
                      {tempType === 'time' && Number(tempValue) > 0 && (() => {
                        const pCount = system.activeSession?.playersCount || 1;
                        let hourlyRate = systemRates.hourlyRate1P;
                        if (pCount === 2) hourlyRate = systemRates.hourlyRate2P;
                        else if (pCount === 3) hourlyRate = systemRates.hourlyRate3P;
                        else if (pCount === 4) hourlyRate = systemRates.hourlyRate4P;
                        const targetCalculatedCost = Math.round((hourlyRate / 60) * Number(tempValue));
                        return (
                          <div className="flex items-center justify-between bg-blue-950/40 border border-blue-500/30 px-2 py-1.5 rounded-lg text-[10px] text-blue-300">
                            <span className="text-slate-400">مبلغ هدف ({toPersianDigits(pCount)} دسته):</span>
                            <span className="font-mono font-bold text-blue-300">{formatCurrency(targetCalculatedCost)}</span>
                          </div>
                        );
                      })()}

                      {/* Calculated Playable Minutes preview according to hourly rates when choosing amount */}
                      {tempType === 'amount' && Number(tempValue) > 0 && (() => {
                        const pCount = system.activeSession?.playersCount || 1;
                        let hourlyRate = systemRates.hourlyRate1P;
                        if (pCount === 2) hourlyRate = systemRates.hourlyRate2P;
                        else if (pCount === 3) hourlyRate = systemRates.hourlyRate3P;
                        else if (pCount === 4) hourlyRate = systemRates.hourlyRate4P;

                        if (!hourlyRate || hourlyRate <= 0) {
                          return (
                            <div className="bg-amber-950/40 border border-amber-500/30 p-2 rounded-lg text-[10px] text-amber-300">
                              نرخ ساعتی برای {pCount} دسته تعریف نشده است.
                            </div>
                          );
                        }

                        const rawMinutes = (Number(tempValue) / hourlyRate) * 60;
                        const roundedMins = Math.round(rawMinutes);
                        const totalWholeMins = Math.floor(rawMinutes);
                        const remainingSeconds = Math.round((rawMinutes - totalWholeMins) * 60);
                        const hours = Math.floor(totalWholeMins / 60);
                        const minsInHour = totalWholeMins % 60;

                        let formattedTime = '';
                        if (hours > 0 && minsInHour > 0) {
                          formattedTime = `${toPersianDigits(hours)} ساعت و ${toPersianDigits(minsInHour)} دقیقه`;
                        } else if (hours > 0) {
                          formattedTime = `${toPersianDigits(hours)} ساعت کامل`;
                        } else {
                          formattedTime = `${toPersianDigits(totalWholeMins)} دقیقه`;
                        }

                        return (
                          <div className="space-y-1.5 bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-xl text-right animate-in fade-in duration-150">
                            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                              <span className="text-[10px] text-slate-300 font-bold flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                <span>زمان مجاز بازی ({toPersianDigits(pCount)} دسته):</span>
                              </span>
                              <span className="text-xs font-black text-emerald-300 font-mono">
                                {toPersianDigits(roundedMins)} دقیقه
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400">معادل دقیق:</span>
                              <span className="font-bold text-white">
                                {formattedTime}
                                {remainingSeconds > 0 && hours === 0 && ` و ${toPersianDigits(remainingSeconds)} ثانیه`}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[9px] text-slate-400 pt-0.5">
                              <span>نرخ ساعتی {pCount} دسته:</span>
                              <span className="font-mono text-slate-300">{formatCurrency(hourlyRate)}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {tempType === 'amount' && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[9px] text-slate-400 block text-right">مبالغ سریع:</span>
                          <div className="flex flex-wrap gap-1 justify-end" dir="rtl">
                            {[20000, 30000, 50000, 70000, 100000, 150000].map((amt) => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => setTempValue(String(amt))}
                                className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-600/30 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/30 rounded text-[9px] font-sans transition-all cursor-pointer font-mono"
                              >
                                {toPersianDigits(amt >= 1000 ? `${amt / 1000} هزار` : `${amt}`)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {tempType === 'time' && presetTimerMinutes && presetTimerMinutes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 justify-end" dir="rtl">
                          {presetTimerMinutes.map((mins) => {
                            let label = `${mins}m`;
                            if (mins === 30) label = "۳۰ دقیقه";
                            else if (mins === 45) label = "۴۵ دقیقه";
                            else if (mins === 60) label = "۱ ساعت";
                            else if (mins === 90) label = "۱.۵ ساعت";
                            else if (mins === 120) label = "۲ ساعت";
                            else label = `${mins} دقیقه`;
                            
                            return (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => setTempValue(String(mins))}
                                className="px-2 py-0.5 bg-blue-500/10 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-500/30 rounded text-[9px] font-sans transition-all cursor-pointer"
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={handleSaveTimer}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold py-1.5 rounded-lg transition-all"
                  >
                    ثبت و ذخیره
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Console Type Icon graphic */}
          <div className={`bg-surface-0b0e14 border border-white/5 ${g.iconBox}`}>
            <Monitor className={`${g.iconSize} ${
              isActive ? (isPaused ? 'text-amber-500' : isLimitReached ? 'text-rose-500 animate-pulse' : 'text-accent') : system.status === 'free' ? 'text-emerald-500' : 'text-slate-600'
            }`} />
          </div>
        </div>
      </div>

      {/* Card Content & Timer area */}
      <div className={`border-white/5 bg-surface-0b0e14/40 ${g.contentPadding}`}>
        {isActive && system.activeSession ? (
          <div className={`w-full ${g.contentSpacing}`}>
            {/* Players Controller count badge */}
            <div className={`flex justify-between items-center ${g.playersLabel}`}>
              <span>تعداد دسته:</span>
              <div className="flex items-center gap-1 bg-surface-090c11 p-0.5 border border-white/5 rounded-lg">
                {([1, 2, 3, 4] as const).map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => handlePlayerCountClick(count)}
                    className={`rounded font-bold transition-all cursor-pointer ${g.playersBtn} ${
                      system.activeSession.playersCount === count
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Running Timer Display */}
            {isEditingTime ? (
              <div className="flex flex-col items-center bg-surface-121620 border-2 border-blue-500 rounded-xl p-2.5 space-y-2 z-20 w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between w-full gap-2 border-b border-white/10 pb-1 mb-1">
                  <span className="text-blue-400 text-[10px] font-bold shrink-0">ویرایش دستی زمان (دقیقه)</span>
                  <button
                    type="button"
                    onClick={() => setIsEditingTime(false)}
                    className="text-slate-400 hover:text-white text-sm font-bold px-1 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
                
                {/* Direct Number Input */}
                <div className="flex items-center gap-1.5 w-full">
                  <input
                    type="number"
                    min="0"
                    max="1440"
                    value={tempMinutes}
                    onChange={(e) => setTempMinutes(e.target.value)}
                    className="flex-1 bg-surface-080a0f border border-blue-500/50 rounded-lg py-1 px-2 text-center text-white text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="دقیقه"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const mins = parseInt(tempMinutes, 10);
                      if (!isNaN(mins) && mins >= 0 && onAdjustSessionTime) {
                        onAdjustSessionTime(system.id, mins);
                        setIsEditingTime(false);
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-1 px-3 text-[10px] font-bold transition-all cursor-pointer shadow-md"
                  >
                    ثبت
                  </button>
                </div>

                {/* Quick adjustments */}
                <div className="grid grid-cols-4 gap-1 w-full pt-1">
                  {[-10, -5, +5, +10].map((offset) => (
                    <button
                      key={offset}
                      type="button"
                      onClick={() => {
                        const current = parseInt(tempMinutes, 10) || 0;
                        const next = Math.max(0, current + offset);
                        setTempMinutes(next.toString());
                      }}
                      className="bg-surface-1a202c hover:bg-blue-600/30 text-slate-200 text-[9px] font-mono font-bold py-1 rounded-md border border-white/10 cursor-pointer transition-colors"
                    >
                      {offset > 0 ? `+${offset}` : offset}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div 
                onClick={() => {
                  setTempMinutes(Math.round(metrics.elapsedMs / 60000).toString());
                  setIsEditingTime(true);
                }}
                className={`flex flex-col items-center bg-surface-0b0e14 border border-white/10 relative overflow-hidden group transition-all hover:bg-surface-0f1219 hover:border-blue-500/50 cursor-pointer ${g.timerBox}`}
                title="برای ویرایش دستی زمان بازی کلیک کنید"
              >
                <div className="flex items-center gap-1.5 justify-center w-full">
                  <span className="text-slate-400 text-[9px] font-medium tracking-wider uppercase transition-colors flex items-center gap-1 group-hover:text-blue-400">
                    <span>زمان بازی سپری‌شده</span>
                    <Clock className="w-2.5 h-2.5 text-slate-400 group-hover:text-blue-400" />
                  </span>
                  <span className="text-[8px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded shadow-sm opacity-90 group-hover:opacity-100 transition-opacity">
                    ✎ ویرایش
                  </span>
                </div>
                <span className={`font-mono text-slate-100 py-0.5 animate-pulse group-hover:text-blue-400 ${g.timerVal} transition-colors`}>
                  {formatDuration(metrics.elapsedMs)}
                </span>
                <div className="absolute inset-0 bg-surface-0e121c opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                  <span className="text-[9px] text-white bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg font-bold shadow-lg border border-blue-400/40">
                    ✎ ویرایش دستی زمان
                  </span>
                </div>
              </div>
            )}

            {/* Custom Timer Remaining Progress / Indicator (Collapsible on idle, Expands on hover) */}
            {limitType !== 'none' && limitValue > 0 && (
              <div 
                onMouseEnter={() => setIsTimerHovered(true)}
                onMouseLeave={() => setIsTimerHovered(false)}
                onClick={() => setIsTimerHovered(!isTimerHovered)}
                className={`rounded-xl text-xs flex flex-col justify-between border transition-all duration-200 cursor-pointer overflow-hidden ${
                  isLimitReached
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 animate-pulse'
                    : 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30'
                } ${isTimerHovered ? 'p-2.5 space-y-2 shadow-lg ring-1 ring-emerald-500/20' : 'p-1.5 px-2.5 space-y-1'}`}
                title="برای مشاهده یا بستن جزئیات تایمر، موس را روی این کادر ببرید یا کلیک کنید"
              >
                {/* Collapsed Bar View (Always visible top row) */}
                <div className="flex justify-between items-center text-[10px]">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Clock className={`w-3.5 h-3.5 shrink-0 ${isLimitReached ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
                    <span className="text-slate-400 font-sans font-medium">تایمر دلخواه:</span>
                    <span className={isLimitReached ? 'text-rose-400 font-black animate-pulse' : 'text-emerald-300 font-mono font-bold'}>
                      {isLimitReached ? (
                        '⚠️ پایان وقت بازی'
                      ) : limitType === 'time' ? (
                        `${Math.max(0, Math.ceil(limitValue - metrics.elapsedMs / 60000))} دقیقه مانده`
                      ) : (
                        `${formatCurrency(Math.max(0, limitValue - metrics.gamePlayCost))} مانده`
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[9px] text-slate-400 font-sans">
                    <span className="opacity-75">{isTimerHovered ? 'بستن' : 'جزئیات'}</span>
                    {isTimerHovered ? (
                      <ChevronUp className="w-3 h-3 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                    )}
                  </div>
                </div>

                {/* Mini thin progress line when collapsed */}
                {!isTimerHovered && !isLimitReached && (
                  <div className="w-full bg-surface-050608 h-1 rounded-full overflow-hidden border border-white/5 opacity-80">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-1000"
                      style={{ 
                        width: `${Math.min(100, Math.max(0, (limitType === 'time' ? (metrics.elapsedMs / (limitValue * 60000)) * 100 : (metrics.gamePlayCost / limitValue) * 100)))}%` 
                      }}
                    />
                  </div>
                )}

                {/* Expanded Details (Revealed on hover) */}
                {isTimerHovered && (
                  <div className="space-y-1.5 pt-1.5 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>نوع محدودیت:</span>
                      <span className="font-bold text-slate-300">
                        {limitType === 'time' ? 'محدودیت زمانی (دقیقه)' : 'محدودیت هزینه (مبلغ)'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center font-mono font-bold text-[10.5px]">
                      <span className="text-slate-400 font-sans font-normal text-[10px]">هدف تعیین‌شده:</span>
                      <span className="text-slate-200">
                        {limitType === 'time' ? (
                          <span>
                            {limitValue} دقیقه
                            {(() => {
                              const pCount = system.activeSession?.playersCount || 1;
                              let hr = systemRates.hourlyRate1P;
                              if (pCount === 2) hr = systemRates.hourlyRate2P;
                              else if (pCount === 3) hr = systemRates.hourlyRate3P;
                              else if (pCount === 4) hr = systemRates.hourlyRate4P;
                              const targetPrice = Math.round((hr / 60) * limitValue);
                              return ` (${formatCurrency(targetPrice)})`;
                            })()}
                          </span>
                        ) : `${formatCurrency(limitValue)}`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center font-mono font-bold text-[10.5px]">
                      <span className="text-slate-400 font-sans font-normal text-[10px]">باقی‌مانده دقیق:</span>
                      <span className={isLimitReached ? 'text-rose-500 font-extrabold text-[12px] animate-pulse' : 'text-emerald-400'}>
                        {isLimitReached ? (
                          '⚠️ پایان وقت بازی'
                        ) : limitType === 'time' ? (
                          `${Math.max(0, Math.ceil(limitValue - metrics.elapsedMs / 60000))} دقیقه`
                        ) : (
                          `${formatCurrency(Math.max(0, limitValue - metrics.gamePlayCost))}`
                        )}
                      </span>
                    </div>
                    {!isLimitReached && (
                      <div className="w-full bg-surface-050608 h-1.5 rounded-full mt-1.5 overflow-hidden border border-white/5">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-1000"
                          style={{ 
                            width: `${Math.min(100, Math.max(0, (limitType === 'time' ? (metrics.elapsedMs / (limitValue * 60000)) * 100 : (metrics.gamePlayCost / limitValue) * 100)))}%` 
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Live Financial Cost Progress Bar */}
            <div className={`bg-surface-0b0e14/30 border border-white/5 ${g.financialBoxPadding} ${g.financialBoxSpacing}`}>
              <div className="flex justify-between items-center text-slate-400">
                <span>هزینه زمان بازی:</span>
                <span className="font-mono text-slate-200 font-semibold">{formatCurrency(metrics.gamePlayCost)}</span>
              </div>

              {/* Detailed segment breakdown & connected items */}
              {segments.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/5 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                    className="flex items-center justify-between w-full gap-2 text-[10px] text-slate-400 hover:text-slate-200 bg-slate-900/45 hover:bg-slate-900/70 px-2.5 py-1.5 rounded-lg border border-white/5 cursor-pointer transition-all font-bold"
                  >
                    <div className="flex items-center gap-1.5">
                      <History className="w-3 h-3 text-slate-400" />
                      <span>تاریخچه و ریز حساب ({segments.length} بخش{metrics.buffetCost > 0 ? ' + بوفه' : ''}{metrics.extraServicesCost > 0 ? ' + خدمات' : ''})</span>
                    </div>
                    {isHistoryExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                  </button>

                  {isHistoryExpanded && (
                    <div className="space-y-1 animate-fade-in pt-0.5">
                      {segments.map((seg, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] bg-slate-900/60 dark:bg-slate-900/40 px-2 py-1 rounded shadow-sm border border-white/5">
                          <div className="flex items-center gap-1 text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500/60"></span>
                            <span>{seg.playersCount} دسته ({seg.minutes} دقیقه):</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-slate-300">{formatCurrency(seg.cost)}</span>
                            {onDeleteSessionSegment && (
                              <button
                                type="button"
                                onClick={() => onDeleteSessionSegment(system.id, idx)}
                                className="p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded cursor-pointer transition-all active:scale-90"
                                title={`حذف و صفر کردن این بخش (${seg.playersCount} نفره)`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {metrics.buffetCost > 0 && (
                        <div className="flex justify-between items-center text-[11px] bg-slate-900/60 dark:bg-slate-900/40 px-2 py-1 rounded shadow-sm border border-white/5">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500/60"></span>
                            <span>🍿 بوفه متصل ({toPersianDigits(system.activeSession?.buffetItems.reduce((acc, i) => acc + i.quantity, 0) || 0)} قلم):</span>
                          </div>
                          <span className="font-mono text-blue-400 font-semibold flex items-center gap-0.5">
                            +{formatCurrency(metrics.buffetCost)}
                          </span>
                        </div>
                      )}

                      {metrics.extraServicesCost > 0 && (
                        <div className="flex justify-between items-center text-[11px] bg-slate-900/60 dark:bg-slate-900/40 px-2 py-1 rounded shadow-sm border border-white/5">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60"></span>
                            <span>✨ خدمات و تجهیزات ({toPersianDigits(system.activeSession?.extraServices?.reduce((acc, i) => acc + i.quantity, 0) || 0)} مورد):</span>
                          </div>
                          <span className="font-mono text-amber-400 font-semibold flex items-center gap-0.5">
                            +{formatCurrency(metrics.extraServicesCost)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="h-px bg-white/5 my-1"></div>
              <div className="flex justify-between items-center font-bold text-slate-100">
                <span>مجموع حساب فعلی:</span>
                <span className={g.totalCostVal}>{formatCurrency(metrics.totalCost)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500 text-xs space-y-2">
            <p className="font-medium">آماده ثبت شروع بازی جدید</p>
            {system.status === 'free' && (
              <p className="text-[9px] text-slate-650 max-w-[200px] mx-auto leading-relaxed">
                روی دکمه شروع کلیک کنید تا جلسه بازی با نرخ اختصاصی سیستم آغاز شود.
              </p>
            )}
          </div>
        )}

        {/* Note (یادداشت) Section */}
        <div className="mt-3.5 pt-3 border-t border-white/5 space-y-1.5 text-right" dir="rtl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 select-none">
              <span>📝 یادداشت سیستم / مشتری</span>
            </span>
            {system.note && (
              <button
                type="button"
                onClick={() => onUpdateNote && onUpdateNote(system.id, '')}
                className="text-[9px] text-rose-400 hover:text-rose-300 font-bold transition-colors cursor-pointer select-none"
                title="پاک کردن یادداشت"
              >
                پاک کردن
              </button>
            )}
          </div>
          <textarea
            value={system.note || ''}
            onChange={(e) => onUpdateNote && onUpdateNote(system.id, e.target.value)}
            placeholder="ثبت یادداشت (تلفن مشتری، گزارش خرابی دستگاه، دسته اضافی و...)"
            rows={1}
            className="w-full text-[11px] px-2.5 py-1.5 bg-surface-07090d hover:bg-surface-0b0e14 focus:bg-surface-0b0e14 border border-white/5 hover:border-white/10 focus:border-blue-500/30 rounded-xl text-slate-300 placeholder-slate-650 focus:outline-none transition-all resize-none h-10 font-sans leading-normal text-right"
          />
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className={`bg-surface-0b0e14/50 flex flex-col ${g.footerPadding}`}>
        {isActive ? (
          <div className="flex items-center gap-1.5 w-full relative">
            {/* Play / Pause */}
            {isPaused ? (
              <button
                type="button"
                onClick={() => onResumeSession(system.id)}
                className={`flex-1 bg-blue-600/15 hover:bg-blue-600 hover:text-white text-blue-400 border border-blue-600/20 active:scale-[0.97] font-bold flex items-center justify-center transition-all cursor-pointer ${g.btnUpper}`}
                title="ادامه بازی (شروع تایمر)"
              >
                <Play className={`fill-current ${g.btnIcon}`} />
                <span>ادامه</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onPauseSession(system.id)}
                className={`flex-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/20 active:scale-[0.97] font-bold flex items-center justify-center transition-all cursor-pointer ${g.btnUpper}`}
                title="توقف موقت تایمر"
              >
                <Pause className={`fill-current ${g.btnIcon}`} />
                <span>توقف</span>
              </button>
            )}

            {/* Settle Receipt Button */}
            <button
              type="button"
              onClick={() => onEndSession(system.id)}
              className={`flex-[2] bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white font-bold transition-all border border-rose-500/20 hover:border-rose-600 flex items-center justify-center cursor-pointer ${g.btnUpper}`}
            >
              <Receipt className={g.btnIcon} />
              <span>تسویه‌حساب</span>
            </button>

            {/* More Options Dropdown Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className={`bg-surface-0b0e14 hover:bg-surface-151921 border border-white/10 hover:border-amber-500/30 text-slate-200 flex items-center justify-center transition-all cursor-pointer ${g.btnUpper} ${showMoreMenu ? 'border-amber-500/50 bg-surface-151921' : ''}`}
                title="گزینه‌های بیشتر"
              >
                <MoreVertical className={g.btnIcon} />
                <span>بیشتر</span>
              </button>

              {/* More Menu Dropdown Content */}
              {showMoreMenu && (
                <div className="absolute left-0 bottom-full mb-1.5 w-60 bg-surface-121620 border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 space-y-1 text-right animate-in fade-in zoom-in-95 duration-100" dir="rtl">
                  <button
                    type="button"
                    onClick={() => { setShowMoreMenu(false); onAddBuffet(system.id); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-white/5 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>ثبت سفارش بوفه (بوفه+)</span>
                  </button>

                  {onAddExtraService && (
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); onAddExtraService(system.id); }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-white/5 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>خدمات و تجهیزات جانبی (خدمات+)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => { setShowMoreMenu(false); handleOpenCustomerEdit(); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-white/5 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    <User className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>ویرایش نام / شماره مشتری</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowMoreMenu(false); setShowPartialPaymentModal(true); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-white/5 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>ثبت پرداخت بخشی / بیعانه</span>
                  </button>

                  {onTransferSession && (
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); onTransferSession(system.id); }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-white/5 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      <ArrowRightLeft className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>انتقال حساب به سیستم دیگر</span>
                    </button>
                  )}

                  <div className="h-px bg-white/5 my-1"></div>

                  <button
                    type="button"
                    onClick={() => { setShowMoreMenu(false); onResetSession(system.id); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-white/5 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>ریست تایمر از صفر</span>
                  </button>

                  {onCancelSession && (
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); onCancelSession(system.id); }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>انصراف بدون پرداخت (لغو جلسه)</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : system.status === 'free' ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onStartSession(system.id)}
              className={`bg-accent/10 text-accent border border-accent/25 hover:bg-accent hover:text-[#05221a] rounded-xl transition-all font-bold active:scale-[0.97] flex items-center justify-center cursor-pointer ${g.btnUpper}`}
            >
              <Play className={`fill-current ${g.btnIcon}`} />
              شروع بازی
            </button>
            <button
              type="button"
              onClick={() => onChangeStatus(system.id, 'inactive')}
              className={`bg-surface-0b0e14 border border-white/5 hover:border-white/15 hover:text-slate-300 text-slate-400 rounded-xl transition-all active:scale-[0.97] cursor-pointer ${g.btnUpper}`}
            >
              غیرفعال‌سازی
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onChangeStatus(system.id, 'free')}
            className={`bg-surface-0b0e14 hover:bg-surface-151921 border border-white/5 hover:border-white/15 text-slate-200 font-semibold rounded-xl transition-all active:scale-[0.97] flex items-center justify-center cursor-pointer ${g.btnLower}`}
          >
            <CheckCircle className={`text-emerald-400 ${g.btnIcon}`} />
            فعال‌سازی مجدد و بازگشت به مدار
          </button>
        )}
      </div>

      {/* Customer Info Edit Modal */}
      {isEditingCustomer && system.activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-surface-121620 border border-blue-500/40 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-right animate-in zoom-in-95 duration-150" dir="rtl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                <User className="w-4 h-4 text-blue-400" />
                <span>ویرایش / ثبت اطلاعات مشتری</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingCustomer(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerInfo} className="space-y-3.5">
              <div>
                <label className="text-[11px] text-slate-300 font-bold block mb-1">
                  نام و نام خانوادگی مشتری:
                </label>
                <input
                  type="text"
                  value={tempCustomerName}
                  onChange={(e) => setTempCustomerName(e.target.value)}
                  className="w-full bg-surface-080a0f border border-white/10 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  placeholder="مثال: علی رضایی"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-bold block mb-1">
                  شماره موبایل / تماس مشتری:
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    dir="ltr"
                    value={tempCustomerPhone}
                    onChange={(e) => setTempCustomerPhone(e.target.value)}
                    className="w-full bg-surface-080a0f border border-white/10 focus:border-blue-500 rounded-xl px-3 py-2 pl-9 text-xs text-white font-mono focus:outline-none text-left"
                    placeholder="09123456789"
                  />
                  <Phone className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  شماره تماس جهت ثبت فاکتور، یادآوری زمان و مدیریت حساب استفاده می‌شود.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
                >
                  ذخیره اطلاعات
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingCustomer(false)}
                  className="px-4 py-2 bg-surface-080a0f hover:bg-white/10 text-slate-300 text-xs rounded-xl border border-white/10 transition-all cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Controller Count Change */}
      {pendingPlayerCount !== null && system.activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-surface-121620 border border-blue-500/40 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-right animate-in zoom-in-95 duration-150" dir="rtl">
            <div className="flex items-center gap-2.5 text-blue-400 font-bold text-sm border-b border-white/10 pb-2.5">
              <ArrowRightLeft className="w-4 h-4 text-blue-400" />
              <span>تایید تغییر تعداد دسته</span>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed space-y-2.5">
              <p>
                آیا از تغییر تعداد دسته سیستم <strong className="text-white font-bold">{system.name}</strong> از{' '}
                <span className="text-amber-400 font-bold font-mono">{system.activeSession.playersCount} دسته</span> به{' '}
                <span className="text-blue-400 font-bold font-mono">{pendingPlayerCount} دسته</span> اطمینان دارید؟
              </p>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5 text-[11px] text-blue-300">
                💡 تعرفه محاسبه هزینه از این لحظه به بعد بر اساس نرخ {pendingPlayerCount} دسته محاسبه و در تاریخچه زمان‌های بازی ثبت خواهد شد.
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (onChangePlayersCount && pendingPlayerCount) {
                    onChangePlayersCount(system.id, pendingPlayerCount);
                  }
                  setPendingPlayerCount(null);
                }}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
              >
                تایید و تغییر
              </button>
              <button
                type="button"
                onClick={() => setPendingPlayerCount(null)}
                className="px-4 py-2 bg-surface-080a0f hover:bg-white/10 text-slate-300 text-xs rounded-xl border border-white/10 transition-all cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Payment Modal */}
      {showPartialPaymentModal && system.activeSession && onAddPartialPayment && (
        <PartialPaymentModal
          isOpen={showPartialPaymentModal}
          onClose={() => setShowPartialPaymentModal(false)}
          system={system}
          systemRates={systemRates}
          cardReaders={cardReaders}
          onAddPartialPayment={(systemId, payment, reducePlayerCount) => {
            onAddPartialPayment(systemId, payment, reducePlayerCount);
            setShowPartialPaymentModal(false);
          }}
          onRemovePartialPayment={onRemovePartialPayment}
        />
      )}

      {/* Live Pre-Invoice Modal */}
      {showLiveInvoiceModal && liveInvoiceData && (
        <InvoiceReceiptModal
          isOpen={showLiveInvoiceModal}
          onClose={() => setShowLiveInvoiceModal(false)}
          invoice={liveInvoiceData}
        />
      )}
    </div>
  );
}
