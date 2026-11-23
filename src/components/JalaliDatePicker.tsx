import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface JalaliDatePickerProps {
  value: string; // ISO gregorian yyyy-mm-dd or ''
  onChange: (iso: string) => void;
  onClear: () => void;
  getJalali: (d: Date) => { jy: number; jm: number; jd: number };
  jdnFromJalali: (jy: number, jm: number, jd: number) => number;
  toPersianDigits: (s: string | number) => string;
  className?: string;
}

const MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const WEEK_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

// طول ماه جلالی؛ اسفند بر اساس چرخه کبیسه ۳۳-ساله استاندارد
function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  const g = jy % 33;
  const isLeap = g === 1 || g === 5 || g === 9 || g === 13 || g === 17 || g === 22 || g === 26 || g === 30;
  return isLeap ? 30 : 29;
}

// تبدیل تاریخ جلالی به میلادی با جست‌وجوی دودویی روی همان مبدل پروژه (getJalali)
// تا تقویم همیشه دقیقاً با بقیه گزارش هماهنگ باشد.
function jalaliToGregorian(
  jy: number, jm: number, jd: number,
  getJalali: (d: Date) => { jy: number; jm: number; jd: number },
): Date {
  let lo = Date.UTC(jy + 621, 0, 1); // حدود ابتدای سال میلادی متناظر
  let hi = Date.UTC(jy + 622, 11, 31);
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const j = getJalali(new Date(mid));
    const cmp = j.jy * 10000 + j.jm * 100 + j.jd;
    if (cmp < jy * 10000 + jm * 100 + jd) lo = mid; else hi = mid;
  }
  return new Date(hi);
}

export default function JalaliDatePicker({ value, onChange, onClear, getJalali, jdnFromJalali, toPersianDigits, className }: JalaliDatePickerProps) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => getJalali(new Date()), [getJalali]);
  const [viewYear, setViewYear] = useState<number>(today.jy);
  const [viewMonth, setViewMonth] = useState<number>(today.jm);

  const selectedJalali = useMemo(() => {
    if (!value) return null;
    const d = new Date(value + 'T12:00:00');
    return isNaN(d.getTime()) ? null : getJalali(d);
  }, [value, getJalali]);

  const grid = useMemo(() => {
    const firstDate = jalaliToGregorian(viewYear, viewMonth, 1, getJalali);
    const weekday = firstDate.getUTCDay(); // 0=Sunday
    const offset = (weekday + 1) % 7; // شنبه‌محور
    const cells: (number | null)[] = Array(offset).fill(null);
    const len = jalaliMonthLength(viewYear, viewMonth);
    for (let i = 1; i <= len; i++) cells.push(i);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth, getJalali]);

  const label = selectedJalali
    ? toPersianDigits(`${selectedJalali.jy}/${String(selectedJalali.jm).padStart(2, '0')}/${String(selectedJalali.jd).padStart(2, '0')}`)
    : '';

  const pick = (day: number) => {
    const g = jalaliToGregorian(viewYear, viewMonth, day, getJalali);
    const iso = `${g.getUTCFullYear()}-${String(g.getUTCMonth() + 1).padStart(2, '0')}-${String(g.getUTCDate()).padStart(2, '0')}`;
    onChange(iso);
    setOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`bg-surface-151921 text-[10px] text-slate-300 border rounded-lg px-2 py-1 outline-none transition-all cursor-pointer font-sans inline-flex items-center gap-1.5 ${className || ''} ${
          value ? 'border-blue-500 text-blue-300 ring-1 ring-blue-500/20' : 'border-white/10 hover:border-white/20'
        }`}
        title="انتخاب روز خاص (تقویم شمسی)"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>{label || 'انتخاب روز'}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-2 left-0 w-64 p-3 bg-surface-151921 border border-white/10 rounded-2xl shadow-2xl shadow-black/50 text-xs">
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer" aria-label="ماه قبل">
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="font-bold text-white">{MONTH_NAMES[viewMonth - 1]} {toPersianDigits(viewYear)}</span>
              <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer" aria-label="ماه بعد">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {WEEK_DAYS.map((w, i) => (
                <div key={i} className="text-center text-[9px] text-slate-500 font-bold py-1">{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {grid.map((day, i) => {
                if (day === null) return <div key={i} />;
                const isToday = today.jy === viewYear && today.jm === viewMonth && today.jd === day;
                const isSel = !!selectedJalali && selectedJalali.jy === viewYear && selectedJalali.jm === viewMonth && selectedJalali.jd === day;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pick(day)}
                    className={`h-7 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                      isSel ? 'bg-blue-600 text-white' : isToday ? 'bg-accent/20 text-accent' : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {toPersianDigits(day)}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => { onClear(); setOpen(false); }}
                className="text-[10px] text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
              >
                پاک کردن
              </button>
              <button
                type="button"
                onClick={() => { setViewYear(today.jy); setViewMonth(today.jm); pick(today.jd); }}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold cursor-pointer"
              >
                امروز
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
