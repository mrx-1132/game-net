import React, { useState, useEffect } from 'react';
import { X, Receipt, CheckCircle, Calculator, ShieldAlert, Phone, User, Users, Plus, Trash2 } from 'lucide-react';
import { System, DebtCustomer, RateConfig, SystemType, CardReader, UserPermissions } from '../types';
import { formatCurrency, formatDuration, getSessionMetrics } from '../utils';

interface GroupSettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSystems: System[];
  rates: Record<SystemType, RateConfig>;
  debtors: DebtCustomer[];
  onSettleGroup: (params: {
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
  }) => void;
  cardReaders: CardReader[];
  cashDivisors?: number[];
  userRole?: 'admin' | 'user';
  userPermissions?: UserPermissions;
}

export default function GroupSettleModal({
  isOpen,
  onClose,
  selectedSystems,
  rates,
  debtors,
  onSettleGroup,
  cardReaders = [],
  cashDivisors = [2, 3, 4],
  userRole = 'user',
  userPermissions,
}: GroupSettleModalProps) {
  const canRegisterDebt = userRole === 'admin' || !!userPermissions?.debt;
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'debt' | 'mixed'>('card');
  const [cashDivision, setCashDivision] = useState<number>(1);
  const [mixedCardAmount, setMixedCardAmount] = useState<string>('');
  const [mixedCashAmount, setMixedCashAmount] = useState<string>('');
  const [mixedDebtAmount, setMixedDebtAmount] = useState<string>('');
  const [unifiedCustomerName, setUnifiedCustomerName] = useState<string>('');
  const [selectedCardReaderId, setSelectedCardReaderId] = useState<string>('');

  // Single debt customer choice (or split debt option)
  const [debtCustomerId, setDebtCustomerId] = useState<string>('');
  const [isNewDebtCustomer, setIsNewDebtCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  // Split debt state
  const [isSplitDebt, setIsSplitDebt] = useState(false);
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

  // Calculate stats for all currently selected systems
  const systemCalculations = selectedSystems.map((sys) => {
    if (!sys.activeSession) {
      return {
        id: sys.id,
        name: sys.name,
        type: sys.type,
        durationMinutes: 0,
        gamePlayCost: 0,
        buffetCost: 0,
        totalCost: 0,
        partialPaid: 0,
        netCost: 0,
      };
    }
    const sysRates = rates[sys.type];
    const metrics = getSessionMetrics(sys.activeSession, sysRates);
    const partials = sys.activeSession.partialPayments || [];
    const partialPaid = partials.reduce((acc, p) => acc + p.amount, 0);
    return {
      id: sys.id,
      name: sys.name,
      type: sys.type,
      durationMinutes: metrics.durationMinutes,
      gamePlayCost: metrics.gamePlayCost,
      buffetCost: metrics.buffetCost,
      totalCost: metrics.totalCost,
      partialPaid,
      netCost: Math.max(0, metrics.totalCost - partialPaid),
    };
  });

  const totalGamePlayCostSum = systemCalculations.reduce((acc, cur) => acc + cur.gamePlayCost, 0);
  const totalBuffetCostSum = systemCalculations.reduce((acc, cur) => acc + cur.buffetCost, 0);
  const cleanTotalCostSum = totalGamePlayCostSum + totalBuffetCostSum;
  const totalPartialPaidSum = systemCalculations.reduce((acc, cur) => acc + cur.partialPaid, 0);

  const finalTotalCost = Math.max(0, cleanTotalCostSum + roundingOffset);
  const netGroupCostSum = Math.max(0, cleanTotalCostSum - totalPartialPaidSum + roundingOffset);

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('card');
      setMixedCardAmount('');
      setMixedCashAmount('');
      setMixedDebtAmount('');
      setIsSplitDebt(false);
      setIsNewDebtCustomer(false);
      setUnifiedCustomerName('');
      setNewCustomerName('');
      setNewCustomerPhone('');
      setDebtCustomerId('');
      setError('');
      setRoundingOffset(0);
      if (cardReaders && cardReaders.length > 0) {
        setSelectedCardReaderId(cardReaders[0].id);
      } else {
        setSelectedCardReaderId('');
      }
      setSplitDebtors([
        {
          id: 'dept-0',
          isNew: false,
          selectedDebtorId: '',
          newName: 'مشتری گروهی',
          newPhone: '',
          amount: Math.max(0, cleanTotalCostSum - totalPartialPaidSum),
        }
      ]);
    }
  }, [isOpen, selectedSystems.length, cleanTotalCostSum, cardReaders, totalPartialPaidSum]);

  // Sync mixed inputs with total cost when choosing mixed method
  useEffect(() => {
    if (paymentMethod === 'mixed') {
      const card = Number(mixedCardAmount) || 0;
      const cash = Number(mixedCashAmount) || 0;
      const debt = Number(mixedDebtAmount) || 0;
      if (card === 0 && cash === 0 && debt === 0) {
        setMixedCardAmount(netGroupCostSum.toString());
        setMixedCashAmount('');
        setMixedDebtAmount('');
      }
    }
  }, [paymentMethod, netGroupCostSum]);

  // Sync split debtors amount sum
  const activeDebtAmount =
    paymentMethod === 'debt'
      ? netGroupCostSum
      : (paymentMethod === 'mixed' ? (Number(mixedDebtAmount) || 0) : 0);

  useEffect(() => {
    if (splitDebtors.length === 0) return;
    const sum = splitDebtors.reduce((acc, d) => acc + d.amount, 0);
    if (sum !== activeDebtAmount) {
      if (splitDebtors.length === 1) {
        setSplitDebtors([{ ...splitDebtors[0], amount: activeDebtAmount }]);
      } else {
        const diff = activeDebtAmount - sum;
        const updated = [...splitDebtors];
        updated[0] = { ...updated[0], amount: Math.max(0, updated[0].amount + diff) };
        setSplitDebtors(updated);
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
          isNew: false,
          selectedDebtorId: '',
          newName: '',
          newPhone: '',
          amount: half,
        },
        {
          id: 'debtor-2',
          isNew: false,
          selectedDebtorId: '',
          newName: '',
          newPhone: '',
          amount: activeDebtAmount - half,
        },
      ]);
    } else {
      setSplitDebtors([
        {
          id: 'debtor-0',
          isNew: false,
          selectedDebtorId: '',
          newName: 'مشتری گروهی',
          newPhone: '',
          amount: activeDebtAmount,
        }
      ]);
    }
  };

  const addSplitDebtorNode = () => {
    const defaultAmt = 0;
    setSplitDebtors((prev) => [
      ...prev,
      {
        id: `debtor-${Date.now()}`,
        isNew: false,
        selectedDebtorId: '',
        newName: '',
        newPhone: '',
        amount: defaultAmt,
      },
    ]);
  };

  const removeSplitDebtorNode = (id: string) => {
    if (splitDebtors.length <= 1) return;
    setSplitDebtors((prev) => prev.filter((d) => d.id !== id));
  };

  const updateSplitDebtorField = (id: string, fields: Partial<typeof splitDebtors[number]>) => {
    setSplitDebtors((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...fields } : d))
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

    const sysIds = selectedSystems.map((s) => s.id);
    if (sysIds.length === 0) {
      setError('هیچ دستگاهی انتخاب نشده است.');
      return;
    }

    if (paymentMethod === 'mixed') {
      const card = Number(mixedCardAmount) || 0;
      const cash = Number(mixedCashAmount) || 0;
      const debt = Number(mixedDebtAmount) || 0;
      const accum = card + cash + debt;

      if (accum !== netGroupCostSum) {
        setError(
          `جمع ارقام پرداختی (${formatCurrency(accum)}) با خالص قابل پرداخت فاکتور گروه (${formatCurrency(
            netGroupCostSum
          )}) همخوانی ندارد. اختلاف: ${formatCurrency(netGroupCostSum - accum)}`
        );
        return;
      }
    }

    // Debt payments check
    if (paymentMethod === 'debt') {
      if (!isSplitDebt) {
        if (isNewDebtCustomer) {
          if (!newCustomerName.trim()) {
            setError('لطفاً نام شخص بدهکار جدید را وارد کنید.');
            return;
          }
        } else {
          if (!debtCustomerId) {
            setError('لطفاً یک شخص بدهکار از دفتر مبالغ نسیه انتخاب نمایید.');
            return;
          }
        }
      } else {
        // Multi-split validation
        let splitSum = 0;
        for (let i = 0; i < splitDebtors.length; i++) {
          const item = splitDebtors[i];
          splitSum += item.amount;
          if (item.isNew && !item.newName.trim()) {
            setError(`لطفاً نام را برای بدهکار شماره ${i + 1} وارد کنید.`);
            return;
          }
          if (!item.isNew && !item.selectedDebtorId) {
            setError(`لطفاً شخص بدهکار از لیست دفتر را برای بدهکار شماره ${i + 1} مشخص کنید.`);
            return;
          }
          if (item.amount <= 0) {
            setError(`مبلغ انتسابی برای بدهکار شماره ${i + 1} باید بزرگتر از صفر باشد.`);
            return;
          }
        }

        if (splitSum !== activeDebtAmount) {
          setError(
            `مجموع بدهی افراد با جمع کل نسیه هم‌خوانی ندارد. مجموع افراد: ${formatCurrency(
              splitSum
            )} - نسیه هدف: ${formatCurrency(activeDebtAmount)}`
          );
          return;
        }
      }
    }

    // Mixed & Debt details formatting
    let formattedDebtDetail: { debtorId?: string; name: string; phone?: string; amount: number }[] = [];
    if (activeDebtAmount > 0) {
      if (isSplitDebt) {
        formattedDebtDetail = splitDebtors.map((x) => {
          if (x.isNew) {
            return { name: x.newName, phone: x.newPhone, amount: x.amount };
          } else {
            const dbRef = debtors.find((d) => d.id === x.selectedDebtorId);
            return { debtorId: x.selectedDebtorId, name: dbRef?.name || 'مشتری قدیمی', phone: dbRef?.phone, amount: x.amount };
          }
        });
      } else {
        if (isNewDebtCustomer) {
          formattedDebtDetail = [{ name: newCustomerName, phone: newCustomerPhone, amount: activeDebtAmount }];
        } else {
          const dbRef = debtors.find((d) => d.id === debtCustomerId);
          formattedDebtDetail = [{ debtorId: debtCustomerId, name: dbRef?.name || '', phone: dbRef?.phone, amount: activeDebtAmount }];
        }
      }
    }

    const chosenReader = cardReaders.find(r => r.id === selectedCardReaderId);
    const hasCardComponent = paymentMethod === 'card' || (paymentMethod === 'mixed' && (Number(mixedCardAmount) || 0) > 0);

    onSettleGroup({
      systemIds: sysIds,
      paymentMethod,
      debtCustomerId: !isSplitDebt && !isNewDebtCustomer ? debtCustomerId : undefined,
      newDebtCustomer: !isSplitDebt && isNewDebtCustomer ? { name: newCustomerName, phone: newCustomerPhone } : undefined,
      totalCost: finalTotalCost,
      cashPaidAmount: paymentMethod === 'cash' ? netGroupCostSum : (paymentMethod === 'mixed' ? Number(mixedCashAmount) || 0 : undefined),
      cardPaidAmount: paymentMethod === 'card' ? netGroupCostSum : (paymentMethod === 'mixed' ? Number(mixedCardAmount) || 0 : undefined),
      debtAmount: activeDebtAmount > 0 ? activeDebtAmount : undefined,
      debtDetails: formattedDebtDetail.length > 0 ? formattedDebtDetail : undefined,
      groupCustomerName: unifiedCustomerName.trim() ? unifiedCustomerName.trim() : undefined,
      cardReaderId: hasCardComponent ? (chosenReader?.id || selectedCardReaderId) : undefined,
      cardReaderName: hasCardComponent ? (chosenReader?.name || (selectedCardReaderId ? 'پیش‌فرض' : undefined)) : undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto" dir="rtl">
      <div className="bg-surface-0f1219 border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-8">
        
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700/80 p-5 px-6 flex items-center justify-between text-white relative">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-blue-200" />
            <div>
              <h2 className="text-sm font-black">پرداخت و تسویه حساب گروهی سیستم‌ها</h2>
              <p className="text-[10px] text-blue-100 mt-0.5 opacity-85 leading-normal">
                تسویه حساب همزمان {selectedSystems.length} دستگاه به همراه فروش بوفه متصل بر آن‌ها
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1 px-1.5 rounded-lg bg-black/20 hover:bg-black/35 text-white/80 hover:text-white transition-all font-semibold text-xs"
          >
            بستن <span className="font-sans">×</span>
          </button>
        </div>

        <form onSubmit={handleSettleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-start gap-2.5 leading-relaxed">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Unified customer/payer name input */}
          <div className="p-4 bg-surface-14121a border border-indigo-500/10 rounded-2xl space-y-2">
            <label className="text-[11px] text-indigo-305 font-bold flex items-center gap-1.5 justify-start">
              <User className="w-4 h-4 text-indigo-400" />
              <span>نام نهایی ثبت‌کننده فاکتور کل گروه (مثال: یوسفی)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={unifiedCustomerName}
                onChange={(e) => setUnifiedCustomerName(e.target.value)}
                className="w-full bg-surface-050608 border border-white/10 focus:border-indigo-500 rounded-xl p-2.5 pr-3 text-white font-bold text-xs text-right placeholder-slate-600 focus:outline-none"
                placeholder="در صورت وارد کردن نام، تمام سانس‌های این گروه با این نام ذخیره می‌شوند"
              />
            </div>
          </div>

          {/* List of checked systems and their individual summaries */}
          <div className="space-y-2.5">
            <div className="text-[11px] text-slate-400 font-bold block">ریز جزئیات دستگاه‌های انتخاب شده:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
              {systemCalculations.map((calc) => (
                <div key={calc.id} className="p-3 bg-surface-151921/60 border border-white/5 rounded-xl flex items-center justify-between text-xs transition-hover hover:border-white/10">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white text-xs">{calc.name}</span>
                    <div className="text-[9px] text-slate-400 font-mono">({calc.type}) • {calc.durationMinutes} دقیقه بازی</div>
                    {calc.partialPaid > 0 && (
                      <div className="text-[10px] text-emerald-400 font-bold mt-0.5">
                        🟢 علی‌الحساب: -{formatCurrency(calc.partialPaid)} (مانده: {formatCurrency(calc.netCost)})
                      </div>
                    )}
                  </div>
                  <div className="text-right space-y-0.5">
                    <div className="font-mono text-blue-400 font-bold text-xs">{formatCurrency(calc.totalCost)}</div>
                    <div className="text-[9px] text-slate-500">
                      بازی: {calc.gamePlayCost.toLocaleString()} • بوفه: {calc.buffetCost.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Settle summary calculations */}
          <div className="p-4 bg-surface-151921 border border-white/5 rounded-2xl space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">مجموع کل صورت‌حساب گروه:</span>
              <span className="font-mono font-bold text-white text-sm">{formatCurrency(finalTotalCost)}</span>
            </div>

            {totalPartialPaidSum > 0 && (
              <div className="flex justify-between items-center text-xs pt-1.5 border-t border-white/5">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span>🟢 مجموع علی‌الحساب‌های دریافتی گروه:</span>
                </span>
                <span className="font-mono font-bold text-emerald-400">-{formatCurrency(totalPartialPaidSum)}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <span className="text-white font-black text-sm">خالص مانده جهت تسویه نهایی گروه:</span>
              <div className="text-left flex flex-col items-end">
                <span className="text-xl font-black text-blue-400 font-mono leading-none">{formatCurrency(netGroupCostSum)}</span>
                {roundingOffset !== 0 && (
                  <span className="text-[9px] text-slate-500 mt-1" dir="rtl">
                    تفاوت: <span className={finalTotalCost > cleanTotalCostSum ? 'text-rose-400 font-mono' : 'text-emerald-400 font-mono'}>
                      {finalTotalCost > cleanTotalCostSum ? '+' : ''}{formatCurrency(finalTotalCost - cleanTotalCostSum)}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Rounding total cost option */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              🧮 رند کردن و تسطیح مبلغ فاکتور گروه (تومان)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setRoundingOffset(0)}
                className={`py-2 px-2.5 rounded-xl border text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
                  roundingOffset === 0
                    ? 'border-amber-500/50 bg-amber-500/10 font-bold text-amber-400 shadow-lg shadow-amber-500/5'
                    : 'border-white/5 bg-surface-0b0e14/50 text-slate-400 hover:border-white/10 hover:text-white'
                }`}
              >
                <span className="text-[11px] font-bold">بدون تغییر (واقعی)</span>
                <span className="text-[9px] font-mono opacity-70">{formatCurrency(cleanTotalCostSum)}</span>
              </button>

              <button
                type="button"
                onClick={() => setRoundingOffset((Math.round(cleanTotalCostSum / 1000) * 1000) - cleanTotalCostSum)}
                className={`py-2 px-2.5 rounded-xl border text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
                  roundingOffset === (Math.round(cleanTotalCostSum / 1000) * 1000) - cleanTotalCostSum && roundingOffset !== 0
                    ? 'border-amber-500/50 bg-amber-500/10 font-bold text-amber-400 shadow-lg shadow-amber-500/5'
                    : 'border-white/5 bg-surface-0b0e14/50 text-slate-400 hover:border-white/10 hover:text-white'
                }`}
              >
                <span className="text-[11px] font-bold">نزدیک‌ترین 1,000</span>
                <span className="text-[9px] font-mono opacity-70">{formatCurrency(Math.round(cleanTotalCostSum / 1000) * 1000)}</span>
              </button>

              <button
                type="button"
                onClick={() => setRoundingOffset(prev => prev - 1000)}
                className={`py-2 px-2.5 rounded-xl border text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
                  roundingOffset < 0
                    ? 'border-rose-500/50 bg-rose-500/10 font-bold text-rose-400 shadow-lg shadow-rose-500/5'
                    : 'border-white/5 bg-surface-0b0e14/50 text-slate-400 hover:border-white/10 hover:text-white'
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
                    : 'border-white/5 bg-surface-0b0e14/50 text-slate-400 hover:border-white/10 hover:text-white'
                }`}
              >
                <span className="text-[11px] font-bold">📈 گرد به بالا (1,000+ تومان)</span>
                <span className="text-[9px] font-mono opacity-70">
                  {roundingOffset > 0 ? `افزایش کل: ${formatCurrency(roundingOffset)}` : 'افزایش 1,000 تومانی'}
                </span>
              </button>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 font-bold block">مکانیسم دریافت هزینه و روش تسویه گروهی:</label>
            <div className="grid grid-cols-4 gap-1.5 bg-surface-0b0e14 border border-white/5 p-1 rounded-xl">
              {(['card', 'cash', 'debt', 'mixed'] as const).map((method) => {
                const isDebtMethod = method === 'debt';
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      if (isDebtMethod && !canRegisterDebt) {
                        setError('ثبت پرداخت نسیه در سیستم غیرفعال است. ابتدا دسترسی «دفتر نسیه» را در بخش تنظیمات فعال کنید.');
                        return;
                      }
                      setPaymentMethod(method);
                      setError('');
                    }}
                    className={`py-2 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                      paymentMethod === method
                        ? 'bg-blue-600 text-white shadow'
                        : isDebtMethod && !canRegisterDebt
                        ? 'text-slate-500 opacity-60 hover:text-slate-400'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    {method === 'card' && 'کارت‌خوان'}
                    {method === 'cash' && 'نقدی'}
                    {method === 'debt' && (!canRegisterDebt ? '🔒 نسیه (غیرفعال)' : 'حساب دفتری (نسیه)')}
                    {method === 'mixed' && 'پیشرفته (ترکیبی)'}
                  </button>
                );
              })}
            </div>

            {paymentMethod === 'cash' && (
              <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2.5 animate-in fade-in duration-200 mt-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-right">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-emerald-400 block">💵 تسویه نقدی کامل ({formatCurrency(finalTotalCost)})</span>
                    <span className="text-[9px] text-slate-400 block">ثبت کل مبلغ فاکتور به صورت پول نقد در صندوق.</span>
                  </div>

                  {/* Division Calculator */}
                  <div className="flex items-center gap-1 bg-surface-0b0e14 p-1 border border-emerald-500/30 rounded-lg">
                    <div className="flex items-center gap-1 px-1 text-[10px] text-emerald-400 font-bold border-l border-white/10">
                      <Calculator className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>تقسیم بر:</span>
                    </div>
                    {(cashDivisors || [2, 3, 4]).map((divisor) => (
                      <button
                        key={divisor}
                        type="button"
                        onClick={() => setCashDivision(cashDivision === divisor ? 1 : divisor)}
                        className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                          cashDivision === divisor
                            ? 'bg-emerald-500 text-black shadow-sm'
                            : 'text-emerald-300 hover:bg-emerald-500/20'
                        }`}
                      >
                        ÷{divisor}
                      </button>
                    ))}
                    <div className="flex items-center gap-1 pr-1 border-r border-white/10">
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
                        className="w-11 h-6 bg-surface-151921 border border-emerald-500/40 rounded text-center text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
                        title="تعداد نفرات جهت تقسیم"
                      />
                    </div>
                  </div>
                </div>

                {cashDivision > 1 && (
                  <div className="p-2.5 bg-surface-0b0e14 border border-emerald-500/30 rounded-lg flex items-center justify-between text-emerald-300 text-xs font-semibold animate-in zoom-in-95 duration-150">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">سهم هر نفر (تقسیم بر {cashDivision} نفر):</span>
                      <button
                        type="button"
                        onClick={() => setCashDivision(1)}
                        className="text-[9px] text-rose-400 hover:underline cursor-pointer"
                      >
                        (لغو)
                      </button>
                    </div>
                    <span className="font-mono text-emerald-400 text-sm font-bold">
                      {formatCurrency(Math.round(finalTotalCost / cashDivision))}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card Reader Selection */}
          {(paymentMethod === 'card' || paymentMethod === 'mixed') && (
            <div className="p-3 bg-surface-0b0e14 border border-white/5 rounded-xl space-y-2 text-right">
              <label className="text-[10px] text-slate-405 block font-bold uppercase tracking-wider">
                🔌 انتخاب دستگاه کارتخوان بانکی (POS)
              </label>
              {cardReaders.length === 0 ? (
                <div className="text-[10px] text-amber-400 py-1 font-semibold">
                  ⚠️ هیچ دستگاه کارتخوانی در تنظیمات عمومی تعریف نشده است. تراکنش با کارتخوان پیش‌فرض ثبت خواهد شد.
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedCardReaderId}
                    onChange={(e) => setSelectedCardReaderId(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-surface-050608 border border-white/10 rounded-lg text-white font-semibold cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
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

          {/* SECTION: Mixed Payment Details inputs */}
          {paymentMethod === 'mixed' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4.5 bg-surface-0b0e14 border border-white/5 rounded-2xl text-xs space-y-2 sm:space-y-0">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 block font-bold">پرداخت با کارت‌خوان (تومان):</label>
                <input
                  type="number"
                  dir="ltr"
                  value={mixedCardAmount}
                  onChange={(e) => setMixedCardAmount(e.target.value)}
                  className="w-full bg-surface-050608 border border-white/10 focus:border-blue-500 rounded-lg p-2 text-white font-mono"
                  placeholder="0"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 block font-bold">پرداخت نقدی (تومان):</label>
                <input
                  type="number"
                  dir="ltr"
                  value={mixedCashAmount}
                  onChange={(e) => setMixedCashAmount(e.target.value)}
                  className="w-full bg-surface-050608 border border-white/10 focus:border-blue-500 rounded-lg p-2 text-white font-mono"
                  placeholder="0"
                />
              </div>

              <div className="space-y-1.5 col-span-1">
                <label className="text-[10px] text-slate-400 block font-bold">کیسه نسیه / دفتری (تومان):</label>
                <input
                  type="number"
                  dir="ltr"
                  value={mixedDebtAmount}
                  onChange={(e) => setMixedDebtAmount(e.target.value)}
                  className="w-full bg-surface-050608 border border-white/10 focus:border-blue-500 rounded-lg p-2 text-white font-mono"
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {/* SECTION: Debt / Credit Ledger configuration */}
          {activeDebtAmount > 0 && (
            <div className="p-4.5 bg-surface-1c161d border border-fuchsia-900/20 rounded-2xl space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-500" />
                  <span className="text-white font-extrabold text-[11px]">پیکربندی جزئیات تفکیک بدهکار دفتری ({formatCurrency(activeDebtAmount)})</span>
                </div>
                
                <button
                  type="button"
                  onClick={toggleSplitDebt}
                  className="px-2.5 py-1 text-[9px] bg-slate-800 hover:bg-slate-750 text-slate-350 border border-white/5 hover:border-white/10 rounded-lg font-bold transition-all cursor-pointer"
                >
                  {isSplitDebt ? 'تک نفره (بدهی گروهی)' : 'تفکیک بدهکاران (چندین نفر)'}
                </button>
              </div>

              {!isSplitDebt ? (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-4 bg-black/20 p-1 rounded-xl w-fit border border-white/5">
                    <button
                      type="button"
                      onClick={() => setIsNewDebtCustomer(false)}
                      className={`px-3 py-1 text-[9px] font-bold rounded-lg transition-all ${
                        !isNewDebtCustomer ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      بدهکار قدیمی دفتر
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsNewDebtCustomer(true)}
                      className={`px-3 py-1 text-[9px] font-bold rounded-lg transition-all ${
                        isNewDebtCustomer ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ثبت بدهکار جدید
                    </button>
                  </div>

                  {!isNewDebtCustomer ? (
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400">جستجو و انتخاب مشتری ثبت‌شده در نسیه دفتری:</label>
                      <select
                        value={debtCustomerId}
                        onChange={(e) => setDebtCustomerId(e.target.value)}
                        className="w-full bg-surface-050608 border border-white/10 focus:border-blue-500 rounded-lg p-2.5 text-white"
                      >
                        <option value="">-- انتخاب مشتری --</option>
                        {debtors.map((d) => {
                          const balLabel = d.balance > 0 
                            ? `بدهکاری: ${d.balance.toLocaleString()} تومان` 
                            : d.balance < 0 
                              ? `اعتبار: ${Math.abs(d.balance).toLocaleString()} تومان` 
                              : 'بدون بدهی';
                          return (
                            <option key={d.id} value={d.id}>
                              {d.name} {d.phone ? `(${d.phone})` : ''} - {balLabel}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 block">نام کامل بدهکار جدید:</label>
                        <div className="relative">
                          <User className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="text"
                            value={newCustomerName}
                            onChange={(e) => setNewCustomerName(e.target.value)}
                            className="w-full bg-surface-050608 border border-white/10 focus:border-blue-500 rounded-lg p-2 pr-9 text-white text-xs"
                            placeholder="نام و نام خانوادگی"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 block">شماره موبایل (اختیاری):</label>
                        <div className="relative">
                          <Phone className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="text"
                            value={newCustomerPhone}
                            onChange={(e) => setNewCustomerPhone(e.target.value)}
                            className="w-full bg-surface-050608 border border-white/10 focus:border-blue-500 rounded-lg p-2 pr-9 text-white font-mono text-xs"
                            placeholder="مثال: 09121234567"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {splitDebtors.map((row, idx) => (
                      <div key={row.id} className="p-3 bg-black/30 border border-white/5 rounded-xl space-y-3">
                        <div className="flex items-center justify-between text-[10px] text-indigo-400 font-bold border-b border-white/5 pb-1">
                          <span>بدهکار تفکیکی شماره {idx + 1}</span>
                          {splitDebtors.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSplitDebtorNode(row.id)}
                              className="text-rose-500 hover:text-rose-405 font-bold transition-colors"
                            >
                              حذف سهم
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                          <div className="md:col-span-3">
                            <span className="text-[10px] text-slate-450 block mb-1">نوع مشتری:</span>
                            <div className="flex gap-1 bg-surface-050608 p-0.5 rounded-lg border border-white/10">
                              <button
                                type="button"
                                onClick={() => updateSplitDebtorField(row.id, { isNew: false })}
                                className={`px-2 py-1 text-[9px] rounded font-bold transition-all grow ${
                                  !row.isNew ? 'bg-indigo-650 text-white' : 'text-slate-400'
                                }`}
                              >
                                عضو قدیمی
                              </button>
                              <button
                                type="button"
                                onClick={() => updateSplitDebtorField(row.id, { isNew: true })}
                                className={`px-2 py-1 text-[9px] rounded font-bold transition-all grow ${
                                  row.isNew ? 'bg-indigo-650 text-white' : 'text-slate-400'
                                }`}
                              >
                                بدهکار جدید
                              </button>
                            </div>
                          </div>

                          <div className="md:col-span-5">
                            {!row.isNew ? (
                              <>
                                <span className="text-[10px] text-slate-400 block mb-1">انتخاب بدهکار:</span>
                                <select
                                  value={row.selectedDebtorId}
                                  onChange={(e) => updateSplitDebtorField(row.id, { selectedDebtorId: e.target.value })}
                                  className="w-full bg-surface-050608 border border-white/10 focus:border-indigo-500 rounded-lg p-1.5 text-white text-[11px]"
                                >
                                  <option value="">-- انتخاب --</option>
                                  {debtors.map((d) => {
                                    const balLabel = d.balance > 0 
                                      ? `${d.balance.toLocaleString()} بدهکاری` 
                                      : d.balance < 0 
                                        ? `${Math.abs(d.balance).toLocaleString()} اعتبار` 
                                        : 'بدون بدهی';
                                    return (
                                      <option key={d.id} value={d.id}>
                                        {d.name} {d.phone ? `(${d.phone})` : ''} ({balLabel})
                                      </option>
                                    );
                                  })}
                                </select>
                              </>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-[10px] text-slate-400 block mb-1">نام بدهکار:</span>
                                  <input
                                    type="text"
                                    value={row.newName}
                                    onChange={(e) => updateSplitDebtorField(row.id, { newName: e.target.value })}
                                    className="w-full bg-surface-050608 border border-white/10 focus:border-indigo-500 rounded-lg p-1 text-white text-[11px]"
                                    placeholder="نام جدید"
                                  />
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 block mb-1">تلفن (اختیاری):</span>
                                  <input
                                    type="text"
                                    value={row.newPhone}
                                    onChange={(e) => updateSplitDebtorField(row.id, { newPhone: e.target.value })}
                                    className="w-full bg-surface-050608 border border-white/10 focus:border-indigo-500 rounded-lg p-1 text-white text-[11px] font-mono"
                                    placeholder="شماره (اختیاری)"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="md:col-span-4">
                            <span className="text-[10px] text-slate-400 block mb-1 font-bold">مبلغ انتسابی بدهی (تومان):</span>
                            <input
                              type="number"
                              dir="ltr"
                              value={row.amount || ''}
                              onChange={(e) => updateSplitDebtorField(row.id, { amount: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                              className="w-full bg-surface-050608 border border-white/10 focus:border-indigo-500 rounded-lg p-1.5 text-white font-mono text-center text-[11px]"
                              placeholder="مبلغ"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addSplitDebtorNode}
                    className="w-full py-2 bg-slate-800/60 hover:bg-slate-800 border border-white/5 hover:border-white/10 text-slate-350 hover:text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer text-[10px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن شخص جدید به چیدمان نقسیم بدهی گروهی</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Settle Action buttons footer */}
          <div className="flex gap-3 justify-end border-t border-white/5 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all text-xs cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all text-xs flex items-center gap-2 shadow-lg cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>ثبت و تسویه نهایی گروهی سیستم‌ها</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
