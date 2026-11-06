import React, { useState } from 'react';
import { X, Printer, Copy, Check, Receipt, Gamepad2, Phone, Calendar, Clock, User, ShieldCheck, CreditCard, Banknote, Sparkles } from 'lucide-react';
import { formatCurrency, formatDuration, formatDatePersian } from '../utils';

export interface InvoiceItemDetail {
  name: string;
  quantity: number;
  price: number;
}

export interface InvoiceReceiptData {
  invoiceNumber: string;
  date?: string;
  customerName: string;
  customerPhone?: string;
  systemName: string;
  systemType: string;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  playersCount: number;
  hourlyRate?: number;
  gameplaySegments?: { playersCount: number; minutes: number; cost: number; rate?: number }[];
  pausedMinutes?: number;
  gamePlayCost: number;
  buffetItems?: InvoiceItemDetail[];
  buffetCost: number;
  extraServices?: InvoiceItemDetail[];
  extraServicesCost?: number;
  partialPayments?: {
    amount: number;
    paymentMethod: 'cash' | 'card';
    cardReaderName?: string;
    note?: string;
    date?: string;
  }[];
  totalPartialPaid?: number;
  roundingOffset?: number;
  totalCost: number;
  netPayable?: number;
  paymentMethod?: 'cash' | 'card' | 'debt' | 'mixed';
  cashPaidAmount?: number;
  cardPaidAmount?: number;
  debtAmount?: number;
  cardReaderName?: string;
  debtDetails?: { name: string; phone?: string; amount: number }[];
  splitCount?: number;
  splitPerPerson?: number;
  notes?: string;
}

interface InvoiceReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceReceiptData | null;
  clubName?: string;
}

export default function InvoiceReceiptModal({
  isOpen,
  onClose,
  invoice,
  clubName = 'کلوب و گیم‌نت مجهز'
}: InvoiceReceiptModalProps) {
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a5'>('thermal');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !invoice) return null;

  const netPayableAmount = invoice.netPayable !== undefined ? invoice.netPayable : invoice.totalCost;
  const issueDate = invoice.endTime ? formatDatePersian(invoice.endTime) : formatDatePersian(new Date().toISOString());
  const startDate = formatDatePersian(invoice.startTime);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const textLines = [
      `🧾 فاکتور نهایی - ${clubName}`,
      `شماره فاکتور: ${invoice.invoiceNumber}`,
      `تاریخ: ${issueDate}`,
      `دستگاه: ${invoice.systemName} (${invoice.systemType})`,
      `مشتری: ${invoice.customerName}${invoice.customerPhone ? ` - ${invoice.customerPhone}` : ''}`,
      `مدت بازی: ${invoice.durationMinutes} دقیقه (${invoice.playersCount} دسته)`,
      `هزینه بازی: ${invoice.gamePlayCost.toLocaleString()} تومان`,
    ];

    if (invoice.buffetItems && invoice.buffetItems.length > 0) {
      textLines.push(`--- اقلام بوفه ---`);
      invoice.buffetItems.forEach((it) => {
        textLines.push(`• ${it.name} (${it.quantity} عدد): ${(it.price * it.quantity).toLocaleString()} تومان`);
      });
      textLines.push(`جمع بوفه: ${invoice.buffetCost.toLocaleString()} تومان`);
    }

    if (invoice.extraServices && invoice.extraServices.length > 0) {
      textLines.push(`--- خدمات و تجهیزات ---`);
      invoice.extraServices.forEach((it) => {
        textLines.push(`• ${it.name} (${it.quantity} عدد): ${(it.price * it.quantity).toLocaleString()} تومان`);
      });
      textLines.push(`جمع خدمات: ${(invoice.extraServicesCost || 0).toLocaleString()} تومان`);
    }

    if (invoice.totalPartialPaid && invoice.totalPartialPaid > 0) {
      textLines.push(`علی‌الحساب دریافتی: -${invoice.totalPartialPaid.toLocaleString()} تومان`);
    }

    textLines.push(`مبلغ کل فاکتور: ${invoice.totalCost.toLocaleString()} تومان`);
    textLines.push(`خالص قابل پرداخت: ${netPayableAmount.toLocaleString()} تومان`);

    if (invoice.paymentMethod) {
      const pmLabel = 
        invoice.paymentMethod === 'card' ? `کارت‌خوان ${invoice.cardReaderName || ''}` :
        invoice.paymentMethod === 'cash' ? 'نقدی در صندوق' :
        invoice.paymentMethod === 'debt' ? 'نسیه دفتری' : 'ترکیبی (کارت/نقد/نسیه)';
      textLines.push(`نحوه تسویه: ${pmLabel}`);
    }

    if (invoice.notes) {
      textLines.push(`یادداشت: ${invoice.notes}`);
    }

    textLines.push(`با تشکر از حضور شما در ${clubName}`);

    navigator.clipboard.writeText(textLines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto" dir="rtl">
      {/* Print Stylesheet */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-invoice-receipt, #printable-invoice-receipt * {
            visibility: visible;
          }
          #printable-invoice-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10px;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="bg-[#0D111A] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto text-right text-xs">
        
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#07090E] no-print">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">صورت‌حساب و فاکتور نهایی جامع</h3>
              <p className="text-[10px] text-slate-400">شامل تمامی ریزهزینه‌ها، بوفه، بازی، کسورات و روش پرداخت</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Format toggle */}
            <div className="flex bg-[#151921] p-0.5 border border-white/10 rounded-lg text-[10px]">
              <button
                type="button"
                onClick={() => setPrintFormat('thermal')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  printFormat === 'thermal' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                🧾 رسید حرارتی (80mm)
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('a5')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  printFormat === 'a5' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                📄 فاکتور رسمی (A5)
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable & Scrollable Invoice Preview Area */}
        <div className="p-5 max-h-[75vh] overflow-y-auto bg-[#070A0F]">
          
          <div
            id="printable-invoice-receipt"
            className={`mx-auto bg-white text-slate-900 rounded-xl shadow-2xl p-5 border border-slate-200 transition-all font-sans ${
              printFormat === 'thermal' ? 'max-w-[340px] text-[11px]' : 'max-w-[500px] text-xs'
            }`}
          >
            {/* Header with Title & Logo */}
            <div className="text-center pb-3 border-b-2 border-dashed border-slate-300 space-y-1">
              <div className="flex items-center justify-center gap-1.5 font-black text-sm text-slate-900">
                <Gamepad2 className="w-4 h-4 text-slate-800" />
                <span>{clubName}</span>
              </div>
              <p className="text-[10px] text-slate-600 font-bold">فاکتور رسمی بازی و پذیرایی</p>
              
              <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1 font-mono">
                <span>شماره: #{invoice.invoiceNumber}</span>
                <span>تاریخ: {issueDate}</span>
              </div>
            </div>

            {/* Customer & Device Information */}
            <div className="py-2.5 border-b border-slate-200 grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-slate-500 block">نام مشتری:</span>
                <span className="font-bold text-slate-900 text-xs">{invoice.customerName}</span>
                {invoice.customerPhone && (
                  <span className="text-slate-600 font-mono block text-[9.5px] mt-0.5">{invoice.customerPhone}</span>
                )}
              </div>
              <div className="text-left" dir="ltr">
                <span className="text-slate-500 block text-right" dir="rtl">دستگاه / کنسول:</span>
                <span className="font-bold text-slate-900 block text-right" dir="rtl">
                  {invoice.systemName} <span className="text-slate-500 text-[9.5px]">({invoice.systemType})</span>
                </span>
                <span className="text-slate-600 text-[9.5px] block text-right" dir="rtl">
                  {invoice.playersCount} دسته فعال
                </span>
              </div>
            </div>

            {/* Timing Information */}
            <div className="py-2 border-b border-slate-200 flex justify-between text-[9.5px] text-slate-600">
              <div>
                <span>شروع: </span>
                <span className="font-mono font-medium text-slate-800">{startDate}</span>
              </div>
              <div>
                <span>مدت خالص: </span>
                <span className="font-mono font-bold text-slate-900">{invoice.durationMinutes} دقیقه</span>
                {invoice.pausedMinutes && invoice.pausedMinutes > 0 ? (
                  <span className="text-rose-600 text-[8.5px] mr-1">({invoice.pausedMinutes}د توقف)</span>
                ) : null}
              </div>
            </div>

            {/* Gameplay Breakdown */}
            <div className="py-2.5 border-b border-slate-200 space-y-1">
              <div className="flex justify-between items-center font-bold text-[10.5px]">
                <span className="text-slate-800">🎮 هزینه بازی و استفاده از سیستم:</span>
                <span className="font-mono text-slate-900">{formatCurrency(invoice.gamePlayCost)}</span>
              </div>

              {invoice.gameplaySegments && invoice.gameplaySegments.length > 1 && (
                <div className="bg-slate-50 p-1.5 rounded text-[9px] text-slate-600 space-y-0.5 mt-1 border border-slate-100">
                  <span className="font-bold text-[8.5px] text-slate-700 block mb-0.5">تفکیک بخش‌های تغییر دسته:</span>
                  {invoice.gameplaySegments.map((seg, i) => (
                    <div key={i} className="flex justify-between font-mono">
                      <span>• بخش {i + 1} ({seg.playersCount} دسته - {seg.minutes}د):</span>
                      <span>{seg.cost.toLocaleString()} تومان</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Buffet Items Table */}
            {invoice.buffetItems && invoice.buffetItems.length > 0 && (
              <div className="py-2.5 border-b border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center font-bold text-[10.5px] text-slate-800">
                  <span>🍿 اقلام و خوراکی‌های بوفه ({invoice.buffetItems.length}):</span>
                  <span className="font-mono text-slate-900">{formatCurrency(invoice.buffetCost)}</span>
                </div>

                <table className="w-full text-right text-[9.5px] mt-1">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-100 pb-0.5">
                      <th className="font-medium pb-1">شرح کالا</th>
                      <th className="font-medium text-center pb-1">تعداد</th>
                      <th className="font-medium text-left pb-1">فی واحد</th>
                      <th className="font-medium text-left pb-1">مبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {invoice.buffetItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1 font-medium">{item.name}</td>
                        <td className="py-1 text-center font-mono">{item.quantity}</td>
                        <td className="py-1 text-left font-mono text-[9px] text-slate-500">{item.price.toLocaleString()}</td>
                        <td className="py-1 text-left font-mono font-bold">{(item.price * item.quantity).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Extra Services Table */}
            {invoice.extraServices && invoice.extraServices.length > 0 && (
              <div className="py-2.5 border-b border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center font-bold text-[10.5px] text-slate-800">
                  <span>🛠️ خدمات جانبی و تجهیزات:</span>
                  <span className="font-mono text-slate-900">{formatCurrency(invoice.extraServicesCost || 0)}</span>
                </div>

                <table className="w-full text-right text-[9.5px] mt-1">
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {invoice.extraServices.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1 font-medium">{item.name} ({item.quantity} عدد)</td>
                        <td className="py-1 text-left font-mono font-bold">{(item.price * item.quantity).toLocaleString()} ت</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Deductions & Advances */}
            {invoice.totalPartialPaid && invoice.totalPartialPaid > 0 ? (
              <div className="py-2 border-b border-slate-200 flex justify-between items-center text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1.5 rounded my-1">
                <span>🟢 علی‌الحساب دریافتی قبلی:</span>
                <span className="font-mono">-{formatCurrency(invoice.totalPartialPaid)}</span>
              </div>
            ) : null}

            {/* Rounding Adjustment */}
            {invoice.roundingOffset && invoice.roundingOffset !== 0 ? (
              <div className="py-1 flex justify-between text-[9.5px] text-slate-500">
                <span>تسطیح / رند کردن فاکتور:</span>
                <span className="font-mono">{invoice.roundingOffset > 0 ? '+' : ''}{formatCurrency(invoice.roundingOffset)}</span>
              </div>
            ) : null}

            {/* Final Totals Box */}
            <div className="pt-3 pb-2 border-t-2 border-slate-900 space-y-1.5">
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>جمع کل فاکتور:</span>
                <span className="font-mono font-bold text-slate-800">{formatCurrency(invoice.totalCost)}</span>
              </div>

              <div className="flex justify-between items-center text-sm font-black text-slate-950 bg-slate-100 p-2 rounded-lg border border-slate-200">
                <span>مبلغ نهایی قابل پرداخت:</span>
                <span className="font-mono text-base text-slate-900">{formatCurrency(netPayableAmount)}</span>
              </div>
            </div>

            {/* Settlement Details */}
            {invoice.paymentMethod && (
              <div className="py-2 border-t border-dashed border-slate-300 text-[9.5px] text-slate-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">نحوه تسویه‌حساب:</span>
                  <span className="font-bold">
                    {invoice.paymentMethod === 'card' ? `کارتخوان (${invoice.cardReaderName || 'دستگاه پوز'})` :
                     invoice.paymentMethod === 'cash' ? 'نقدی در صندوق' :
                     invoice.paymentMethod === 'debt' ? 'نسیه دفتری' : 'ترکیبی'}
                  </span>
                </div>

                {invoice.paymentMethod === 'mixed' && (
                  <div className="bg-slate-50 p-1.5 rounded space-y-0.5 font-mono text-[9px] text-slate-600">
                    {invoice.cardPaidAmount && invoice.cardPaidAmount > 0 ? <div>کارتخوان: {invoice.cardPaidAmount.toLocaleString()} ت</div> : null}
                    {invoice.cashPaidAmount && invoice.cashPaidAmount > 0 ? <div>نقدی: {invoice.cashPaidAmount.toLocaleString()} ت</div> : null}
                    {invoice.debtAmount && invoice.debtAmount > 0 ? <div>نسیه: {invoice.debtAmount.toLocaleString()} ت</div> : null}
                  </div>
                )}

                {invoice.debtDetails && invoice.debtDetails.length > 0 && (
                  <div className="text-[8.5px] text-amber-800 bg-amber-50 p-1 rounded">
                    <span>ثبت در حساب دفتری: </span>
                    {invoice.debtDetails.map((d, i) => `${d.name} (${d.amount.toLocaleString()} ت)`).join('، ')}
                  </div>
                )}
              </div>
            )}

            {/* Split per person estimate */}
            {invoice.splitCount && invoice.splitCount > 1 ? (
              <div className="py-1.5 border-t border-slate-200 flex justify-between text-[9px] text-emerald-800 font-bold bg-emerald-50/70 px-2 rounded">
                <span>سهم هر نفر ({invoice.splitCount} بازیکن):</span>
                <span className="font-mono">{formatCurrency(invoice.splitPerPerson || Math.round(netPayableAmount / invoice.splitCount))}</span>
              </div>
            ) : null}

            {/* Notes */}
            {invoice.notes && (
              <div className="py-1.5 border-t border-slate-200 text-[9px] text-slate-600">
                <span className="font-bold text-slate-700">یادداشت: </span>
                <span>{invoice.notes}</span>
              </div>
            )}

            {/* Footer Greeting & Barcode/Sign */}
            <div className="text-center pt-3 mt-2 border-t border-dashed border-slate-300 text-[9px] text-slate-500 space-y-1">
              <p className="font-medium">با تشکر از انتخاب شما - به امید دیدار مجدد</p>
              <p className="text-[7.5px] text-slate-400 font-mono">طراحی و صدور توسط سیستم جامع مدیریت گیم‌نت</p>
            </div>

          </div>

        </div>

        {/* Modal Action Buttons */}
        <div className="p-4 bg-[#07090E] border-t border-white/10 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3.5 py-2 bg-[#151921] hover:bg-[#1e2430] text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/10 flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span>{copied ? 'متن فاکتور کپی شد' : 'کپی متن خلاصه فاکتور'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              بستن
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black shadow-lg shadow-amber-950/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ فاکتور (Print)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
