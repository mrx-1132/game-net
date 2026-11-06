import React, { useState } from 'react';
import { 
  FileText, Search, Trash2, X, Play, Pause, 
  CheckCircle2, ShoppingCart, Users, Zap, Shield, Receipt
} from 'lucide-react';
import { SystemLog, SessionHistory, DirectBuffetSale, System, RatesTable, RateConfig } from '../types';
import { getSessionMetrics } from '../utils';
import InvoiceReceiptModal, { InvoiceReceiptData } from './InvoiceReceiptModal';

interface SystemLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: SystemLog[];
  onClearLogs: () => void;
  onAddLog?: (message: string, type?: SystemLog['type']) => void;
  history?: SessionHistory[];
  directSales?: DirectBuffetSale[];
  systems?: System[];
  rates?: RatesTable;
  appName?: string;
  appLogo?: string;
}

export default function SystemLogsModal({
  isOpen,
  onClose,
  logs,
  onClearLogs,
  onAddLog,
  history = [],
  directSales = [],
  systems = [],
  rates,
  appName,
  appLogo,
}: SystemLogsModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [customNote, setCustomNote] = useState('');
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<InvoiceReceiptData | null>(null);

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log => {
    // Exclude pause and resume logs so only session start, session settle, buffet, debt, and system events are logged
    if (log.type === 'session_pause' || log.type === 'session_resume') {
      return false;
    }

    const matchesSearch = 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.systemName && log.systemName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === 'all') return true;
    if (filterType === 'sessions') return ['session_start', 'session_settle'].includes(log.type);
    if (filterType === 'buffet') return log.type === 'buffet';
    if (filterType === 'debt') return log.type === 'debt';
    if (filterType === 'power') return ['power', 'system'].includes(log.type);
    return true;
  });

  const getLogIcon = (type: SystemLog['type']) => {
    switch (type) {
      case 'session_start':
        return <Play className="w-3.5 h-3.5 text-emerald-400" />;
      case 'session_pause':
        return <Pause className="w-3.5 h-3.5 text-amber-400" />;
      case 'session_resume':
        return <Play className="w-3.5 h-3.5 text-blue-400" />;
      case 'session_settle':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'buffet':
        return <ShoppingCart className="w-3.5 h-3.5 text-purple-400" />;
      case 'debt':
        return <Users className="w-3.5 h-3.5 text-indigo-400" />;
      case 'power':
        return <Zap className="w-3.5 h-3.5 text-amber-500" />;
      case 'system':
      default:
        return <Shield className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getLogBadge = (type: SystemLog['type']) => {
    switch (type) {
      case 'session_start':
        return <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[9px] font-bold">شروع نشست</span>;
      case 'session_pause':
        return <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded text-[9px] font-bold">توقف</span>;
      case 'session_resume':
        return <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-[9px] font-bold">ادامه</span>;
      case 'session_settle':
        return <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded text-[9px] font-bold">تسویه</span>;
      case 'buffet':
        return <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded text-[9px] font-bold">بوفه</span>;
      case 'debt':
        return <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded text-[9px] font-bold">نسیه</span>;
      case 'power':
        return <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded text-[9px] font-bold">قطع برق</span>;
      case 'system':
      default:
        return <span className="px-2 py-0.5 bg-slate-500/10 border border-slate-500/20 text-slate-400 rounded text-[9px] font-bold">سیستم</span>;
    }
  };

  const handleAddCustomLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNote.trim()) return;
    if (onAddLog) {
      onAddLog(customNote.trim(), 'system');
      setCustomNote('');
    }
  };

  const formatLogTime = (isoStr: string) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  const buildInvoiceFromLog = (log: SystemLog): InvoiceReceiptData => {
    const logTimeMs = new Date(log.timestamp).getTime();

    // 1. Try to find matching settled game history
    if (history && history.length > 0) {
      const matchedHistory = history.find(h => {
        if (log.systemName && h.systemName === log.systemName) {
          const diff = Math.abs(new Date(h.endTime).getTime() - logTimeMs);
          if (diff < 15 * 60 * 1000) return true;
        }
        if (log.details && log.details.includes(h.id)) return true;
        return false;
      });

      if (matchedHistory) {
        return {
          invoiceNumber: `INV-${matchedHistory.systemName.replace(/\s+/g, '')}-${matchedHistory.id.slice(-4)}`,
          date: matchedHistory.endTime,
          customerName: matchedHistory.customerName || 'مشتری آزاد',
          customerPhone: matchedHistory.customerPhone,
          systemName: matchedHistory.systemName,
          systemType: matchedHistory.systemType,
          startTime: matchedHistory.startTime,
          endTime: matchedHistory.endTime,
          durationMinutes: matchedHistory.durationMinutes,
          playersCount: matchedHistory.playersCount,
          hourlyRate: matchedHistory.hourlyRateUsed,
          gamePlayCost: matchedHistory.gamePlayCost,
          buffetItems: matchedHistory.buffetItems,
          buffetCost: matchedHistory.buffetCost,
          extraServices: matchedHistory.extraServices,
          extraServicesCost: matchedHistory.extraServicesCost,
          partialPayments: matchedHistory.partialPayments,
          totalPartialPaid: matchedHistory.partialPayments?.reduce((s, p) => s + p.amount, 0),
          roundingOffset: matchedHistory.roundingOffset,
          totalCost: matchedHistory.totalCost,
          netPayable: matchedHistory.totalCost,
          paymentMethod: matchedHistory.paymentMethod,
          cashPaidAmount: matchedHistory.cashPaidAmount,
          cardPaidAmount: matchedHistory.cardPaidAmount,
          debtAmount: matchedHistory.debtAmount,
          cardReaderName: matchedHistory.cardReaderName,
          debtDetails: matchedHistory.debtDetails,
          notes: matchedHistory.notes || log.message,
        };
      }
    }

    // 2. Try to find matching direct buffet sale
    if (directSales && directSales.length > 0) {
      const matchedSale = directSales.find(s => {
        const diff = Math.abs(new Date(s.date).getTime() - logTimeMs);
        if (diff < 15 * 60 * 1000) return true;
        if (log.details && log.details.includes(s.id)) return true;
        return false;
      });

      if (matchedSale) {
        return {
          invoiceNumber: `BUF-${matchedSale.id.slice(-4)}`,
          date: matchedSale.date,
          customerName: matchedSale.customerName || 'مشتری بوفه',
          systemName: 'فروش بوفه',
          systemType: 'بوفه آزاد',
          startTime: matchedSale.date,
          endTime: matchedSale.date,
          durationMinutes: 0,
          playersCount: 1,
          gamePlayCost: 0,
          buffetItems: matchedSale.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
          })),
          buffetCost: matchedSale.totalCost,
          totalCost: matchedSale.totalCost,
          netPayable: matchedSale.totalCost,
          paymentMethod: matchedSale.paymentMethod || 'cash',
          cashPaidAmount: matchedSale.paymentMethod === 'cash' || matchedSale.paymentMethod === 'mixed' ? matchedSale.cashPaidAmount || matchedSale.totalCost : 0,
          cardPaidAmount: matchedSale.paymentMethod === 'card' || matchedSale.paymentMethod === 'mixed' ? matchedSale.cardPaidAmount || (matchedSale.paymentMethod === 'card' ? matchedSale.totalCost : 0) : 0,
          debtAmount: matchedSale.paymentMethod === 'debt' ? matchedSale.debtAmount || matchedSale.totalCost : 0,
          cardReaderName: matchedSale.cardReaderName,
          notes: log.message,
        };
      }
    }

    // 3. Try to match currently active system (Live Pre-Invoice)
    if (systems && systems.length > 0 && log.systemName) {
      const activeSys = systems.find(s => s.name === log.systemName && s.status === 'active' && s.activeSession);
      if (activeSys && activeSys.activeSession) {
        const sess = activeSys.activeSession;
        const rateConfig = rates ? rates[activeSys.type] : undefined;
        const metrics = rateConfig ? getSessionMetrics(sess, rateConfig) : null;
        const durationMin = metrics ? Math.floor(metrics.elapsedMs / 60000) : 0;
        const gamePlayCost = metrics ? metrics.gamePlayCost : 0;
        const buffetCost = metrics ? metrics.buffetCost : (sess.buffetItems?.reduce((sum, i) => sum + (i.price * i.quantity), 0) || 0);
        const extraCost = metrics ? metrics.extraServicesCost : (sess.extraServices?.reduce((sum, i) => sum + (i.price * i.quantity), 0) || 0);
        const totalCost = metrics ? metrics.totalCost : (gamePlayCost + buffetCost + extraCost);
        const totalPartial = sess.partialPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

        return {
          invoiceNumber: `PRE-${activeSys.name.replace(/\s+/g, '')}-${log.id.slice(-4)}`,
          date: new Date().toISOString(),
          customerName: sess.customerName || 'مشتری آزاد (پیش‌فاکتور جاری)',
          customerPhone: sess.customerPhone,
          systemName: activeSys.name,
          systemType: activeSys.type,
          startTime: sess.startTime,
          endTime: new Date().toISOString(),
          durationMinutes: durationMin,
          playersCount: sess.playersCount,
          hourlyRate: rates ? (rates[activeSys.type]?.[`hourlyRate${sess.playersCount}P` as keyof RateConfig] || rates[activeSys.type]?.hourlyRate1P) : undefined,
          gamePlayCost: gamePlayCost,
          buffetItems: sess.buffetItems,
          buffetCost: buffetCost,
          extraServices: sess.extraServices,
          extraServicesCost: extraCost,
          partialPayments: sess.partialPayments,
          totalPartialPaid: totalPartial,
          totalCost: totalCost,
          netPayable: Math.max(0, totalCost - totalPartial),
          notes: `پیش‌فاکتور زنده تا زمان ثبت لاگ | ${log.message}`,
        };
      }
    }

    // 4. Fallback parser: extract numbers/costs from message or details
    const textToSearch = `${log.message} ${log.details || ''}`;
    const amountMatch = textToSearch.match(/(\d[\d,]*\d|\d+)\s*(تومان|هزار|ریال)?/);
    const rawNum = amountMatch ? parseInt(amountMatch[1].replace(/,/g, ''), 10) : 0;

    return {
      invoiceNumber: `LOG-${log.id.slice(-5)}`,
      date: log.timestamp,
      customerName: log.systemName ? `رسید رویداد ${log.systemName}` : 'مشتری / رویداد سیستم',
      systemName: log.systemName || 'سامانه گیم‌نت',
      systemType: log.type === 'buffet' ? 'بوفه' : log.type === 'debt' ? 'حساب دفتری' : 'سیستم بازی',
      startTime: log.timestamp,
      endTime: log.timestamp,
      durationMinutes: 0,
      playersCount: 1,
      gamePlayCost: log.type.includes('session') ? rawNum : 0,
      buffetCost: log.type === 'buffet' ? rawNum : 0,
      totalCost: rawNum,
      netPayable: rawNum,
      notes: `${log.message}${log.details ? ` - ${log.details}` : ''}`,
    };
  };

  const canShowInvoiceForLog = (log: SystemLog): boolean => {
    if (log.type === 'system' || log.type === 'power') {
      return false;
    }
    if (log.type === 'session_settle' || log.type === 'buffet' || log.type === 'debt') {
      return true;
    }
    if (log.type === 'session_start' && log.systemName) {
      return true;
    }
    return false;
  };

  const handleOpenLogInvoice = (log: SystemLog) => {
    const invData = buildInvoiceFromLog(log);
    setSelectedInvoiceForModal(invData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl" id="system-logs-modal">
      <div className="bg-[#151921] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#0F1219]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>📜 ثبت و لاگ رویدادهای سیستم</span>
                <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[10px] font-mono font-bold">
                  {filteredLogs.length} مورد
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                تاریخچه فعالیت‌ها، شروع و پایان بازی‌ها، سفارشات بوفه و امکان چاپ پیش‌فاکتور
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-3 border-b border-white/5 bg-[#0F1219]/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجو در لاگ‌ها..."
              className="w-full pr-8 pl-3 py-1.5 bg-[#0B0E14] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none">
            {[
              { key: 'all', label: 'همه' },
              { key: 'sessions', label: '🎮 نشست‌ها' },
              { key: 'buffet', label: '🍿 بوفه' },
              { key: 'debt', label: '👥 نسیه' },
              { key: 'power', label: '⚡ سیستم و برق' },
            ].map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterType(f.key)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  filterType === f.key
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                    : 'bg-[#0B0E14] text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Log List Content */}
        <div className="p-3 overflow-y-auto grow space-y-2 max-h-[50vh]">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log) => (
              <div 
                key={log.id} 
                className="p-2.5 bg-[#0B0E14] border border-white/5 hover:border-white/10 rounded-xl flex items-start justify-between gap-3 text-xs transition-all hover:bg-[#0B0E14]/80 group"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-white/5 border border-white/5 shrink-0 mt-0.5">
                    {getLogIcon(log.type)}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getLogBadge(log.type)}
                      {log.systemName && (
                        <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                          {log.systemName}
                        </span>
                      )}
                      <span className="text-slate-200 font-medium text-[11px] leading-snug">
                        {log.message}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-[10px] text-slate-400 leading-relaxed font-mono pt-0.5">
                        {log.details}
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {canShowInvoiceForLog(log) && (
                    <button
                      type="button"
                      onClick={() => handleOpenLogInvoice(log)}
                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 hover:text-amber-300 border border-amber-500/20 hover:border-amber-500/40 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                      title="مشاهده، چاپ و صدور پیش‌فاکتور / فاکتور این رویداد"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>پیش‌فاکتور</span>
                    </button>
                  )}

                  <div className="text-left font-mono text-[9.5px] text-slate-500 flex flex-col items-end min-w-[50px]">
                    <span>{formatLogTime(log.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <FileText className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
              <p className="text-xs font-medium">هیچ لاگ یا رویدادی یافت نشد.</p>
            </div>
          )}
        </div>

        {/* Custom Log Note Entry */}
        {onAddLog && (
          <form onSubmit={handleAddCustomLogSubmit} className="p-3 border-t border-white/5 bg-[#0F1219]/30 flex items-center gap-2">
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="افزودن یادداشت یا لاگ دستی..."
              className="grow px-3 py-1.5 bg-[#0B0E14] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
            <button
              type="submit"
              disabled={!customNote.trim()}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-xs rounded-xl transition-all cursor-pointer shrink-0"
            >
              + ثبت لاگ
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="p-3 border-t border-white/10 bg-[#0F1219] flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={onClearLogs}
            disabled={logs.length === 0}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 border border-rose-500/20 text-rose-400 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>پاکسازی لاگ‌ها</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition-all cursor-pointer"
          >
            بستن
          </button>
        </div>

      </div>

      {/* Printable Invoice / Pre-Invoice Modal */}
      <InvoiceReceiptModal
        isOpen={selectedInvoiceForModal !== null}
        onClose={() => setSelectedInvoiceForModal(null)}
        invoice={selectedInvoiceForModal}
        clubName={appName}
      />
    </div>
  );
}
