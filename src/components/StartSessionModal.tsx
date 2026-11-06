import React, { useState } from 'react';
import { X, Users, Play, AlertCircle } from 'lucide-react';
import { System } from '../types';

interface StartSessionModalProps {
  system: System;
  isOpen: boolean;
  onClose: () => void;
  onStart: (customerName: string, playersCount: 1 | 2 | 3 | 4, debtorId?: string, backdateMinutes?: number) => void;
}

export default function StartSessionModal({
  system,
  isOpen,
  onClose,
  onStart,
}: StartSessionModalProps) {
  const [playersCount, setPlayersCount] = useState<1 | 2 | 3 | 4>(1);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    onStart('مشتری عمومی', playersCount, undefined, 0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" dir="rtl">
      <div 
         className="w-full max-w-sm bg-surface-151921 border border-white/5 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
         id="start-session-modal"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-surface-0b0e14">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-tight">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            شروع جلسه بازی - {system.name}
          </h3>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 text-xs">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Controller / Players Counts Selection */}
          <div className="space-y-3">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>تعداد دسته (کنترلر) فعال</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {([1, 2, 3, 4] as const).map((num) => (num === playersCount ? (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPlayersCount(num)}
                  className="py-3 rounded-xl border font-bold text-xs transition-all flex flex-col items-center justify-center gap-0.5 bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)] cursor-pointer"
                >
                  <span className="text-base font-black font-mono">{num}</span>
                  <span className="text-[9px] font-normal font-sans">
                    {num === 1 ? 'تک دسته' : num === 2 ? 'دو دسته' : num === 3 ? 'سه دسته' : 'چهار دسته'}
                  </span>
                </button>
              ) : (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPlayersCount(num)}
                  className="py-3 rounded-xl border border-white/5 text-slate-400 hover:border-white/10 hover:text-white bg-surface-0b0e14/50 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer"
                >
                  <span className="text-base font-black font-mono">{num}</span>
                  <span className="text-[9px] font-normal font-sans">
                    {num === 1 ? 'تک دسته' : num === 2 ? 'دو دسته' : num === 3 ? 'سه دسته' : 'چهار دسته'}
                  </span>
                </button>
              )))}
            </div>
            <p className="text-[9px] text-slate-400 leading-relaxed mt-1">
              نرخ محاسبه هزینه سیستم بر اساس تعداد دسته انتخاب شده در تنظیمات تغییر خواهد کرد.
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-white/5">
            <button
              type="submit"
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10 text-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>شروع جلسه فعال</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 bg-surface-0b0e14 hover:bg-white/5 text-slate-300 font-semibold rounded-xl border border-white/10 transition-all cursor-pointer text-xs"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
