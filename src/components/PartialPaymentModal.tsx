import React, { useState, useEffect } from 'react';
import { X, CreditCard, Wallet, Calculator, CheckCircle2, Trash2, Users, AlertCircle, ArrowDownRight, UserCheck } from 'lucide-react';
import { System, RateConfig, CardReader, PartialPayment } from '../types';
import { formatCurrency, getSessionMetrics } from '../utils';

interface PartialPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  system: System;
  systemRates: RateConfig;
  cardReaders: CardReader[];
  onAddPartialPayment: (
    systemId: string,
    payment: PartialPayment,
    reducePlayerCount: boolean
  ) => void;
  onRemovePartialPayment?: (systemId: string, paymentId: string) => void;
}

export default function PartialPaymentModal({
  isOpen,
  onClose,
  system,
  systemRates,
  cardReaders = [],
  onAddPartialPayment,
  onRemovePartialPayment,
}: PartialPaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('card');
  const [amount, setAmount] = useState<string>('');
  const [selectedCardReaderId, setSelectedCardReaderId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [reducePlayerCount, setReducePlayerCount] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  if (!isOpen || !system.activeSession) return null;

  const session = system.activeSession;
  const metrics = getSessionMetrics(session, systemRates);
  const totalCost = metrics.totalCost;

  // Previous partial payments
  const previousPayments = session.partialPayments || [];
  const totalPreviousPaid = previousPayments.reduce((sum, p) => sum + p.amount, 0);
  const netRemainingCost = Math.max(0, totalCost - totalPreviousPaid);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setNote('');
      setError('');
      setSuccessMsg('');
      setReducePlayerCount((session.playersCount || 1) > 1);
      if (cardReaders.length > 0) {
        setSelectedCardReaderId(cardReaders[0].id);
      } else {
        setSelectedCardReaderId('');
      }
    }
  }, [isOpen, session.playersCount, cardReaders]);

  // Quick division calculators
  const handleDivisionClick = (divisor: number) => {
    if (divisor <= 0) return;
    const share = Math.round((netRemainingCost > 0 ? netRemainingCost : totalCost) / divisor);
    setAmount(share.toString());
    setNote(`سهم ۱ نفر از ${session.playersCount} نفر (تسویه و خروج)`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('لطفاً یک مبلغ معتبر به تومان وارد نمایید.');
      return;
    }

    if (paymentMethod === 'card' && cardReaders.length > 0 && !selectedCardReaderId) {
      setError('لطفاً دستگاه کارت‌خوان مورد نظر را انتخاب کنید.');
      return;
    }

    const selectedCardReader = cardReaders.find((cr) => cr.id === selectedCardReaderId);

    const newPayment: PartialPayment = {
      id: `pp-${Date.now()}`,
      amount: parsedAmount,
      paymentMethod,
      cardReaderId: paymentMethod === 'card' ? selectedCardReaderId : undefined,
      cardReaderName: paymentMethod === 'card' ? selectedCardReader?.name : undefined,
      date: new Date().toISOString(),
      note: note.trim() || `تسویه علی‌الحساب سهم بازیکن`,
    };

    onAddPartialPayment(
      system.id,
      newPayment,
      reducePlayerCount && (session.playersCount || 1) > 1
    );

    setSuccessMsg('پرداخت علی‌الحساب با موفقیت ثبت شد.');
    setTimeout(() => {
      setSuccessMsg('');
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm dir-rtl font-sans animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-surface-0f131c border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-right">
        {/* Header */}
        <div className="p-4 bg-surface-151a26 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">تسویه سهم / دریافت علی‌الحساب</h2>
              <p className="text-[11px] text-slate-400 font-medium">
                سیستم: <span className="text-blue-300 font-bold">{system.name}</span> ({session.customerName})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Bill Summary Banner */}
          <div className="p-4 bg-surface-090c12 border border-white/5 rounded-xl space-y-2.5">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 block font-medium">تعداد دسته/بازیکن فعلی:</span>
                <span className="text-white font-black flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span>{session.playersCount} دسته ({session.playersCount}P)</span>
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 block font-medium">کل صورت‌حساب تا این لحظه:</span>
                <span className="text-blue-400 font-mono font-black text-sm">
                  {formatCurrency(totalCost)}
                </span>
              </div>
            </div>

            {totalPreviousPaid > 0 && (
              <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-emerald-400 block font-medium">مجموع علی‌الحساب دریافتی:</span>
                  <span className="text-emerald-400 font-mono font-bold text-xs">
                    {formatCurrency(totalPreviousPaid)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-400 block font-medium">خالص مانده صورت‌حساب:</span>
                  <span className="text-amber-400 font-mono font-black text-sm">
                    {formatCurrency(netRemainingCost)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* List of Previous Partial Payments */}
          {previousPayments.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-300 block">
                پرداخت‌های علی‌الحساب قبلی این جلسه:
              </span>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {previousPayments.map((payment, idx) => (
                  <div
                    key={payment.id || idx}
                    className="p-2 bg-surface-151924 border border-white/5 rounded-lg flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 font-bold text-white">
                        <span>{payment.note || 'علی‌الحساب'}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">
                          {payment.paymentMethod === 'card' ? `کارت‌خوان (${payment.cardReaderName || 'مرکزی'})` : 'نقدی'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 block">
                        {new Date(payment.date).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-emerald-400 font-black">
                        {formatCurrency(payment.amount)}
                      </span>
                      {onRemovePartialPayment && (
                        <button
                          type="button"
                          onClick={() => onRemovePartialPayment(system.id, payment.id)}
                          className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded transition-all cursor-pointer"
                          title="حذف این پرداخت"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Division Shortcuts */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-300 font-bold flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5 text-blue-400" />
              <span>محاسبه سریع سهم بازیکنان (بر اساس {netRemainingCost > 0 ? 'مانده فاکتور' : 'کل فاکتور'}):</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {([session.playersCount, 4, 3, 2] as const)
                .filter((v, idx, self) => self.indexOf(v) === idx && v >= 1)
                .map((div) => {
                  const shareAmt = Math.round((netRemainingCost > 0 ? netRemainingCost : totalCost) / div);
                  return (
                    <button
                      key={div}
                      type="button"
                      onClick={() => handleDivisionClick(div)}
                      className="p-2 bg-surface-151a26 hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/30 rounded-xl transition-all cursor-pointer text-center group"
                    >
                      <span className="text-[10px] text-slate-400 group-hover:text-blue-300 block font-medium">
                        تقسیم بر {div}
                      </span>
                      <span className="text-xs font-mono font-bold text-white group-hover:text-blue-200 block mt-0.5">
                        {formatCurrency(shareAmt)}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Amount Input */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-bold block">مبلغ پرداختی این بازیکن (تومان):</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="مثال: 25000"
                className="w-full px-3.5 py-2.5 bg-surface-090c12 border border-white/10 focus:border-blue-500 rounded-xl text-white font-mono font-bold text-base focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-left dir-ltr"
              />
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-bold block">روش دریافت مبلغ:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-2.5 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-lg'
                      : 'bg-surface-151a26 border-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>کارت‌خوان</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-2.5 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-lg'
                      : 'bg-surface-151a26 border-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  <span>پرداخت نقدی</span>
                </button>
              </div>
            </div>

            {/* Card Reader Dropdown */}
            {paymentMethod === 'card' && cardReaders.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-bold block">دستگاه کارت‌خوان:</label>
                <select
                  value={selectedCardReaderId}
                  onChange={(e) => setSelectedCardReaderId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-090c12 border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-blue-500"
                >
                  {cardReaders.map((cr) => (
                    <option key={cr.id} value={cr.id}>
                      {cr.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Player Name / Note */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-bold block">نام یا بابت (اختیاری):</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="مثال: سهم علی (خروج از بازی)"
                className="w-full px-3 py-2 bg-surface-090c12 border border-white/10 rounded-xl text-white text-xs font-medium focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Reduce player count checkbox option */}
            {(session.playersCount || 1) > 1 && (
              <div className="p-3 bg-blue-950/30 border border-blue-500/20 rounded-xl flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="reduceCount"
                  checked={reducePlayerCount}
                  onChange={(e) => setReducePlayerCount(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-white/20 bg-surface-090c12 cursor-pointer"
                />
                <label htmlFor="reduceCount" className="text-xs text-slate-200 font-medium cursor-pointer leading-relaxed">
                  <span className="font-bold text-blue-300 block">
                    کاهش ۱ دسته از سیستم پس از خروج این بازیکن
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    تعداد دسته‌های سیستم از{' '}
                    <span className="text-white font-bold">{session.playersCount}P</span> به{' '}
                    <span className="text-emerald-400 font-bold">{session.playersCount - 1}P</span> تغییر خواهد کرد تا تعرفه بقیه بازی با نرخ جدید محاسبه شود.
                  </span>
                </label>
              </div>
            )}

            {/* Error / Success Feedback */}
            {error && (
              <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center gap-2 font-bold animate-pulse">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ثبت دریافت علی‌الحساب</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
