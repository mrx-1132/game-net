import React, { useState, useEffect } from 'react';
import { X, Receipt, CheckCircle, Calculator, ShieldAlert, Phone, User, Users, Plus, Trash2, History, ChevronDown, ChevronUp } from 'lucide-react';
import { System, DebtCustomer, RateConfig, CardReader, UserPermissions } from '../types';
import { formatCurrency, formatDuration, getSessionMetrics, formatDatePersian, getGameplaySegments } from '../utils';

interface SettleSessionModalProps {
  system: System;
  systemRates: RateConfig;
  debtors: DebtCustomer[];
  isOpen: boolean;
  onClose: () => void;
  onSettle: (params: {
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
  }) => void;
  cardReaders: CardReader[];
  cashDivisors?: number[];
  onRemoveBuffetItem?: (systemId: string, itemId: string) => void;
  onRemoveExtraServiceItem?: (systemId: string, itemId: string) => void;
  userRole?: 'admin' | 'user';
  userPermissions?: UserPermissions;
}

export default function SettleSessionModal({
  system,
  systemRates,
  debtors,
  isOpen,
  onClose,
  onSettle,
  cardReaders = [],
  cashDivisors = [2, 3, 4],
  onRemoveBuffetItem,
  onRemoveExtraServiceItem,
  userRole = 'user',
  userPermissions,
}: SettleSessionModalProps) {
  const canRegisterDebt = userRole === 'admin' || !!userPermissions?.debt;
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'debt' | 'mixed'>('card');
  const [cashDivision, setCashDivision] = useState<number>(1);
  const [mixedCardAmount, setMixedCardAmount] = useState<string>('');
  const [mixedCashAmount, setMixedCashAmount] = useState<string>('');
  const [mixedDebtAmount, setMixedDebtAmount] = useState<string>('');
  const [selectedCardReaderId, setSelectedCardReaderId] = useState<string>('');

  // Split debt state
  const [isSplitDebt, setIsSplitDebt] = useState(false);

  // Dynamic set of split debtors
  const [splitDebtors, setSplitDebtors] = useState<Array<{
    id: string;
    isNew: boolean;
    selectedDebtorId: string;
    newName: string;
    newPhone: string;
    amount: number;
  }>>([]);

  const [error, setError] = useState('');
  const [roundingOffset, setRoundingOffset] = useState<number>(0);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [sessionNote, setSessionNote] = useState<string>('');

  if (!isOpen || !system.activeSession) return null;

  const session = system.activeSession;
  
  // Calculate details at current moment
  const { durationMinutes, gamePlayCost, buffetCost, extraServicesCost, totalCost, elapsedMs } = getSessionMetrics(
    session,
    systemRates
  );

  const finalTotalCost = Math.max(0, totalCost + roundingOffset);
  const partialPayments = session?.partialPayments || [];
  const totalPartialPaid = partialPayments.reduce((acc, p) => acc + p.amount, 0);
  const netPayableCost = Math.max(0, finalTotalCost - totalPartialPaid);

  // Synchronize state when system/session changes
  useEffect(() => {
    if (isOpen && session) {
      setPaymentMethod('card');
      setMixedCardAmount('');
      setMixedCashAmount('');
      setMixedDebtAmount('');
      setIsSplitDebt(false);
      setError('');
      setRoundingOffset(0);
      setSessionNote(system.note || '');
      if (cardReaders && cardReaders.length > 0) {
        setSelectedCardReaderId(cardReaders[0].id);
      } else {
        setSelectedCardReaderId('');
      }
      setSplitDebtors([
        {
          id: 'debtor-0',
          isNew: false,
          selectedDebtorId: '',
          newName: session.customerName || '',
          newPhone: '',
          amount: Math.max(0, totalCost - totalPartialPaid),
        }
      ]);
    }
  }, [isOpen, system.id, session?.customerName, totalCost, cardReaders, totalPartialPaid]);

  // Sync mixed values when tab changes to mixed or netPayableCost changes
  useEffect(() => {
    if (paymentMethod === 'mixed') {
      const card = Number(mixedCardAmount) || 0;
      const cash = Number(mixedCashAmount) || 0;
      const debt = Number(mixedDebtAmount) || 0;
      if (card === 0 && cash === 0 && debt === 0) {
        setMixedCardAmount(netPayableCost.toString());
        setMixedCashAmount('');
        setMixedDebtAmount('');
      }
    }
  }, [paymentMethod, netPayableCost]);

  // Total debt calculation
  const activeDebtAmount = 
    paymentMethod === 'debt' 
      ? netPayableCost 
      : (paymentMethod === 'mixed' ? (Number(mixedDebtAmount) || 0) : 0);

  // Sync splitDebtors amounts in case activeDebtAmount changes (due to rounding or payment method)
  useEffect(() => {
    if (splitDebtors.length === 0) return;
    const currentSum = splitDebtors.reduce((sum, item) => sum + item.amount, 0);
    if (currentSum !== activeDebtAmount) {
      if (splitDebtors.length === 1) {
        setSplitDebtors([{ ...splitDebtors[0], amount: activeDebtAmount }]);
      } else {
        const diff = activeDebtAmount - currentSum;
        const updated = [...splitDebtors];
        const newAmt = Math.max(0, updated[0].amount + diff);
        updated[0] = { ...updated[0], amount: newAmt };
        const newSum = updated.reduce((sum, item) => sum + item.amount, 0);
        if (newSum === activeDebtAmount) {
          setSplitDebtors(updated);
        } else {
          const count = updated.length;
          const base = Math.floor(activeDebtAmount / count);
          const rem = activeDebtAmount % count;
          setSplitDebtors(
            updated.map((x, i) => ({
              ...x,
              amount: base + (i === 0 ? rem : 0),
            }))
          );
        }
      }
    }
  }, [activeDebtAmount]);

  const toggleSplitDebt = () => {
    const nextSplit = !isSplitDebt;
    setIsSplitDebt(nextSplit);
    setError('');

    if (nextSplit) {
      const half = Math.round(activeDebtAmount / 2);
      setSplitDebtors([
        {
          id: 'debtor-1',
          isNew: splitDebtors[0]?.isNew || false,
          selectedDebtorId: splitDebtors[0]?.selectedDebtorId || '',
          newName: splitDebtors[0]?.newName || session.customerName || '',
          newPhone: splitDebtors[0]?.newPhone || '',
          amount: half,
        },
        {
          id: 'debtor-2',
          isNew: true,
          selectedDebtorId: '',
          newName: '',
          newPhone: '',
          amount: activeDebtAmount - half,
        }
      ]);
    } else {
      setSplitDebtors([
        {
          id: 'debtor-1',
          isNew: splitDebtors[0]?.isNew || false,
          selectedDebtorId: splitDebtors[0]?.selectedDebtorId || '',
          newName: splitDebtors[0]?.newName || session.customerName || '',
          newPhone: splitDebtors[0]?.newPhone || '',
          amount: activeDebtAmount,
        }
      ]);
    }
  };

  const addDebtorRow = () => {
    const currentTotalAllocated = splitDebtors.reduce((sum, item) => sum + item.amount, 0);
    const remaining = Math.max(0, activeDebtAmount - currentTotalAllocated);
    setSplitDebtors([
      ...splitDebtors,
      {
        id: `debtor-${Date.now()}`,
        isNew: true,
        selectedDebtorId: '',
        newName: '',
        newPhone: '',
        amount: remaining,
      }
    ]);
  };

  const removeDebtorRow = (id: string) => {
    if (splitDebtors.length <= 2) {
      setError('حداقل 2 بدهکار برای تقسیم نسیه لازم است.');
      return;
    }
    const filtered = splitDebtors.filter(item => item.id !== id);
    
    // Distribute equally among the remaining items
    const count = filtered.length;
    const baseShare = Math.floor(activeDebtAmount / count);
    const remainder = activeDebtAmount % count;
    
    setSplitDebtors(
      filtered.map((item, index) => ({
        ...item,
        amount: baseShare + (index === 0 ? remainder : 0)
      }))
    );
  };

  const distributeEqually = () => {
    const count = splitDebtors.length;
    if (count === 0) return;
    const baseShare = Math.floor(activeDebtAmount / count);
    const remainder = activeDebtAmount % count;
    
    const updated = splitDebtors.map((item, index) => ({
      ...item,
      amount: baseShare + (index === 0 ? remainder : 0)
    }));
    setSplitDebtors(updated);
  };

  const updateDebtorItem = (id: string, fields: Partial<typeof splitDebtors[0]>) => {
    setSplitDebtors(
      splitDebtors.map((item) => (item.id === id ? { ...item, ...fields } : item))
    );
  };

  const handleSettleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const isDebtIncluded = paymentMethod === 'debt' || (paymentMethod === 'mixed' && (Number(mixedDebtAmount) || 0) > 0) || activeDebtAmount > 0;
    if (isDebtIncluded && !canRegisterDebt) {
      setError('ثبت پرداخت نسیه در سیستم غیرفعال است. جهت ثبت نسیه، ابتدا دسترسی «دفتر نسیه» را در بخش تنظیمات عمومی فعال نمایید.');
      return;
    }

    if (paymentMethod === 'mixed') {
      const cardVal = Number(mixedCardAmount) || 0;
      const cashVal = Number(mixedCashAmount) || 0;
      const debtVal = Number(mixedDebtAmount) || 0;
      
      if (cardVal < 0 || cashVal < 0 || debtVal < 0) {
        setError('مبالغ پرداخت ترکیبی نمی‌توانند منفی باشند.');
        return;
      }
      
      const sum = cardVal + cashVal + debtVal;
      if (sum !== netPayableCost) {
        setError(`مجموع مبالغ پرداختی (${formatCurrency(sum)}) با مبلغ خالص قابل پرداخت (${formatCurrency(netPayableCost)}) برابر نیست. تفاوت: ${formatCurrency(netPayableCost - sum)}`);
        return;
      }
    }

    if (activeDebtAmount > 0) {
      if (splitDebtors.length === 0) {
        setError('لطفاً حداقل یک بدهکار مشخص کنید.');
        return;
      }

      // 1. Validate each debtor row
      for (let i = 0; i < splitDebtors.length; i++) {
        const item = splitDebtors[i];
        const label = isSplitDebt ? `بدهکار ${i + 1}` : 'بدهکار';
        
        if (item.isNew) {
          if (!item.newName.trim()) {
            setError(`لطفاً نام ${label} را وارد کنید.`);
            return;
          }
          const trimmedPhone = item.newPhone.trim();
          if (trimmedPhone) {
            if (trimmedPhone.length < 10) {
              setError(`لطفا شماره تماس معتبر ${label} را وارد کنید (حداقل ۱۰ رقم).`);
              return;
            }
          }
        } else {
          if (!item.selectedDebtorId) {
            setError(`لطفاً برای ${label}، یک مشتری بدهکار انتخاب کنید یا گزینه بدهکار جدید را بزنید.`);
            return;
          }
        }
      }

      // 2. Validate sum of amounts matches activeDebtAmount if isSplitDebt is true
      if (isSplitDebt) {
        const totalAllocated = splitDebtors.reduce((sum, item) => sum + item.amount, 0);
        if (totalAllocated !== activeDebtAmount) {
          setError(`مجموع مبالغ سهم‌ها (${formatCurrency(totalAllocated)}) با کل مبلغ نسیه (${formatCurrency(activeDebtAmount)}) برابر نیست.`);
          return;
        }

        // 3. Verify no duplicate registered debtors are selected
        const selectedIds = splitDebtors
          .filter(item => !item.isNew && item.selectedDebtorId)
          .map(item => item.selectedDebtorId);
        const uniqueSelectedIds = new Set(selectedIds);
        if (selectedIds.length !== uniqueSelectedIds.size) {
          setError('یک مشتری بدهکار را نمی‌توان چند بار انتخاب کرد. لطفاً بدهکارهای متفاوتی را برگزینید.');
          return;
        }
      }
    }

    const debtDetails: { debtorId?: string; name: string; phone?: string; amount: number }[] = [];

    if (activeDebtAmount > 0) {
      splitDebtors.forEach((item) => {
        const amount = isSplitDebt ? item.amount : activeDebtAmount;
        debtDetails.push({
          debtorId: !item.isNew ? item.selectedDebtorId : undefined,
          name: item.isNew ? item.newName.trim() : debtors.find((d) => d.id === item.selectedDebtorId)?.name || '',
          phone: item.isNew ? item.newPhone.trim() : undefined,
          amount,
        });
      });
    }

    const chosenReader = cardReaders.find(r => r.id === selectedCardReaderId);
    const hasCardComponent = paymentMethod === 'card' || (paymentMethod === 'mixed' && (Number(mixedCardAmount) || 0) > 0);

    onSettle({
      paymentMethod,
      debtCustomerId: !isSplitDebt && !splitDebtors[0]?.isNew ? splitDebtors[0]?.selectedDebtorId : undefined,
      newDebtCustomer: !isSplitDebt && splitDebtors[0]?.isNew 
        ? { name: splitDebtors[0].newName.trim(), phone: splitDebtors[0].newPhone.trim() } 
        : undefined,
      totalCost: finalTotalCost,
      gamePlayCost,
      buffetCost,
      extraServicesCost,
      extraServices: session.extraServices,
      durationMinutes,
      cashPaidAmount: paymentMethod === 'cash' ? netPayableCost : (paymentMethod === 'mixed' ? (Number(mixedCashAmount) || 0) : undefined),
      cardPaidAmount: paymentMethod === 'card' ? netPayableCost : (paymentMethod === 'mixed' ? (Number(mixedCardAmount) || 0) : undefined),
      debtAmount: activeDebtAmount,
      debtDetails: debtDetails.length > 0 ? debtDetails : undefined,
      cardReaderId: hasCardComponent ? (chosenReader?.id || selectedCardReaderId) : undefined,
      cardReaderName: hasCardComponent ? (chosenReader?.name || (selectedCardReaderId ? 'پیش‌فرض' : undefined)) : undefined,
      notes: sessionNote,
      roundingOffset: roundingOffset !== 0 ? roundingOffset : undefined,
    });
    
    onClose();
  };

  const activePlayersText = 
    session.playersCount === 1 ? 'تک دسته' : 
    session.playersCount === 2 ? 'دو دسته' : 
    session.playersCount === 3 ? 'سه دسته' : 'چهار دسته';

  const hourlyRateValue = 
    session.playersCount === 1 ? systemRates.hourlyRate1P : 
    session.playersCount === 2 ? systemRates.hourlyRate2P : 
    session.playersCount === 3 ? systemRates.hourlyRate3P : systemRates.hourlyRate4P;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" dir="rtl">
      <div 
        className="w-full max-w-xl bg-[#151921] border border-white/5 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
        id="settle-session-modal"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#0B0E14]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-tight">
            <Receipt className="w-5 h-5 text-amber-500" />
            فاکتور نهایی و تسویه حساب پیشرفته - {system.name}
          </h3>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSettleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto text-xs">
          
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Info Box */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-[#0B0E14]/60 border border-white/5 rounded-xl">
            <div>
              <span className="text-slate-450 block text-[10px] mb-0.5">نام مشتری:</span>
              <span className="text-white font-bold">{session.customerName}</span>
            </div>
            <div>
              <span className="text-slate-455 block text-[10px] mb-0.5">نوع کنسول/سیستم:</span>
              <span className="text-white font-bold">{system.type}</span>
            </div>
            <div>
              <span className="text-slate-450 block text-[10px] mb-0.5">زمان شروع جلسه:</span>
              <span className="text-slate-300 font-mono text-[10px]">{formatDatePersian(session.startTime)}</span>
            </div>
            <div>
              <span className="text-slate-450 block text-[10px] mb-0.5">تعداد بازیکن/دسته:</span>
              <span className="text-blue-400 font-bold">{activePlayersText} ({session.playersCount}P)</span>
            </div>
          </div>

          {/* Session Note Field */}
          <div className="p-3 bg-[#0B0E14]/60 border border-white/5 rounded-xl space-y-1.5 text-right" dir="rtl">
            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 select-none">
              <span>📝 یادداشت / ملاحظات سیستم (پیوست به سوابق و نمونه فاکتور):</span>
            </span>
            <input
              type="text"
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
              placeholder="ثبت یادداشت یا توضیحات (تلفن مشتری، شماره کارت، گزارش و...)"
              className="w-full text-xs px-2.5 py-1.5 bg-[#151921] hover:bg-[#1A1F2B] focus:bg-[#1A1F2B] border border-white/10 focus:border-blue-500/50 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none transition-all"
            />
          </div>

          {/* Breakdown Section */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-amber-500" />
              ریز هزینه‌های گیم‌پلی
            </h4>
            <div className="p-4 bg-[#0B0E14] border border-white/5 rounded-xl space-y-2.5">
              {(() => {
                const segs = getGameplaySegments(session, systemRates, elapsedMs);
                if (segs.length > 0) {
                  return (
                    <div className="space-y-1.5 mb-3 border-b border-white/5 pb-3">
                      <button
                        type="button"
                        onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                        className="flex items-center justify-between w-full gap-2 text-[10px] text-slate-400 hover:text-slate-200 bg-slate-900/45 hover:bg-slate-900/70 px-2.5 py-1.5 rounded-lg border border-white/5 cursor-pointer transition-all font-bold"
                      >
                        <div className="flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-slate-400" />
                          <span>تاریخچه بازی ({segs.length} بخش)</span>
                        </div>
                        {isHistoryExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                      </button>

                      {isHistoryExpanded && (
                        <div className="space-y-1 animate-fade-in pt-1.5">
                          <span className="text-[9px] font-bold text-slate-400 block mb-1 font-sans">گزارش تغییر تعداد دسته‌ها (تغییر تعرفه دقیقه به دقیقه):</span>
                          {segs.map((seg, idx) => (
                            <div key={idx} className="flex justify-between text-slate-300 text-[10px] py-1 px-2 rounded bg-slate-900/30 border border-white/5 font-sans">
                              <span>بخش {idx + 1} ({seg.playersCount} دسته):</span>
                              <span className="font-mono">{seg.minutes} دقیقه = {formatCurrency(seg.cost)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              <div className="flex justify-between items-center text-slate-300">
                <span>زمان بازی کل (خالص):</span>
                <span className="text-white font-mono font-medium">{formatDuration(elapsedMs)} ({durationMinutes} دقیقه)</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>مبنای نرخ ساعتی مربوطه:</span>
                <span className="text-white font-medium font-mono">{formatCurrency(hourlyRateValue)}</span>
              </div>
              {session.totalPausedMs > 0 && (
                <div className="flex justify-between items-center text-rose-455">
                  <span>جمع مدت توقف‌ها (کسر شده):</span>
                  <span className="font-mono">{Math.round(session.totalPausedMs / 60000)} دقیقه</span>
                </div>
              )}
              <div className="h-px bg-white/5 my-2"></div>
              <div className="flex justify-between items-center font-bold text-white">
                <span>هزینه سیستم و بازی:</span>
                <span className="text-blue-400 font-mono">{formatCurrency(gamePlayCost)}</span>
              </div>
            </div>
          </div>

          {/* Buffet Items linked */}
          {session.buffetItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  🍿 خریدهای بوفه متصل ({session.buffetItems.length})
                </h4>
                <span className="text-[9px] text-amber-400/80">برای حذف خوراکی اشتباهی روی آیکون سطل زباله کلیک کنید</span>
              </div>
              <div className="p-3 bg-[#0B0E14] border border-white/5 rounded-xl space-y-2">
                {session.buffetItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-slate-300 py-1 px-2.5 bg-[#151921]/60 rounded-lg border border-white/5">
                    <div className="flex items-center gap-2">
                      {onRemoveBuffetItem && (
                        <button
                          type="button"
                          onClick={() => onRemoveBuffetItem(system.id, item.id)}
                          className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-md transition-colors cursor-pointer"
                          title="حذف خوراکی اشتباهی و بازگشت به انبار"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span>
                        {item.name} <span className="text-slate-400 text-[10px]">({item.quantity} عدد)</span>
                      </span>
                    </div>
                    <span className="text-white font-mono text-xs font-bold">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
                <div className="h-px bg-white/5 my-2"></div>
                <div className="flex justify-between items-center font-bold text-white px-1">
                  <span>هزینه خرید بوفه:</span>
                  <span className="text-blue-400 font-mono">{formatCurrency(buffetCost)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Extra Services/Equipment linked */}
          {session.extraServices && session.extraServices.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🛠️ خدمات، کرایه تجهیزات و خسارت‌ها ({session.extraServices.length})</span>
                </h4>
                <span className="text-[9px] text-amber-400/80">برای حذف موارد اشتباهی روی آیکون سطل زباله کلیک کنید</span>
              </div>
              <div className="p-3 bg-[#0B0E14] border border-white/5 rounded-xl space-y-2">
                {session.extraServices.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-slate-300 py-1 px-2.5 bg-[#151921]/60 rounded-lg border border-white/5">
                    <div className="flex items-center gap-2">
                      {onRemoveExtraServiceItem && (
                        <button
                          type="button"
                          onClick={() => onRemoveExtraServiceItem(system.id, item.id)}
                          className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-md transition-colors cursor-pointer"
                          title="حذف این سرویس یا تجهیزات جانبی"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span>
                        {item.name} <span className="text-slate-400 text-[10px]">({item.quantity} عدد)</span>
                      </span>
                    </div>
                    <span className="text-white font-mono text-xs font-bold">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
                <div className="h-px bg-white/5 my-2"></div>
                <div className="flex justify-between items-center font-bold text-white px-1">
                  <span>مجموع هزینه خدمات و تجهیزات:</span>
                  <span className="text-amber-400 font-mono">{formatCurrency(extraServicesCost)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Rounding total cost option */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              🧮 رند کردن و تسطیح مبلغ فاکتور (تومان)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setRoundingOffset(0)}
                className={`py-2 px-2.5 rounded-xl border text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
                  roundingOffset === 0
                    ? 'border-amber-500/50 bg-amber-500/10 font-bold text-amber-400 shadow-lg shadow-amber-500/5'
                    : 'border-white/5 bg-[#0B0E14]/50 text-slate-400 hover:border-white/10 hover:text-white'
                }`}
              >
                <span className="text-[11px] font-bold">بدون تغییر (واقعی)</span>
                <span className="text-[9px] font-mono opacity-70">{formatCurrency(totalCost)}</span>
              </button>

              <button
                type="button"
                onClick={() => setRoundingOffset((Math.round(totalCost / 1000) * 1000) - totalCost)}
                className={`py-2 px-2.5 rounded-xl border text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
                  roundingOffset === (Math.round(totalCost / 1000) * 1000) - totalCost && roundingOffset !== 0
                    ? 'border-amber-500/50 bg-amber-500/10 font-bold text-amber-400 shadow-lg shadow-amber-500/5'
                    : 'border-white/5 bg-[#0B0E14]/50 text-slate-400 hover:border-white/10 hover:text-white'
                }`}
              >
                <span className="text-[11px] font-bold">نزدیک‌ترین 1,000</span>
                <span className="text-[9px] font-mono opacity-70">{formatCurrency(Math.round(totalCost / 1000) * 1000)}</span>
              </button>

              <button
                type="button"
                onClick={() => setRoundingOffset(prev => prev - 1000)}
                className={`py-2 px-2.5 rounded-xl border text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
                  roundingOffset < 0
                    ? 'border-rose-500/50 bg-rose-500/10 font-bold text-rose-400 shadow-lg shadow-rose-500/5'
                    : 'border-white/5 bg-[#0B0E14]/50 text-slate-400 hover:border-white/10 hover:text-white'
                }`}
              >
                <span className="text-[11px] font-bold">📉 گرد به پایین (1,000- تومان)</span>
                <span className="text-[9px] font-mono opacity-70">
                  {roundingOffset < 0 ? `کاهش کل: ${formatCurrency(Math.abs(roundingOffset))}` : 'کاهش 1,000 تومانی'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRoundingOffset(prev => prev + 1000)}
                className={`py-2 px-2.5 rounded-xl border text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
                  roundingOffset > 0
                    ? 'border-emerald-500/50 bg-emerald-500/10 font-bold text-emerald-400 shadow-lg shadow-emerald-500/5'
                    : 'border-white/5 bg-[#0B0E14]/50 text-slate-400 hover:border-white/10 hover:text-white'
                }`}
              >
                <span className="text-[11px] font-bold">📈 گرد به بالا (1,000+ تومان)</span>
                <span className="text-[9px] font-mono opacity-70">
                  {roundingOffset > 0 ? `افزایش کل: ${formatCurrency(roundingOffset)}` : 'افزایش 1,000 تومانی'}
                </span>
              </button>
            </div>
          </div>

          {/* Total Payable Box */}
          <div className="p-4 bg-[#0B0E14] border border-dashed border-white/10 rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">مجموع کل فاکتور:</span>
              <span className="font-mono font-bold text-white">{formatCurrency(finalTotalCost)}</span>
            </div>

            {totalPartialPaid > 0 && (
              <div className="pt-1.5 border-t border-white/5 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <span>🟢 علی‌الحساب دریافتی قبلی ({partialPayments.length} پرداخت):</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-400">-{formatCurrency(totalPartialPaid)}</span>
                </div>
                <div className="space-y-1 pr-2 pt-0.5 max-h-24 overflow-y-auto">
                  {partialPayments.map((p, idx) => (
                    <div key={p.id || idx} className="flex items-center justify-between text-[10px] text-slate-300 bg-white/5 px-2 py-1 rounded-lg">
                      <span className="font-medium">{p.note || 'علی‌الحساب'} ({p.paymentMethod === 'card' ? `کارت‌خوان ${p.cardReaderName || ''}` : 'نقدی'})</span>
                      <span className="font-mono text-emerald-300 font-bold">-{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <span className="text-white font-black text-sm">خالص مانده جهت تسویه نهایی:</span>
              <div className="text-left flex flex-col items-end">
                <span className="text-xl font-black text-blue-400 font-mono leading-none">{formatCurrency(netPayableCost)}</span>
                {roundingOffset !== 0 && (
                  <span className="text-[9px] text-slate-500 mt-1" dir="rtl">
                    تفاوت: <span className={finalTotalCost > totalCost ? 'text-rose-400 font-mono' : 'text-emerald-400 font-mono'}>
                      {finalTotalCost > totalCost ? '+' : ''}{formatCurrency(finalTotalCost - totalCost)}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Dedicated Bill Splitting Section (بخش مجزای محاسبه دنگ / تقسیم بر) */}
          <div className="p-3.5 bg-[#151921]/80 border border-emerald-500/25 rounded-2xl space-y-3 text-right" dir="rtl" id="split-bill-section">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-emerald-400 block">🧮 محاسبه دنگ و تقسیم فاکتور (تقسیم بر)</span>
                  <span className="text-[9.5px] text-slate-400 block">محاسبه و تقسیم سریع حساب جلسه بازی بین بازیکنان</span>
                </div>
              </div>

              {cashDivision > 1 && (
                <button
                  type="button"
                  onClick={() => setCashDivision(1)}
                  className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>بازنشانی به حالت تک‌نفره</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-300">تعداد نفرات برای تقسیم حساب:</span>
              <div className="flex items-center gap-1.5 bg-[#0B0E14] p-1 border border-white/10 rounded-xl">
                {(cashDivisors || [2, 3, 4, 5]).map((divisor) => (
                  <button
                    key={divisor}
                    type="button"
                    onClick={() => setCashDivision(cashDivision === divisor ? 1 : divisor)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      cashDivision === divisor
                        ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                        : 'text-emerald-300 hover:bg-emerald-500/20'
                    }`}
                  >
                    ÷{divisor}
                  </button>
                ))}
                <div className="flex items-center gap-1 pr-1.5 border-r border-white/10">
                  <span className="text-[10px] text-slate-500">سفارشی:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={cashDivision > 1 ? cashDivision : ''}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1);
                      setCashDivision(val);
                    }}
                    placeholder="تعداد"
                    className="w-12 h-7 bg-[#151921] border border-emerald-500/40 rounded-lg text-center text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400 font-bold"
                    title="تعداد نفرات جهت تقسیم حساب"
                  />
                </div>
              </div>
            </div>

            {cashDivision > 1 ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-emerald-300 text-xs font-semibold animate-in zoom-in-95 duration-150">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-300 block">سهم قابل پرداخت هر بازیکن ({cashDivision} نفر):</span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {formatCurrency(netPayableCost)} ÷ {cashDivision} نفر
                    </span>
                  </div>
                </div>
                <div className="text-left">
                  <span className="font-mono text-emerald-400 text-base font-black block">
                    {formatCurrency(Math.round(netPayableCost / cashDivision))}
                  </span>
                  <span className="text-[8.5px] text-slate-400">تومان برای هر نفر</span>
                </div>
              </div>
            ) : (
              <div className="text-[9.5px] text-slate-500 text-center py-1 bg-[#0B0E14]/40 rounded-lg border border-white/5">
                💡 جهت برآورد سهم پرداختی هر بازیکن، روی کلید‌های (÷۲، ÷۳ و...) یا تعداد سفارشی کلیک کنید.
              </div>
            )}
          </div>

          {/* Settlement Method */}
          <div className="space-y-2 pt-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              روش تسویه‌حساب مشتری
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`py-2 px-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  paymentMethod === 'card'
                    ? 'border-blue-500/50 bg-blue-500/10 font-bold text-blue-400 shadow-lg shadow-blue-500/5'
                    : 'border-white/5 bg-[#0B0E14]/50 text-slate-400 hover:border-white/10 hover:text-white'
                }`}
              >
                <span className="text-xs font-bold">💳 کارتخوان</span>
                <span className="text-[8px] font-sans opacity-70">کامل بانکی</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2 px-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-emerald-500/50 bg-emerald-500/10 font-bold text-emerald-400 shadow-lg shadow-emerald-500/5'
                    : 'border-white/5 bg-[#0B0E14]/50 text-slate-400 hover:border-white/10 hover:text-white'
                }`}
              >
                <span className="text-xs font-bold">💵 پول نقد</span>
                <span className="text-[8px] font-sans opacity-70">کامل نقدی</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('mixed')}
                className={`py-2 px-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  paymentMethod === 'mixed'
                    ? 'border-indigo-500/50 bg-indigo-500/10 font-bold text-indigo-400 shadow-lg shadow-indigo-500/5'
                    : 'border-white/5 bg-[#0B0E14]/50 text-slate-400 hover:border-white/10 hover:text-white'
                }`}
              >
                <span className="text-xs font-bold">🔀 پرداخت ترکیبی</span>
                <span className="text-[8px] font-sans opacity-70">کارت + نقد + نسیه</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!canRegisterDebt) {
                    setError('ثبت پرداخت نسیه در سیستم غیرفعال است. ابتدا دسترسی «دفتر نسیه» را در بخش تنظیمات فعال کنید.');
                    return;
                  }
                  setPaymentMethod('debt');
                }}
                className={`py-2 px-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  !canRegisterDebt
                    ? 'opacity-60 border-white/5 bg-[#0B0E14]/30'
                    : paymentMethod === 'debt'
                    ? 'border-amber-500/50 bg-amber-500/10 font-bold text-amber-400 shadow-lg shadow-amber-500/5'
                    : 'border-white/5 bg-[#0B0E14]/50 text-slate-400 hover:border-white/10 hover:text-white'
                }`}
              >
                <span className="text-xs font-bold">📝 ثبت نسیه</span>
                <span className="text-[8px] font-sans opacity-70">
                  {!canRegisterDebt ? '🔒 غیرفعال در تنظیمات' : 'دفتر بدهکاری'}
                </span>
              </button>
            </div>

            {paymentMethod === 'cash' && (
              <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between gap-2 text-right">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-emerald-400 block">💵 تسویه نقدی کامل ({formatCurrency(finalTotalCost)})</span>
                    <span className="text-[9px] text-slate-400 block">ثبت کل مبلغ فاکتور به صورت پول نقد در صندوق.</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card Reader Selection */}
          {(paymentMethod === 'card' || paymentMethod === 'mixed') && (
            <div className="p-3.5 bg-[#151921]/60 border border-white/5 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-1 duration-200 text-right">
              <label className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                🔌 انتخاب دستگاه کارتخوان بانکی (POS)
              </label>
              {cardReaders.length === 0 ? (
                <div className="text-[10px] text-amber-400 py-1 font-semibold">
                  ⚠️ هیچ دستگاه کارتخوانی در تنظیمات عمومی تعریف نشده است. تراکنش با نام "کارتخوان پیش‌فرض" ثبت خواهد شد.
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedCardReaderId}
                    onChange={(e) => setSelectedCardReaderId(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-[#0B0E14] border border-white/10 rounded-lg text-white font-semibold cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                    style={{ direction: 'rtl' }}
                  >
                    {cardReaders.map((pos) => (
                      <option key={pos.id} value={pos.id}>
                        {pos.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Mixed Payment Details UI */}
          {paymentMethod === 'mixed' && (() => {
            const cardVal = Number(mixedCardAmount) || 0;
            const cashVal = Number(mixedCashAmount) || 0;
            const debtVal = Number(mixedDebtAmount) || 0;
            const totalAllocated = cardVal + cashVal + debtVal;
            const remainder = finalTotalCost - totalAllocated;

            return (
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-indigo-400">
                    <span className="text-xs font-bold">🔀 تقسیم پرداخت دلخواه (نقد + کارتخوان + نسیه)</span>
                  </div>
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-300 font-mono font-bold px-1.5 py-0.5 rounded">
                    جمع فاکتور: {formatCurrency(finalTotalCost)}
                  </span>
                </div>
                
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  مبلغ دریافتی را به تفکیک کارتخوان، پول نقد و بدهی دفتری (نسیه) وارد کنید.
                </p>

                {/* Unbalanced warning notice */}
                {remainder !== 0 ? (
                  <div className={`p-2.5 rounded-lg border text-right text-[10px] flex items-center justify-between font-bold ${
                    remainder > 0 
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-300 animate-pulse' 
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                  }`}>
                    <span>
                      {remainder > 0 
                        ? `⚠️ مبلغ ${formatCurrency(remainder)} کماکان تسویه نشده است!` 
                        : `⚠️ مبلغ ${formatCurrency(Math.abs(remainder))} اضافه بر کل مبلغ فاکتور تقسیم شده است!`
                      }
                    </span>
                    <span className="font-mono text-[9px] opacity-75">مانده: {remainder.toLocaleString()} تومان</span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg text-right text-[10px] font-bold">
                    ✅ موازنه برقرار است! مبالغ به صورت کامل و دقیق تخصیص یافته‌اند.
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Card input */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-blue-300 block font-bold">💳 کارتخوان:</label>
                      {remainder !== 0 && (
                        <button
                          type="button"
                          onClick={() => setMixedCardAmount(Math.max(0, cardVal + remainder).toString())}
                          className="text-[9px] text-blue-400 font-bold hover:underline cursor-pointer"
                        >
                          تراز خودکار
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0"
                        value={mixedCardAmount}
                        onChange={(e) => setMixedCardAmount(e.target.value)}
                        className="w-full px-2 py-1.5 pl-12 bg-[#0B0E14] border border-blue-500/25 rounded-lg text-blue-300 font-mono text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="absolute left-2 top-2 text-[8px] text-slate-500">تومان</span>
                    </div>
                    {cardVal > 0 && (
                      <span className="text-[9px] text-slate-450 block font-mono text-center">
                        {formatCurrency(cardVal)}
                      </span>
                    )}
                  </div>

                  {/* Cash input */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-emerald-300 block font-bold">💵 پول نقد:</label>
                      {remainder !== 0 && (
                        <button
                          type="button"
                          onClick={() => setMixedCashAmount(Math.max(0, cashVal + remainder).toString())}
                          className="text-[9px] text-emerald-400 font-bold hover:underline cursor-pointer"
                        >
                          تراز خودکار
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0"
                        value={mixedCashAmount}
                        onChange={(e) => setMixedCashAmount(e.target.value)}
                        className="w-full px-2 py-1.5 pl-12 bg-[#0B0E14] border border-emerald-500/25 rounded-lg text-emerald-300 font-mono text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <span className="absolute left-2 top-2 text-[8px] text-slate-500">تومان</span>
                    </div>
                    {cashVal > 0 && (
                      <span className="text-[9px] text-slate-450 block font-mono text-center">
                        {formatCurrency(cashVal)}
                      </span>
                    )}
                  </div>

                  {/* Debt input */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-amber-300 block font-bold">📝 نسیه دفتری:</label>
                      {remainder !== 0 && (
                        <button
                          type="button"
                          onClick={() => setMixedDebtAmount(Math.max(0, debtVal + remainder).toString())}
                          className="text-[9px] text-amber-400 font-bold hover:underline cursor-pointer"
                        >
                          تراز خودکار
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0"
                        value={mixedDebtAmount}
                        onChange={(e) => setMixedDebtAmount(e.target.value)}
                        className="w-full px-2 py-1.5 pl-12 bg-[#0B0E14] border border-amber-500/25 rounded-lg text-amber-300 font-mono text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <span className="absolute left-2 top-2 text-[8px] text-slate-500">تومان</span>
                    </div>
                    {debtVal > 0 && (
                      <span className="text-[9px] text-slate-450 block font-mono text-center">
                        {formatCurrency(debtVal)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Debt Registry splitting UI */}
          {activeDebtAmount > 0 && (
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    📝 انتساب و ثبت نسیه دفتری
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-1">بدهی را می‌توانید بین یک یا چند نفر تقسیم کنید.</p>
                </div>
                {/* Split debt toggle switch */}
                <button
                  type="button"
                  onClick={toggleSplitDebt}
                  className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSplitDebt
                      ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                      : 'border-white/5 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {isSplitDebt ? '👤 تغییر به ثبت تک‌نفره' : '👥 تقسیم نسیه بین چند نفر'}
                </button>
              </div>

              {/* Show Debtors Forms */}
              {!isSplitDebt ? (
                // Single debtor representation
                <div className="space-y-3">
                  <div className="flex gap-4 items-center border-b border-white/5 pb-2">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        checked={!splitDebtors[0]?.isNew}
                        onChange={() => updateDebtorItem(splitDebtors[0]?.id, { isNew: false })}
                        className="accent-amber-500 bg-slate-950"
                      />
                      <span>انتخاب مشتری بدهکار موجود</span>
                    </label>
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        checked={splitDebtors[0]?.isNew}
                        onChange={() => updateDebtorItem(splitDebtors[0]?.id, { isNew: true })}
                        className="accent-amber-500 bg-slate-950"
                      />
                      <span>ثبت بدهکار جدید دفتری</span>
                    </label>
                  </div>

                  {!splitDebtors[0]?.isNew ? (
                    <div className="space-y-1">
                      <select
                        value={splitDebtors[0]?.selectedDebtorId || ''}
                        onChange={(e) => updateDebtorItem(splitDebtors[0]?.id, { selectedDebtorId: e.target.value })}
                        className="w-full px-3 py-2 bg-[#0B0E14] border border-white/10 rounded-lg text-slate-205 focus:outline-none text-xs"
                      >
                        <option value="">-- انتخاب مشتری از دفتر نسیه --</option>
                        {debtors.map((d) => {
                          const balLabel = d.balance > 0 
                            ? `بدهی: ${formatCurrency(d.balance)}` 
                            : d.balance < 0 
                              ? `اعتبار: ${formatCurrency(Math.abs(d.balance))}` 
                              : 'بدون بدهی (تسویه)';
                          return (
                            <option key={d.id} value={d.id}>
                              {d.name} ({balLabel})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-slate-500 mb-1 block">نام مشتری جدید:</label>
                          <input
                            type="text"
                            placeholder="نام بدهکار"
                            value={splitDebtors[0]?.newName || ''}
                            onChange={(e) => updateDebtorItem(splitDebtors[0]?.id, { newName: e.target.value })}
                            className="w-full px-3 py-2 bg-[#0B0E14] border border-white/10 rounded-lg text-white focus:outline-none text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 mb-1 block">تلفن بدهکار (اختیاری):</label>
                          <div className="relative">
                            <span className="absolute right-3 top-2.5 text-slate-500">
                              <Phone className="w-3.5 h-3.5" />
                            </span>
                            <input
                              type="tel"
                              placeholder="مثل: 09121111111 (اختیاری)"
                              value={splitDebtors[0]?.newPhone || ''}
                              onChange={(e) => updateDebtorItem(splitDebtors[0]?.id, { newPhone: e.target.value })}
                              className="w-full pr-9 pl-3 py-2 bg-[#0B0E14] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none text-[11px] text-left"
                              dir="ltr"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Multi-debtor splitting layout
                <div className="space-y-4">
                  {/* Top utility row: Equal split & Add debtor */}
                  <div className="flex justify-between items-center bg-[#0B0E14]/40 p-2 rounded-lg border border-white/5">
                    <span className="text-[10px] font-bold text-amber-300">👥 لیست تقسیم سهم‌های نسیه</span>
                    <div className="flex gap-2">
                      <button
                        key="eq-split-btn"
                        type="button"
                        onClick={distributeEqually}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-md text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 leading-none select-none"
                      >
                        ⚖️ تقسیم سهم مساوی
                      </button>
                      <button
                        key="add-row-btn"
                        type="button"
                        onClick={addDebtorRow}
                        className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 leading-none select-none"
                      >
                        <Plus className="w-3 h-3" />
                        افزودن شخص جدید
                      </button>
                    </div>
                  </div>

                  {/* List of debtor rows */}
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {splitDebtors.map((item, index) => {
                      return (
                        <div key={item.id} className="p-3 bg-[#0B0E14]/30 border border-white/5 rounded-xl space-y-3 relative">
                          {/* Row Header */}
                          <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                              <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-sans text-[10px] font-black">{index + 1}</span>
                              شخص {index + 1}
                            </span>
                            {splitDebtors.length > 2 && (
                              <button
                                type="button"
                                onClick={() => removeDebtorRow(item.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                                title="حذف این سهم"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Row Content */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Share amount input */}
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">مبلغ سهم (تومان):</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min={0}
                                  max={activeDebtAmount}
                                  value={item.amount || ''}
                                  onChange={(e) => {
                                    const val = Math.min(activeDebtAmount, Math.max(0, Number(e.target.value)));
                                    updateDebtorItem(item.id, { amount: val });
                                  }}
                                  className="w-full text-left pl-14 pr-3 py-1.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white font-mono text-xs focus:outline-none"
                                />
                                <span className="absolute left-2.5 top-2 text-[8px] text-slate-500">تومان</span>
                              </div>
                              {item.amount !== undefined && !isNaN(Number(item.amount)) && (
                                <span className="text-[9px] text-amber-400 block font-mono font-bold mt-1 text-left">
                                  👈 {formatCurrency(Number(item.amount))}
                                </span>
                              )}
                            </div>

                            {/* Existing or new toggle */}
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">نوع حساب بدهکاری:</label>
                              <div className="flex gap-2 p-1 bg-[#0B0E14] rounded-lg border border-white/5">
                                <button
                                  type="button"
                                  onClick={() => updateDebtorItem(item.id, { isNew: false })}
                                  className={`flex-1 py-1 rounded text-[10px] font-medium transition-all ${
                                    !item.isNew
                                      ? 'bg-amber-500/20 text-amber-300 font-bold'
                                      : 'text-slate-500 hover:text-slate-300'
                                  }`}
                                >
                                  حساب موجود
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateDebtorItem(item.id, { isNew: true })}
                                  className={`flex-1 py-1 rounded text-[10px] font-medium transition-all ${
                                    item.isNew
                                      ? 'bg-amber-500/20 text-amber-300 font-bold'
                                      : 'text-slate-500 hover:text-slate-300'
                                  }`}
                                >
                                  مشتری جدید
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Inputs base */}
                          {!item.isNew ? (
                            <div className="space-y-1">
                              <select
                                value={item.selectedDebtorId || ''}
                                onChange={(e) => updateDebtorItem(item.id, { selectedDebtorId: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-[#0B0E14] border border-white/10 rounded-lg text-slate-205 focus:outline-none text-[11px]"
                              >
                                <option value="">-- انتخاب مشتری بدهکار --</option>
                                {debtors.map((d) => {
                                  const balLabel = d.balance > 0 
                                    ? `بدهی: ${formatCurrency(d.balance)}` 
                                    : d.balance < 0 
                                      ? `اعتبار: ${formatCurrency(Math.abs(d.balance))}` 
                                      : 'بدون بدهی (تسویه)';
                                  return (
                                    <option key={d.id} value={d.id}>
                                      {d.name} ({balLabel})
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <input
                                  type="text"
                                  placeholder="نام بدهکار جدید"
                                  value={item.newName || ''}
                                  onChange={(e) => updateDebtorItem(item.id, { newName: e.target.value })}
                                  className="w-full px-2.5 py-1.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white focus:outline-none text-xs"
                                />
                              </div>
                              <div className="relative">
                                <span className="absolute right-2 top-2 text-slate-500">
                                  <Phone className="w-3 h-3" />
                                </span>
                                <input
                                  type="tel"
                                  placeholder="تلفن (اختیاری)"
                                  value={item.newPhone || ''}
                                  onChange={(e) => updateDebtorItem(item.id, { newPhone: e.target.value })}
                                  className="w-full pr-7 pl-2 py-1.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none text-[11px] text-left"
                                  dir="ltr"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Allocation Status Indicator */}
                  {(() => {
                    const totalAllocated = splitDebtors.reduce((sum, item) => sum + item.amount, 0);
                    const diff = activeDebtAmount - totalAllocated;
                    return (
                      <div className={`p-2.5 rounded-lg border flex justify-between items-center ${
                        diff === 0
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      }`}>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="font-bold">مجموع مبالغ تخصیص‌یافته:</span>
                          <span className="font-mono font-bold">{formatCurrency(totalAllocated)}</span>
                        </div>
                        <div className="text-[10px] font-medium">
                          {diff === 0 ? (
                            <span className="font-bold">✨ مبالغ کاملاً تراز هستند</span>
                          ) : diff > 0 ? (
                            <span>⚠️ {formatCurrency(diff)} باقی‌مانده بدون تخصیص</span>
                          ) : (
                            <span>⚠️ {formatCurrency(Math.abs(diff))} اضافه تخصیص داده شده</span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-white/5">
            <button
              type="submit"
              className={`flex-1 py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs text-white cursor-pointer shadow-lg ${
                paymentMethod === 'debt' 
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/10' 
                  : paymentMethod === 'cash'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10'
                    : paymentMethod === 'mixed'
                      ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/10'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/10'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>تأیید فاکتور و ثبت تسویه‌حساب جلسه</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 bg-[#0B0E14] hover:bg-white/5 text-slate-300 font-bold rounded-xl border border-white/10 transition-all cursor-pointer"
            >
              بازگشت به برنامه
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
