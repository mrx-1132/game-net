import React, { useState } from 'react';
import { 
  UserPlus, Search, Phone, ClipboardList, 
  Trash2, PlusCircle, MinusCircle, CheckCircle, ShieldAlert,
  Edit3, X, Clock, Lock, Eye, EyeOff, Key
} from 'lucide-react';
import { DebtCustomer, SessionHistory, UserPermissions, Operator } from '../types';
import { formatCurrency, formatDatePersian } from '../utils';

interface DebtTabProps {
  debtors: DebtCustomer[];
  history?: SessionHistory[];
  onAddDebtor: (name: string, phone: string, totalPlayTimeMinutes?: number) => void;
  onUpdateDebtor?: (debtorId: string, name: string, phone: string, totalPlayTimeMinutes?: number) => void;
  onRecordTransaction: (
    debtorId: string, 
    type: 'debt_added' | 'payment_made', 
    amount: number, 
    description: string
  ) => void;
  onDeleteDebtor?: (debtorId: string) => void;
  userRole?: 'admin' | 'user';
  userPermissions?: UserPermissions;
  operators?: Operator[];
  currentOperator?: Operator | null;
  adminPassword?: string;
}

export default function DebtTab({
  debtors,
  history = [],
  onAddDebtor,
  onUpdateDebtor,
  onRecordTransaction,
  onDeleteDebtor,
  userRole = 'user',
  userPermissions,
  operators = [],
  currentOperator,
  adminPassword = '123',
}: DebtTabProps) {
  const canEdit = userRole === 'admin' || !!userPermissions?.allowUserEdits;
  const canRegisterDebt = userRole === 'admin' || !!userPermissions?.debt;
  const [search, setSearch] = useState('');
  const [newDebtorName, setNewDebtorName] = useState('');
  const [newDebtorPhone, setNewDebtorPhone] = useState('');
  const [newDebtorHours, setNewDebtorHours] = useState('');
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null);
  const [deleteConfirmDebtor, setDeleteConfirmDebtor] = useState<DebtCustomer | null>(null);

  // Sensitive Password Authentication Modal State
  const [sensitiveAuthModal, setSensitiveAuthModal] = useState<{
    actionTitle: string;
    onSuccess: (authUserTitle: string) => void;
  } | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);

  // Edit debtor modal states
  const [editingDebtor, setEditingDebtor] = useState<DebtCustomer | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editError, setEditError] = useState('');

  // Manual Transaction states
  const [txType, setTxType] = useState<'debt_added' | 'payment_made'>('payment_made');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');

  // Form error states
  const [debtorError, setDebtorError] = useState('');
  const [txError, setTxError] = useState('');

  const activeDebtor = selectedDebtorId ? debtors.find((d) => d.id === selectedDebtorId) : null;

  // Calculate total play time for a debtor (manual + recorded history)
  const getDebtorPlayTime = (debtor: DebtCustomer): number => {
    let totalMinutes = debtor.totalPlayTimeMinutes || 0;
    if (history && history.length > 0) {
      history.forEach((h) => {
        const isMatched =
          h.debtCustomerId === debtor.id ||
          h.debtDetails?.some((d) => d.debtorId === debtor.id) ||
          (h.customerName && h.customerName.trim().toLowerCase() === debtor.name.trim().toLowerCase());
        if (isMatched && h.durationMinutes) {
          totalMinutes += h.durationMinutes;
        }
      });
    }
    return totalMinutes;
  };

  const formatPlayTime = (totalMinutes: number): string => {
    if (!totalMinutes || totalMinutes <= 0) return '0 دقیقه';
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    if (hours > 0 && mins > 0) {
      return `${hours} ساعت و ${mins} دقیقه`;
    } else if (hours > 0) {
      return `${hours} ساعت`;
    } else {
      return `${mins} دقیقه`;
    }
  };

  const handleOpenEditModal = (debtor: DebtCustomer) => {
    if (!canEdit) {
      alert('ویرایش و تغییر اطلاعات نیازمند مجوز مدیریت است. (جهت فعال‌سازی برای اپراتور عادی به تنظیمات عمومی > سطح دسترسی اپراتور مراجعه کنید)');
      return;
    }
    setEditingDebtor(debtor);
    setEditName(debtor.name);
    setEditPhone(debtor.phone || '');
    const currentMins = debtor.totalPlayTimeMinutes || 0;
    setEditHours(currentMins > 0 ? (currentMins / 60).toString() : '');
    setEditError('');
  };

  const handleSaveDebtorEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebtor) return;
    setEditError('');

    if (!editName.trim()) {
      setEditError('لطفاً نام مشتری را وارد کنید.');
      return;
    }

    const trimmedPhone = editPhone.trim();
    if (trimmedPhone) {
      if (trimmedPhone.length < 10) {
        setEditError('لطفاً یک شماره معتبر وارد کنید (حداقل 10 رقم).');
        return;
      }

      // Check duplicate phone
      if (debtors.some(d => d.id !== editingDebtor.id && d.phone && d.phone === trimmedPhone)) {
        setEditError('این شماره موبایل قبلاً برای مشتری دیگری ثبت شده است.');
        return;
      }
    }

    const parsedHours = parseFloat(editHours);
    const playMins = !isNaN(parsedHours) && parsedHours >= 0 ? Math.round(parsedHours * 60) : (editingDebtor.totalPlayTimeMinutes || 0);

    if (onUpdateDebtor) {
      onUpdateDebtor(editingDebtor.id, editName.trim(), trimmedPhone, playMins);
    }
    setEditingDebtor(null);
  };

  const filteredDebtors = debtors.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search)
  );

  const totalOutstandingDebt = debtors.reduce((sum, d) => sum + d.balance, 0);

  const handleCreateDebtor = (e: React.FormEvent) => {
    e.preventDefault();
    setDebtorError('');

    if (!canRegisterDebt) {
      setDebtorError('ثبت و ایجاد حساب بدهکار جدید نیازمند فعال‌سازی دسترسی «دفتر نسیه» در تنظیمات عمومی است.');
      return;
    }

    if (!canEdit) {
      setDebtorError('ایجاد پرونده مشتری جدید نیازمند مجوز مدیریت یا فعال‌سازی "امکان تغییر اطلاعات توسط کاربر عادی" در تنظیمات عمومی است.');
      return;
    }

    if (!newDebtorName.trim()) {
      setDebtorError('لطفاً نام مشتری را وارد کنید.');
      return;
    }

    const trimmedPhone = newDebtorPhone.trim();
    if (trimmedPhone) {
      if (trimmedPhone.length < 10) {
        setDebtorError('لطفاً یک شماره معتبر وارد کنید (حداقل 10 رقم).');
        return;
      }

      // Check duplicate phone
      if (debtors.some(d => d.phone && d.phone === trimmedPhone)) {
        setDebtorError('این شماره موبایل قبلاً در سیستم ثبت شده است.');
        return;
      }
    }

    const parsedHours = parseFloat(newDebtorHours);
    const playMins = !isNaN(parsedHours) && parsedHours >= 0 ? Math.round(parsedHours * 60) : 0;

    onAddDebtor(newDebtorName.trim(), trimmedPhone, playMins);
    setNewDebtorName('');
    setNewDebtorPhone('');
    setNewDebtorHours('');
    setDebtorError('');
  };

  const handleConfirmSensitiveAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sensitiveAuthModal) return;

    const trimmedPass = authPassword.trim();
    if (!trimmedPass) {
      setAuthError('لطفاً رمز عبور را وارد نمایید.');
      return;
    }

    let authUserTitle = '';
    if (adminPassword && trimmedPass === adminPassword) {
      authUserTitle = 'مدیر سیستم';
    } else if (currentOperator?.password && trimmedPass === currentOperator.password) {
      authUserTitle = `اپراتور ${currentOperator.name}`;
    } else {
      const matchedOp = operators?.find((op) => op.isActive && op.password === trimmedPass);
      if (matchedOp) {
        authUserTitle = `اپراتور ${matchedOp.name}`;
      }
    }

    if (!authUserTitle) {
      setAuthError('رمز عبور وارد شده اشتباه است!');
      return;
    }

    sensitiveAuthModal.onSuccess(authUserTitle);
    setSensitiveAuthModal(null);
    setAuthPassword('');
    setAuthError('');
  };

  const handleCreateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    setTxError('');

    if (!canRegisterDebt) {
      setTxError('ثبت تراکنش در دفتر نسیه نیازمند فعال‌سازی دسترسی «دفتر نسیه» در بخش تنظیمات عمومی است.');
      return;
    }

    if (!activeDebtor) return;

    const amount = Number(txAmount);
    if (!txAmount || isNaN(amount) || amount <= 0) {
      setTxError('لطفاً مبلغ معتبر و بزرکتری را وارد کنید.');
      return;
    }

    let defaultDesc = '';
    if (txType === 'payment_made') {
      if (activeDebtor.balance > 0) {
        if (amount > activeDebtor.balance) {
          defaultDesc = `تسویه بدهی (${formatCurrency(activeDebtor.balance)}) و شارژ مابقی مبلغ به عنوان اعتبار حساب`;
        } else if (amount === activeDebtor.balance) {
          defaultDesc = `تسویه کامل بدهی (${formatCurrency(activeDebtor.balance)})`;
        } else {
          defaultDesc = `پرداخت بخشی از بدهی (${formatCurrency(amount)})`;
        }
      } else {
        defaultDesc = `شارژ مستقیم حساب (افزایش اعتبار دفتری به مبلغ ${formatCurrency(amount)})`;
      }
    } else {
      if (activeDebtor.balance < 0) {
        const absoluteCredit = Math.abs(activeDebtor.balance);
        if (amount > absoluteCredit) {
          defaultDesc = `کسر کل اعتبار (${formatCurrency(absoluteCredit)}) و ثبت مابقی به عنوان بدهکاری`;
        } else {
          defaultDesc = `خرید/بازی با کسر ${formatCurrency(amount)} از اعتبار دفتری`;
        }
      } else {
        defaultDesc = `ثبت بدهی متفرقه (افزایش بدهکاری به مبلغ ${formatCurrency(amount)})`;
      }
    }

    const finalDesc = txDesc.trim() || defaultDesc;

    const actionTitle = txType === 'payment_made'
      ? `ثبت دریافت وجه / تسویه حساب مشتری «${activeDebtor.name}» به مبلغ ${formatCurrency(amount)}`
      : `ثبت و افزایش بدهکاری مشتری «${activeDebtor.name}» به مبلغ ${formatCurrency(amount)}`;

    // Requires password authentication for sensitive financial actions (both receiving payments and adding debts)
    setSensitiveAuthModal({
      actionTitle,
      onSuccess: (authUserTitle: string) => {
        const descWithOperator = `${finalDesc} (ثبت توسط: ${authUserTitle})`;
        onRecordTransaction(activeDebtor.id, txType, amount, descWithOperator);
        setTxAmount('');
        setTxDesc('');
        setTxError('');
      }
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* Top Ledger Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 text-xs block">کل مانده طلب مرکز (نسیه معوق)</span>
            <span className="text-xl font-bold text-amber-400 font-mono">
              {formatCurrency(totalOutstandingDebt)}
            </span>
          </div>
        </div>

        <div className="p-4 bg-[#151921] border border-white/5 rounded-2xl flex items-center gap-4 shadow-xl">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 text-xs block">تعداد حساب‌های فعال نسیه</span>
            <span className="text-xl font-bold text-white font-mono">
              {debtors.length} نفر
            </span>
          </div>
        </div>

        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 text-xs block">تسویه حدنصابی</span>
            <span className="text-slate-300 text-xs mt-1 block">
              نسیه مشتریان معتمد گیم‌نت با ثبت شماره موبایل دوطرفه انجام می‌شود.
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Column 1: Add New Customer & Search (Takes 5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Form: Add Debtor */}
          <div className="p-5 bg-[#151921] border border-white/5 rounded-2xl space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-400" />
              افزودن حساب نسیه جدید
            </h3>
            
            {debtorError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{debtorError}</span>
              </div>
            )}

            <form onSubmit={handleCreateDebtor} className="space-y-3 text-sm">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 block font-medium">نام بدهکار (مثال: آرش کیانی)</label>
                <input
                  type="text"
                  placeholder="نام و نام خانوادگی مشتری"
                  value={newDebtorName}
                  onChange={(e) => setNewDebtorName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0E14] border border-white/10 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 block font-medium">شماره موبایل جهت هماهنگی (اختیاری)</label>
                <div className="relative">
                  <span className="absolute right-3 top-2.5 text-slate-500">
                    <Phone className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="tel"
                    placeholder="نمونه: 09123456789 (اختیاری)"
                    value={newDebtorPhone}
                    onChange={(e) => setNewDebtorPhone(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 bg-[#0B0E14] border border-white/10 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 block font-medium">ساعت بازی اولیه ثبت‌شده (اختیاری)</label>
                <div className="relative">
                  <span className="absolute right-3 top-2.5 text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="مثال: 50 (ساعت)"
                    value={newDebtorHours}
                    onChange={(e) => setNewDebtorHours(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 bg-[#0B0E14] border border-white/10 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all text-xs flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(59,130,246,0.15)] cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                ایجاد پرونده نسیه مشتری
              </button>
            </form>
          </div>

          {/* List of debtors & Search */}
          <div className="p-5 bg-[#151921] border border-white/5 rounded-2xl space-y-4 shadow-xl">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">لیست مشتریان بدهکار</h3>
              <p className="text-[10px] text-slate-400">یک شخص را جهت تسویه یا ثبت بدهی از پایین انتخاب نمایید.</p>
            </div>

            <div className="relative text-sm">
              <span className="absolute right-3 top-2.5 text-slate-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="جستجو با نام یا شماره تماس..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-10 pl-3 py-2 bg-[#0B0E14] border border-white/10 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
              />
            </div>

            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
              {filteredDebtors.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  هیچ فردی یافت نشد.
                </div>
              ) : (
                filteredDebtors.map((debtor) => {
                  const isSelected = selectedDebtorId === debtor.id;
                  return (
                    <div
                      key={debtor.id}
                      onClick={() => setSelectedDebtorId(debtor.id)}
                      className={`w-full p-3 rounded-xl border text-right transition-all flex justify-between items-center cursor-pointer relative group ${
                        isSelected
                          ? debtor.balance > 0
                            ? 'bg-amber-500/10 border-amber-500/80 shadow-lg shadow-amber-500/5'
                            : debtor.balance < 0
                              ? 'bg-emerald-500/10 border-emerald-500/80 shadow-lg shadow-emerald-500/5'
                              : 'bg-blue-500/10 border-blue-500/80 shadow-lg shadow-blue-500/5'
                          : 'bg-[#0B0E14]/40 border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-white block">{debtor.name}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {debtor.phone ? (
                            <span className="text-[10px] font-medium text-slate-400 block font-mono">
                              {debtor.phone}
                            </span>
                          ) : (
                            <span className="text-[9.5px] font-medium text-amber-400/80 block font-sans">
                              بدون شماره
                            </span>
                          )}
                          <span className="text-[9.5px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                            {formatPlayTime(getDebtorPlayTime(debtor))}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-left">
                          {debtor.balance > 0 ? (
                            <>
                              <span className="text-xs font-semibold font-mono text-amber-400">
                                {formatCurrency(debtor.balance)}
                              </span>
                              <span className="text-[8px] text-amber-400/80 block font-sans">بدهکار (معوق)</span>
                            </>
                          ) : debtor.balance < 0 ? (
                            <>
                              <span className="text-xs font-semibold font-mono text-emerald-400">
                                {formatCurrency(Math.abs(debtor.balance))}
                              </span>
                              <span className="text-[8px] text-emerald-400/80 block font-sans">بستانکار (شارژ)</span>
                            </>
                          ) : (
                            <>
                              <span className="text-xs font-semibold font-mono text-slate-400">
                                {formatCurrency(0)}
                              </span>
                              <span className="text-[8px] text-slate-500 block font-sans">تسویه شده</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(debtor);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all cursor-pointer"
                            title="ویرایش نام یا شماره مشتری"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteDebtor && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmDebtor(debtor);
                              }}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                              title="حذف مستقیم پرونده مشتری"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Financial Panel & Transactions (Takes 7 cols) */}
        <div className="lg:col-span-7">
          {activeDebtor ? (
            <div className="bg-[#151921] border border-white/5 rounded-2xl p-6 space-y-6 shadow-xl">
              
              {/* Profile Card Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-[#0B0E14]/60 rounded-xl border border-white/5">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-md font-bold text-white">{activeDebtor.name}</h4>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(activeDebtor)}
                      className="px-2 py-0.5 rounded-md bg-blue-500/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                      title="ویرایش نام یا شماره تماس مشتری"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{activeDebtor.phone ? 'ویرایش شماره / نام' : '+ افزودن شماره تماس'}</span>
                    </button>
                  </div>
                  <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-400" />
                    {activeDebtor.phone ? (
                      <span className="text-blue-300 font-mono text-xs">{activeDebtor.phone}</span>
                    ) : (
                      <span className="text-amber-400/90 text-[11px] font-sans font-medium">
                        بدون شماره تماس (جهت ثبت شماره کلیک کنید)
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right flex items-center gap-4 bg-[#0B0E14] p-3 rounded-lg border border-white/5 flex-wrap">
                  {/* Total Gameplay Hours Badge */}
                  <div className="text-right border-l border-white/10 pl-4">
                    <span className="text-[10px] text-emerald-400 block leading-3 font-bold flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      مجموع کارکرد / ساعت بازی:
                    </span>
                    <span className="text-base font-black text-emerald-400 font-mono mt-0.5 block">
                      {formatPlayTime(getDebtorPlayTime(activeDebtor))}
                    </span>
                  </div>

                  <div>
                    {activeDebtor.balance > 0 ? (
                      <>
                        <span className="text-[10px] text-amber-400 block leading-3 font-bold">بدهکاری (مانده معوق):</span>
                        <span className="text-lg font-black text-amber-400 font-mono">
                          {formatCurrency(activeDebtor.balance)}
                        </span>
                      </>
                    ) : activeDebtor.balance < 0 ? (
                      <>
                        <span className="text-[10px] text-emerald-400 block leading-3 font-bold">اعتبار حساب (شارژ شده):</span>
                        <span className="text-lg font-black text-emerald-400 font-mono">
                          {formatCurrency(Math.abs(activeDebtor.balance))}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] text-slate-450 block leading-3 font-bold">وضعیت حساب:</span>
                        <span className="text-lg font-black text-slate-400 font-mono">
                          تسویه کامل (۰ تومان)
                        </span>
                      </>
                    )}
                  </div>

                  {onDeleteDebtor && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirmDebtor(activeDebtor);
                      }}
                      className="p-1.5 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all cursor-pointer"
                      title="حذف کامل حساب مشتری"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Form: Record manual adjustment (Pay / Debt) */}
              <div className="p-4 bg-[#0B0E14]/40 border border-white/5 rounded-xl">
                <h5 className="text-xs font-bold text-slate-300 block mb-3">ثبت تراکنش حسابداری دستی</h5>
                
                {txError && (
                  <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>{txError}</span>
                  </div>
                )}

                <form onSubmit={handleCreateTransaction} className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs items-end">
                  
                  {/* Type Toggler */}
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[10px] text-slate-400 block">نوع تراکنش</label>
                    <select
                      value={txType}
                      onChange={(e) => setTxType(e.target.value as any)}
                      className="w-full px-2 py-2 bg-[#151921] border border-white/5 rounded-lg text-white text-xs focus:outline-none"
                    >
                      <option value="payment_made">🟢 دریافت پرداخت (کاهش بدهی)</option>
                      <option value="debt_added">🔴 ثبت بدهی جدید (افزایش بدهی)</option>
                    </select>
                  </div>

                  {/* Amount Value */}
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[10px] text-slate-400 block">مبلغ ارز (تومان) *</label>
                    <input
                      type="number"
                      placeholder="مثال: 50000"
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      className="w-full px-2.5 py-2 bg-[#151921] border border-white/5 rounded-lg text-white text-xs font-mono"
                    />
                    {txAmount && !isNaN(Number(txAmount)) && (
                      <span className="text-[10px] text-emerald-400 block font-mono font-bold mt-1 text-right">
                        👈 {formatCurrency(Number(txAmount))}
                      </span>
                    )}
                  </div>

                  {/* Description Box */}
                  <div className="md:col-span-4 space-y-1 text-right">
                    <label className="text-[10px] text-slate-400 block">توضیحات تراکنش (اختیاری)</label>
                    <input
                      type="text"
                      placeholder="توضیح کوتاه تراکنش..."
                      value={txDesc}
                      onChange={(e) => setTxDesc(e.target.value)}
                      className="w-full px-2.5 py-2 bg-[#151921] border border-white/5 rounded-lg text-white text-xs"
                    />
                  </div>

                  {/* Confirm Action */}
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className={`w-full py-2 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 text-white cursor-pointer ${
                        txType === 'payment_made' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                      }`}
                    >
                      {txType === 'payment_made' ? (
                        <>
                          <MinusCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>ثبت پرداخت</span>
                        </>
                      ) : (
                        <>
                          <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>افزودن بدهی</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Transactions History Logs */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">سوابق تراکنش‌های مشتری</h5>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg text-amber-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      <span>رنگ زرد برای بدهکاری</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg text-emerald-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>رنگ سبز برای پرداخت</span>
                    </div>
                  </div>
                </div>
                <div className="border border-white/5 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-right" dir="rtl">
                    <thead>
                      <tr className="bg-[#0B0E14] font-semibold text-slate-400 border-b border-white/5">
                        <th className="px-4 py-3">تاریخ تراکنش</th>
                        <th className="px-4 py-3">شرح تراکنش</th>
                        <th className="px-4 py-3 text-left">مبلغ و تغییرات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 bg-[#0B0E14]/20">
                      {activeDebtor.transactions.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-slate-550">
                            هیچ تراکنشی ثبت نشده است.
                          </td>
                        </tr>
                      ) : (
                        activeDebtor.transactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 text-slate-400 font-mono text-[10px]">
                              {formatDatePersian(tx.date)}
                            </td>
                            <td className="px-4 py-3 text-slate-150 font-medium">
                              {tx.description}
                            </td>
                            <td className="px-4 py-3 text-left font-mono font-bold">
                              {tx.type === 'payment_made' ? (
                                <span className="text-emerald-400">
                                  -{formatCurrency(tx.amount)}
                                </span>
                              ) : (
                                <span className="text-amber-400">
                                  +{formatCurrency(tx.amount)}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col justify-center items-center py-20 px-6 border border-dashed border-white/10 rounded-2xl bg-[#151921]/20 text-center text-slate-500">
              <ClipboardList className="w-12 h-12 text-slate-600 mb-4 animate-pulse" />
              <p className="text-sm font-semibold max-w-[280px] mx-auto text-slate-400 leading-relaxed">
                لطفاً یک مشتری را از لیست سمت راست انتخاب کنید تا پرونده بدهی‌ها و خریدهای نسیه او را مدیریت کنید.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Custom Edit Debtor Info Modal */}
      {editingDebtor && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[999] animate-fade-in" style={{ direction: 'rtl' }}>
          <div className="bg-[#121620] border border-blue-500/30 max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl p-5 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                <Phone className="w-4 h-4 text-blue-400" />
                <span>ویرایش / ثبت شماره مشتری نسیه</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingDebtor(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveDebtorEdit} className="space-y-3.5 text-xs text-right">
              <div>
                <label className="text-[11px] text-slate-300 font-bold block mb-1">نام و نام خانوادگی بدهکار:</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#080A0F] border border-white/10 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  placeholder="مثال: آرش کیانی"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-bold block mb-1">شماره موبایل / تماس:</label>
                <div className="relative">
                  <input
                    type="tel"
                    dir="ltr"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-[#080A0F] border border-white/10 focus:border-blue-500 rounded-xl px-3 py-2 pl-9 text-xs text-white font-mono focus:outline-none text-left"
                    placeholder="09123456789"
                  />
                  <Phone className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  شماره تماس جهت هماهنگی و تسویه حساب دفتری نسیه
                </p>
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-bold block mb-1">مجموع کارکرد / ساعت بازی ثبت شده (ساعت):</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={editHours}
                    onChange={(e) => setEditHours(e.target.value)}
                    className="w-full bg-[#080A0F] border border-white/10 focus:border-blue-500 rounded-xl px-3 py-2 pl-9 text-xs text-white font-mono focus:outline-none text-left"
                    placeholder="مثال: 50"
                  />
                  <Clock className="w-4 h-4 text-emerald-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  می‌توانید ساعت بازی و کارکرد کلی این مشتری را به ساعت وارد نمایید (مثلاً ۵۰).
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
                >
                  ذخیره تغییرات
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDebtor(null)}
                  className="px-4 py-2 bg-[#080A0F] hover:bg-white/10 text-slate-300 text-xs rounded-xl border border-white/10 transition-all cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmDebtor && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[999] animate-fade-in" style={{ direction: 'rtl' }}>
          <div className="bg-[#121620] border border-red-500/20 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl p-6 space-y-5 relative">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold text-white leading-normal">حذف کامل پرونده مشتری</h3>
                <p className="text-[10px] text-zinc-500 leading-normal">عملیات غیر قابل برگشت است</p>
              </div>
            </div>

            <div className="space-y-2 text-right">
              <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                آیا از حذف پرونده مشتری <span className="text-white font-bold">"{deleteConfirmDebtor.name}"</span> و پاک شدن تمام سوابق و تراکنش‌های او مطمئن هستید؟
              </p>
              {deleteConfirmDebtor.balance > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-amber-400">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <p className="text-[10px] font-bold leading-normal">
                    توجه: این مشتری دارای مانده بدهی تصفیه نشده به مبلغ <span className="font-mono text-xs">{formatCurrency(deleteConfirmDebtor.balance)}</span> می‌باشد!
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmDebtor(null)}
                className="px-4 py-2 bg-[#1b202e] hover:bg-[#232a3d] text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer font-bold text-xs"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  const debtorToDelete = deleteConfirmDebtor;
                  setSensitiveAuthModal({
                    actionTitle: `پاک کردن و حذف کامل پرونده مشتری «${debtorToDelete.name}»`,
                    onSuccess: () => {
                      if (onDeleteDebtor) {
                        onDeleteDebtor(debtorToDelete.id);
                      }
                      if (selectedDebtorId === debtorToDelete.id) {
                        setSelectedDebtorId(null);
                      }
                      setDeleteConfirmDebtor(null);
                    },
                  });
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-lg shadow-red-950/20 font-black transition-all cursor-pointer text-xs"
              >
                تأیید و حذف کامل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sensitive Changes Operator Password Verification Modal */}
      {sensitiveAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in" style={{ direction: 'rtl' }}>
          <div className="bg-[#121620] border border-amber-500/40 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl p-6 space-y-5 relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                <span>تأیید تغییرات حساس (ورود رمز عبور)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSensitiveAuthModal(null);
                  setAuthPassword('');
                  setAuthError('');
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1 text-right">
              <p className="text-xs font-bold text-amber-300">
                {sensitiveAuthModal.actionTitle}
              </p>
              <p className="text-[10.5px] text-slate-300 leading-relaxed mt-1">
                عملیات درخواستی (مانند ثبت/افزایش بدهی یا پاک کردن) جزو تغییرات حساس سیستم است. جهت ادامه لطفاً رمز عبور اپراتور شیفت یا مدیریت را وارد کنید.
              </p>
            </div>

            {authError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2 font-bold text-right">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmSensitiveAuth} className="space-y-4 text-right">
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1.5">رمز عبور اپراتور یا مدیر کل:</label>
                <div className="relative">
                  <input
                    type={showAuthPassword ? "text" : "password"}
                    value={authPassword}
                    onChange={(e) => {
                      setAuthPassword(e.target.value);
                      setAuthError('');
                    }}
                    className="w-full bg-[#080A0F] border border-white/10 focus:border-amber-500 rounded-xl px-3 py-2.5 pl-10 text-xs text-white font-mono focus:outline-none"
                    placeholder="رمز عبور را وارد کنید..."
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthPassword(!showAuthPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-1"
                  >
                    {showAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-950/20 flex items-center justify-center gap-1.5"
                >
                  <Key className="w-4 h-4" />
                  <span>تأیید و اجرای عملیات</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSensitiveAuthModal(null);
                    setAuthPassword('');
                    setAuthError('');
                  }}
                  className="px-4 py-2.5 bg-[#080A0F] hover:bg-white/10 text-slate-300 text-xs rounded-xl border border-white/10 transition-all cursor-pointer font-bold"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
