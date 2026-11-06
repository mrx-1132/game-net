import React, { useState } from 'react';
import { X, ArrowRightLeft, AlertCircle, Laptop, Check, Monitor, Users, Clock, Receipt, RefreshCw, ShieldAlert } from 'lucide-react';
import { System, RateConfig } from '../types';
import { formatCurrency, formatDuration, getSessionMetrics } from '../utils';

interface TransferSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceSystem: System;
  systems: System[];
  rates: Record<string, RateConfig>;
  onTransfer: (sourceSystemId: string, targetSystemId: string) => void;
}

export default function TransferSessionModal({
  isOpen,
  onClose,
  sourceSystem,
  systems,
  rates,
  onTransfer,
}: TransferSessionModalProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'free' | 'active'>('all');
  const [showSwapConfirm, setShowSwapConfirm] = useState<boolean>(false);

  if (!isOpen || !sourceSystem || !sourceSystem.activeSession) return null;

  const session = sourceSystem.activeSession;
  
  // Calculate current session usage metrics
  const systemRates = rates[sourceSystem.type];
  const { elapsedMs, durationMinutes, gamePlayCost, buffetCost, totalCost } = getSessionMetrics(
    session,
    systemRates
  );

  // Available target devices (excluding source itself)
  const availableTargetSystems = systems.filter((s) => s.id !== sourceSystem.id);
  const freeSystems = availableTargetSystems.filter((s) => s.status === 'free');
  const activeSystems = availableTargetSystems.filter((s) => s.status === 'active');

  const filteredTargets = availableTargetSystems.filter((s) => {
    if (filterTab === 'free') return s.status === 'free';
    if (filterTab === 'active') return s.status === 'active';
    return true;
  });

  const selectedTarget = systems.find((s) => s.id === selectedTargetId);
  const isTargetActive = selectedTarget?.status === 'active' && !!selectedTarget.activeSession;

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetId) return;

    if (isTargetActive && !showSwapConfirm) {
      setShowSwapConfirm(true);
      return;
    }

    onTransfer(sourceSystem.id, selectedTargetId);
    setShowSwapConfirm(false);
    onClose();
  };

  const handleSelectTarget = (id: string) => {
    setSelectedTargetId(id);
    setShowSwapConfirm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" dir="rtl">
      <div 
        className="w-full max-w-lg bg-surface-151921 border border-white/5 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
        id="transfer-session-modal"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-surface-0b0e14">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-tight">
            <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
            انتقال یا جابجایی صورت‌حساب به سیستم دیگر
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
        <form onSubmit={handleTransferSubmit} className="p-6 space-y-5">
          {/* Active Session Info Box */}
          <div className="p-4 bg-surface-0b0e14/60 border border-white/5 rounded-xl space-y-3">
            <div className="text-[11px] font-black text-slate-400 border-b border-white/5 pb-2">
              مشخصات جلسه فعلی در دستگاه {sourceSystem.name}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs font-sans text-right">
              <div>
                <span className="text-slate-450 block text-[10px] mb-0.5">نام مشتری:</span>
                <span className="text-white font-bold">{session.customerName}</span>
              </div>
              <div>
                <span className="text-slate-450 block text-[10px] mb-0.5">تعداد بازیکن/دسته:</span>
                <span className="text-blue-400 font-bold">{session.playersCount}P</span>
              </div>
              <div>
                <span className="text-slate-450 block text-[10px] mb-0.5">زمان سپری‌شده بازی:</span>
                <span className="text-emerald-400 font-bold font-mono">{formatDuration(elapsedMs)} ({durationMinutes} دقیقه)</span>
              </div>
              <div>
                <span className="text-slate-450 block text-[10px] mb-0.5">مبلغ بوفه متصل:</span>
                <span className="text-amber-400 font-bold font-mono">{formatCurrency(buffetCost)}</span>
              </div>
              <div className="col-span-2 pt-1.5 border-t border-white/5 flex justify-between items-center text-xs">
                <span className="text-slate-400">کل صورت‌حساب انباشته شده تا این لحظه (انتقالی):</span>
                <span className="text-indigo-400 font-black font-mono text-sm">{formatCurrency(totalCost)}</span>
              </div>
            </div>
          </div>

          {/* Select Target System Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                دستگاه مقصد را انتخاب کنید:
              </label>

              {/* Category Tabs */}
              <div className="flex bg-surface-0b0e14 p-0.5 border border-white/5 rounded-lg text-[10px]">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                    filterTab === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  همه ({availableTargetSystems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('free')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                    filterTab === 'free' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🟢 آزاد ({freeSystems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('active')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                    filterTab === 'active' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🟡 فعال ({activeSystems.length})
                </button>
              </div>
            </div>

            {filteredTargets.length === 0 ? (
              <div className="p-4 bg-rose-500/10 border border-rose-500/15 rounded-xl flex items-center gap-3 text-rose-400 text-xs">
                <AlertCircle className="w-5 h-5 shrink-0 animate-pulse" />
                <span>هیچ دستگاهی با فیلتر انتخابی شما یافت نشد.</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {filteredTargets.map((target) => {
                  const isActive = target.status === 'active' && !!target.activeSession;
                  const isSelected = selectedTargetId === target.id;

                  return (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => handleSelectTarget(target.id)}
                      className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between relative cursor-pointer group ${
                        isSelected
                          ? isActive
                            ? 'border-amber-500 bg-amber-500/15 shadow-lg shadow-amber-500/10'
                            : 'border-indigo-500 bg-indigo-600/10 shadow-lg shadow-indigo-500/5'
                          : isActive
                          ? 'border-amber-500/20 bg-surface-16120b hover:border-amber-500/40'
                          : 'border-white/5 bg-surface-0b0e14 hover:border-white/10 hover:bg-surface-11151f'
                      }`}
                    >
                      {isSelected && (
                        <div className={`absolute top-2 left-2 w-4 h-4 rounded-full flex items-center justify-center text-white ${
                          isActive ? 'bg-amber-500' : 'bg-indigo-500'
                        }`}>
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-xs font-bold transition-colors ${
                            isActive ? 'text-amber-200 group-hover:text-amber-400' : 'text-white group-hover:text-indigo-400'
                          }`}>
                            {target.name}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            isActive ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {isActive ? 'در حال استفاده' : 'آزاد'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-450 mt-1 uppercase tracking-wider font-mono block">
                          {target.type}
                        </span>
                      </div>

                      {isActive && target.activeSession && (
                        <div className="mt-2 pt-1.5 border-t border-amber-500/20 text-[10px] text-amber-300/90 font-medium truncate flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                          <span className="truncate">جابجایی با: {target.activeSession.customerName}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Confirmation Swap Banner */}
          {showSwapConfirm && selectedTarget && selectedTarget.activeSession && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3 text-right animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400" />
                <span>تأییدیه جابجایی دوطرفه فاکتور و حساب</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                دستگاه مقصد <strong className="text-amber-300">{selectedTarget.name}</strong> در حال حاضر فعال است و مشتری <strong className="text-amber-300">{selectedTarget.activeSession.customerName}</strong> در حال استفاده می‌باشد.
              </p>
              <p className="text-[11px] text-slate-300 bg-amber-950/40 p-2.5 rounded-lg border border-amber-500/20">
                ⚠️ با تأیید این عملیات، فاکتور کامل <strong className="text-white">{sourceSystem.name}</strong> ({session.customerName}) با فاکتور <strong className="text-white">{selectedTarget.name}</strong> ({selectedTarget.activeSession.customerName}) به صورت دوطرفه جابجا و معاوضه خواهند شد.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSwapConfirm(false)}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTransfer(sourceSystem.id, selectedTargetId);
                    setShowSwapConfirm(false);
                    onClose();
                  }}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-amber-950/50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>تأیید قطعی جابجایی دوطرفه</span>
                </button>
              </div>
            </div>
          )}

          {!showSwapConfirm && (
            <p className="text-[10px] text-slate-500 leading-relaxed bg-surface-0b0e14/40 p-3 border border-white/5 rounded-xl">
              نکته: پس از انتقال یا جابجایی، تمام بوفه‌ها و هزینه بازی تا این لحظه محاسبه و قفل شده و به صورت‌حساب سیستم جدید الحاق می‌شوند. ادامه بازی روی سیستم جدید با نرخ مصوب آن محاسبه خواهد شد.
            </p>
          )}

          {/* Modal Footer */}
          {!showSwapConfirm && (
            <div className="flex items-center gap-3 justify-end border-t border-white/5 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-surface-1b202e hover:bg-surface-232a3d text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer font-bold text-xs"
              >
                لغو عملیات
              </button>
              <button
                type="submit"
                disabled={!selectedTargetId}
                className={`px-5 py-2.5 rounded-xl font-black transition-all text-xs flex items-center gap-1.5 ${
                  selectedTargetId
                    ? isTargetActive
                      ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-950/30 cursor-pointer'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-950/20 cursor-pointer'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>
                  {isTargetActive
                    ? `جابجایی دوطرفه با ${selectedTarget?.name}`
                    : 'تأیید و انتقال به سیستم جدید'}
                </span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
