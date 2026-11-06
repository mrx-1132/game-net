import React, { useState } from 'react';
import { 
  X, AlertTriangle, CircleDollarSign, Calendar, TrendingUp, 
  Clock, DollarSign, CreditCard, BookOpen, RefreshCw, CheckCircle2, Lock, Send
} from 'lucide-react';
import { SessionHistory, DirectBuffetSale, DailyWorkingDayBackup, UserPermissions, SystemLog, TelegramConfig } from '../types';
import { formatCurrency, toPersianDigits } from '../utils';

interface CloseWorkingDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmCloseDay: (notes: string, selectedDatePersian: string) => void;
  history: SessionHistory[];
  directSales: DirectBuffetSale[];
  systemLogs?: SystemLog[];
  userRole: 'admin' | 'user';
  userPermissions?: UserPermissions;
  dailyBackups: DailyWorkingDayBackup[];
  telegramConfig?: TelegramConfig;
}

export default function CloseWorkingDayModal({
  isOpen,
  onClose,
  onConfirmCloseDay,
  history,
  directSales,
  systemLogs = [],
  userRole,
  userPermissions,
  dailyBackups = [],
  telegramConfig,
}: CloseWorkingDayModalProps) {
  const [notes, setNotes] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Generate date formats
  const todayDate = new Date();
  const todayPersian = todayDate.toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayPersian = yesterdayDate.toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const yesterdayLabel = yesterdayDate.toLocaleDateString('fa-IR', {
    day: 'numeric',
    month: 'long',
  });

  const todayLabel = todayDate.toLocaleDateString('fa-IR', {
    day: 'numeric',
    month: 'long',
  });

  const currentHour = new Date().getHours();
  // Midnight block: hour 0 to 5 (e.g. 12:00 AM up to 5:59 AM)
  const isPastMidnight = currentHour >= 0 && currentHour < 6;

  // Let's set default selected date. If past midnight, typically games start the previous evening, so default to yesterday's Persian date
  const [selectedDatePersian, setSelectedDatePersian] = useState(isPastMidnight ? yesterdayPersian : todayPersian);

  if (!isOpen) return null;

  // Check if the current chosen Persian Date is already closed previously
  const isAlreadyClosed = dailyBackups.some(b => b.workingDatePersian === selectedDatePersian);

  // 1. Calculations for current active hours/shift
  const totalGameplayRevenue = history.reduce((sum, h) => sum + h.gamePlayCost, 0);
  const totalSessionBuffet = history.reduce((sum, h) => sum + h.buffetCost, 0);
  const totalDirectBuffetSales = directSales.reduce((sum, s) => sum + s.totalCost, 0);
  
  const totalGrossRevenue = totalGameplayRevenue + totalSessionBuffet + totalDirectBuffetSales;
  
  const paidCard = history.reduce((sum, h) => {
    if (h.paymentMethod === 'card') return sum + h.totalCost;
    if (h.paymentMethod === 'mixed' && h.cardPaidAmount) return sum + h.cardPaidAmount;
    return sum;
  }, 0) + directSales.reduce((sum, s) => {
    const pm = s.paymentMethod || 'cash';
    if (pm === 'card') return sum + s.totalCost;
    if (pm === 'mixed' && s.cardPaidAmount) return sum + s.cardPaidAmount;
    return sum;
  }, 0);

  const paidCash = history.reduce((sum, h) => {
    if (h.paymentMethod === 'cash') return sum + h.totalCost;
    if (h.paymentMethod === 'mixed' && h.cashPaidAmount) return sum + h.cashPaidAmount;
    return sum;
  }, 0) + directSales.reduce((sum, s) => {
    const pm = s.paymentMethod || 'cash';
    if (pm === 'cash') return sum + s.totalCost;
    if (pm === 'mixed' && s.cashPaidAmount) return sum + s.cashPaidAmount;
    return sum;
  }, 0);

  const debtAccumulated = history.reduce((sum, h) => {
    if (h.paymentMethod === 'debt') return sum + h.totalCost;
    if (h.paymentMethod === 'mixed' && h.debtAmount) return sum + h.debtAmount;
    return sum;
  }, 0) + directSales.reduce((sum, s) => {
    const pm = s.paymentMethod || 'cash';
    if (pm === 'debt') return sum + s.totalCost;
    if (pm === 'mixed' && s.debtAmount) return sum + s.debtAmount;
    return sum;
  }, 0);

  const totalSessionsCount = history.length;
  const totalSalesCount = directSales.length;

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAlreadyClosed) return; // Prevent duplicate register if forced submit
    setIsSuccess(true);
    setTimeout(() => {
      onConfirmCloseDay(notes, selectedDatePersian);
      setNotes('');
      setIsSuccess(false);
      onClose();
    }, 1800);
  };

  // Determine permissions
  const canViewFinancials = userRole === 'admin' || !!userPermissions?.reports || !!userPermissions?.allowUserEdits;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
      <div 
        className="w-full max-w-lg bg-[#0F1219] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col scale-100 transition-all"
        id="close-working-day-modal"
      >
        
        {/* Modal Header */}
        <div className="p-4 bg-rose-950/20 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-400">
            <Clock className="w-5 h-5" />
            <h2 className="text-sm font-black">اتمام روز کاری جاری و تهیه نسخه پشتیبان دیتابیس</h2>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-4 flex flex-col items-center justify-center h-80 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>
            <h3 className="text-lg font-black text-emerald-400">روز کاری پایان یافت و بکاپ .db دریافت شد!</h3>
            <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
              فایل دیتابیس کامل با پسوند <strong className="text-emerald-400">.db</strong> به‌صورت خودکار در مرورگر شما دانلود شد. حافظه جاری برنامه جهت جلوگیری از سنگین شدن حجم نرم‌افزار بازنشانی و سبک گردید.
            </p>
          </div>
        ) : (
          <form onSubmit={handleFinish} className="flex-grow overflow-y-auto p-5 space-y-4">
            
            {/* Warning Alert banner */}
            <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-xl text-xs flex items-start gap-2.5 leading-relaxed">
              <AlertTriangle className="w-5 h-5 shrink-0 text-blue-400 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">💾 دانلود خودکار فایل دیتابیس (.db):</span>
                با ثبت اتمام روز کاری، یک فایل دیتابیس کامل (<strong className="text-emerald-400 font-mono">.db</strong>) به‌صورت مستقیم روی سیستم شما دانلود می‌شود تا نیازی به ذخیره داده‌های سنگین درون حافظه مرورگر نباشد و سرعت برنامه همیشه در بالاترین حد بماند.
              </div>
            </div>

            {/* Date Configuration Section */}
            <div className="p-4 bg-[#0B0E14] border border-white/5 rounded-xl space-y-3">
              <span className="text-[10px] text-slate-300 font-bold block flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-rose-450 text-rose-400" />
                تعیین تاریخ روز کاری جهت بایگانی:
              </span>

              {isPastMidnight ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-amber-400 font-medium leading-relaxed bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 text-justify">
                    ⏰ زمان جاری از ساعت 12 شب عبور کرده است. مایلید حساب‌ها و دخل این شیفت تحت کدام روز کاری ثبت و ذخیره گردد؟
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedDatePersian(yesterdayPersian)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        selectedDatePersian === yesterdayPersian
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-md font-bold'
                          : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-[10px] block text-slate-400 font-medium mb-0.5">روز قبل ({yesterdayLabel})</span>
                      <span className="text-xs font-bold font-mono">{toPersianDigits(yesterdayPersian)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDatePersian(todayPersian)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        selectedDatePersian === todayPersian
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-md font-bold'
                          : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-[10px] block text-slate-400 font-medium mb-0.5">امروز ({todayLabel} - ۱۲ شب به بعد)</span>
                      <span className="text-xs font-bold font-mono">{toPersianDigits(todayPersian)}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2.5 bg-[#151921] rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400">تاریخ روز کاری جاری:</span>
                  <span className="text-xs font-extrabold font-mono text-slate-200 bg-white/5 px-2.5 py-1 rounded-lg">
                    {toPersianDigits(selectedDatePersian)}
                  </span>
                </div>
              )}

              {/* Duplicate date Warning check */}
              {isAlreadyClosed && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-[10px] flex items-start gap-2 leading-relaxed animate-pulse">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div className="text-rose-300">
                    <span className="font-extrabold block mb-0.5 text-rose-200">❌ امکان ثبت تکراری وجود ندارد:</span>
                    روز کاری برای تاریخ <span className="font-bold underline">{toPersianDigits(selectedDatePersian)}</span> قبلاً در بخش دیتابیس ثبت و بکاپ‌گیری شده است. شما فقط مجاز به یکبار ثبت در هر روز کاری هستید. جهت ادامه لطفا ابتدا بکاپ قبلی این روز را از تب دیتابیس حذف کنید یا تاریخ را تغییر دهید.
                  </div>
                </div>
              )}
            </div>

            {canViewFinancials ? (
              <>
                {/* Quick counters bar */}
                <div className="grid grid-cols-3 gap-2.5 pb-1">
                  <div className="p-2.5 bg-[#0B0E14] border border-white/5 rounded-xl text-center">
                    <span className="text-[9.5px] text-slate-400 block mb-0.5">فاکتورهای کنسول</span>
                    <span className="text-xs font-bold font-mono text-blue-400">{toPersianDigits(totalSessionsCount)} نوبت</span>
                  </div>
                  <div className="p-2.5 bg-[#0B0E14] border border-white/5 rounded-xl text-center">
                    <span className="text-[9.5px] text-slate-400 block mb-0.5">فروش بوفه</span>
                    <span className="text-xs font-bold font-mono text-indigo-400">{toPersianDigits(totalSalesCount)} خرید</span>
                  </div>
                  <div className="p-2.5 bg-[#0B0E14] border border-white/5 rounded-xl text-center">
                    <span className="text-[9.5px] text-slate-400 block mb-0.5">رویدادها و لاگ‌ها</span>
                    <span className="text-xs font-bold font-mono text-amber-400">{toPersianDigits(systemLogs.length)} رویداد</span>
                  </div>
                </div>

                {/* Financial Summary Frame */}
                <div className="p-4 bg-[#0B0E14] border border-white/10 rounded-xl space-y-3">
                  <span className="text-[10px] text-rose-400 font-bold tracking-wider uppercase block border-b border-white/5 pb-1.5 flex items-center justify-between">
                    <span>تراز مالی عملکرد شیفت و صندوق جاری</span>
                    <span className="bg-rose-500/10 text-rose-300 font-mono text-[9px] px-1.5 py-0.5 rounded uppercase">
                      توسط مدیر سیستم
                    </span>
                  </span>

                  {/* Financial Metrics rows */}
                  <div className="space-y-2 text-xs">
                    
                    {/* Gameplay income */}
                    <div className="flex justify-between items-center text-slate-350">
                      <span className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                        کارکرد پورت سیستم‌ها:
                      </span>
                      <span className="font-mono text-slate-200 font-medium">{formatCurrency(totalGameplayRevenue)}</span>
                    </div>

                    {/* Buffet income (combined) */}
                    <div className="flex justify-between items-center text-slate-350">
                      <span className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                        جمع درآمد بوفه (متصل + مستقل):
                      </span>
                      <span className="font-mono text-slate-200 font-medium">{formatCurrency(totalSessionBuffet + totalDirectBuffetSales)}</span>
                    </div>

                    {/* Total gross shift */}
                    <div className="flex justify-between items-center py-1.5 border-t border-b border-white/5 text-sm font-bold my-1">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <CircleDollarSign className="w-4 h-4 text-emerald-400" />
                        کل درآمد ناخالص شیفت (فروش کل):
                      </span>
                      <span className="font-mono text-emerald-400">{formatCurrency(totalGrossRevenue)}</span>
                    </div>

                    {/* Cash on hand */}
                    <div className="flex justify-between items-center text-slate-400 pl-2">
                      <span className="flex items-center gap-1.5 text-[11px]">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                        مجموع دریافتی نقدی صندوق (دخل نقد):
                      </span>
                      <span className="font-mono text-slate-200 font-bold">{formatCurrency(paidCash)}</span>
                    </div>

                    {/* Card payments */}
                    <div className="flex justify-between items-center text-slate-400 pl-2">
                      <span className="flex items-center gap-1.5 text-[11px]">
                        <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                        ترکنش‌های کارتخوان (بانکی):
                      </span>
                      <span className="font-mono text-slate-200 font-bold">{formatCurrency(paidCard)}</span>
                    </div>

                    {/* Debts outstanding */}
                    <div className="flex justify-between items-center text-slate-400 pl-2">
                      <span className="flex items-center gap-1.5 text-[11px]">
                        <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                        نسیه دفتری ثبت شده امروز:
                      </span>
                      <span className="font-mono text-amber-500 font-bold">{formatCurrency(debtAccumulated)}</span>
                    </div>

                  </div>
                </div>
              </>
            ) : (
              <div className="p-6 bg-[#0B0E14] border border-white/5 rounded-xl text-center space-y-3 shadow-inner">
                <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
                  <Lock className="w-6 h-6 animate-pulse" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-xs font-black text-slate-200">گزارش مالی پنهان (سطح دسترسی کاربر عادی)</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                    طبق سیاست‌های تعیین شده مدیر گیم‌نت، جزئیات حساب‌ها، تراز دخل، کارهای انجام شده و مبالغ حاصل شده شیفت جاری تنها برای مدیر سیستم قابل مشاهده است.
                  </p>
                  <p className="text-[10px] text-emerald-400 font-bold">
                    با کلیک بر روی دکمه ثبت زیر، شیفت بسته‌شده و در دیتابیس بایگانی می‌گردد.
                  </p>
                </div>
              </div>
            )}

            {/* Telegram Notification Active Indicator */}
            {telegramConfig?.enabled && telegramConfig?.botToken && telegramConfig?.chatId && (
              <div className="p-3 bg-sky-950/40 border border-sky-500/25 rounded-xl flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-sky-300 font-medium">
                  <Send className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>خلاصه مالی پس از ثبت، خودکار به بات تلگرام شما ارسال خواهد شد.</span>
                </span>
                <span className="px-2 py-0.5 bg-sky-500/20 text-sky-300 rounded-md text-[10px] font-bold font-mono shrink-0">
                  Telegram Bot Active 🤖
                </span>
              </div>
            )}

            {/* Shift notes and details */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-300 font-bold block">
                ملاحظات و لایک‌های روز کاری (اختیاری):
              </label>
              <textarea
                placeholder="توضیحاتی درباره تراز دخل، کارهای خاص یا تغییر صندوقدار را در اینجا بنویسید..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-18 p-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500 text-right font-sans resize-none"
              />
            </div>

            {/* Footer buttons row */}
            <div className="grid grid-cols-2 gap-3.5 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 bg-slate-805 hover:bg-[#1C2333]/90 text-sm font-bold text-slate-300 border border-white/5 rounded-xl cursor-pointer transition-all text-center"
              >
                انصراف و لغو
              </button>
              
              <button
                type="submit"
                disabled={isAlreadyClosed}
                className={`py-2.5 px-4 text-sm font-bold shadow-lg rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 text-center ${
                  isAlreadyClosed 
                    ? 'bg-rose-950/25 border border-rose-900/30 text-rose-500/40 cursor-not-allowed opacity-50 shadow-none'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40 hover:scale-[1.01]'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isAlreadyClosed ? '' : 'animate-spin-slow'}`} />
                <span>پایان روز کاری و ذخیره بکاپ</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
