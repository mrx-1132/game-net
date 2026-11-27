import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, Calendar, Search, Layers, CircleDollarSign, Receipt, Printer, Filter, Database, CheckCircle2, ChevronDown
} from 'lucide-react';
import { SessionHistory, DirectBuffetSale, DailyWorkingDayBackup } from '../types';
import { formatCurrency, formatDatePersian, toPersianDigits } from '../utils';
import JalaliDatePicker from './JalaliDatePicker';
import InvoiceReceiptModal, { InvoiceReceiptData } from './InvoiceReceiptModal';

interface ReportsTabProps {
  history: SessionHistory[];
  directSales: DirectBuffetSale[];
  dailyBackups?: DailyWorkingDayBackup[];
  onClearHistory?: () => void;
}

// Convert Persian/Arabic digits and remove control characters
const cleanDateString = (str: string | number = ''): string => {
  return String(str || '')
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[\u200e\u200f\u061c]/g, '')
    .trim();
};

const toEngDigits = (str: string = ''): string => cleanDateString(str);

// Mathematical conversion of Jalali (Shamsi) date to Julian Day Number (JDN)
function jalaliToJdn(jy: number, jm: number, jd: number): number {
  const epbase = jy - (jy >= 0 ? 474 : 473);
  const epyear = 474 + (epbase % 2820);
  return (
    jd +
    (jm <= 7 ? (jm - 1) * 31 : (jm - 1) * 30 + 6) +
    Math.floor((epyear * 682 - 110) / 2816) +
    (epyear - 1) * 365 +
    Math.floor(epbase / 2820) * 1029983 +
    1948320.5
  );
}

// Extract Jalali year, month, day from a Date object
// formatter فقط یک بار ساخته می‌شود (ساختنش گران است) و نتیجه‌ها کش می‌شوند
let _jalaliFmt: Intl.DateTimeFormat | null = null;
const _jalaliCache = new Map<number, { jy: number; jm: number; jd: number }>();
function getJalaliFromDate(d: Date): { jy: number; jm: number; jd: number } {
  const t = d.getTime();
  const cached = _jalaliCache.get(t);
  if (cached) return cached;
  try {
    if (!_jalaliFmt) {
      _jalaliFmt = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });
    }
    const parts = _jalaliFmt.formatToParts(d);
    const res = {
      jy: parseInt(parts.find((p) => p.type === 'year')?.value || '1405', 10),
      jm: parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10),
      jd: parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10),
    };
    if (!isNaN(t)) {
      if (_jalaliCache.size > 20000) _jalaliCache.clear();
      _jalaliCache.set(t, res);
    }
    return res;
  } catch {
    return { jy: 1405, jm: 1, jd: 1 };
  }
}

// Parse Persian date string like "1405/07/11" or "۱۴۰۵/۷/۱۱"
function parseJalaliString(str: string): { jy: number; jm: number; jd: number } | null {
  if (!str) return null;
  const cleaned = cleanDateString(str);
  const m = cleaned.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (m) {
    return {
      jy: parseInt(m[1], 10),
      jm: parseInt(m[2], 10),
      jd: parseInt(m[3], 10),
    };
  }
  return null;
}

// Core matcher for any date item against selected filter
function matchDateFilter(
  jalaliObj: { jy: number; jm: number; jd: number } | null,
  dateObj: Date | null,
  filterToUse: string,
  now: Date,
  todayJalali: { jy: number; jm: number; jd: number },
  todayJdn: number,
  customDateVal?: string
): boolean {
  if (filterToUse === 'all') return true;

  // Calculate day difference using Jalali JDN
  let diffDays: number | null = null;
  if (jalaliObj) {
    const itemJdn = jalaliToJdn(jalaliObj.jy, jalaliObj.jm, jalaliObj.jd);
    diffDays = Math.round(todayJdn - itemJdn);
  } else if (dateObj && !isNaN(dateObj.getTime())) {
    const dJalali = getJalaliFromDate(dateObj);
    const itemJdn = jalaliToJdn(dJalali.jy, dJalali.jm, dJalali.jd);
    diffDays = Math.round(todayJdn - itemJdn);
  }

  const isSameCalendarDay =
    Boolean(dateObj && !isNaN(dateObj.getTime()) && dateObj.toDateString() === now.toDateString());
  const yesterday = new Date(now.getTime() - 86400000);
  const isYesterdayCalendarDay =
    Boolean(dateObj && !isNaN(dateObj.getTime()) && dateObj.toDateString() === yesterday.toDateString());

  if (filterToUse === 'today') {
    return diffDays === 0 || (diffDays !== null && diffDays <= 0 && diffDays >= -1) || isSameCalendarDay;
  }

  if (filterToUse === 'yesterday') {
    return diffDays === 1 || isYesterdayCalendarDay;
  }

  if (filterToUse === 'week') {
    if (diffDays !== null) {
      return diffDays >= -1 && diffDays <= 7;
    }
    if (dateObj && !isNaN(dateObj.getTime())) {
      const msDiff = now.getTime() - dateObj.getTime();
      return msDiff >= -3600000 && msDiff <= 7 * 86400000;
    }
    return false;
  }

  if (filterToUse === 'month') {
    if (diffDays !== null && diffDays >= -1 && diffDays <= 30) return true;
    if (jalaliObj && jalaliObj.jy === todayJalali.jy && jalaliObj.jm === todayJalali.jm) return true;
    if (dateObj && !isNaN(dateObj.getTime())) {
      const dJalali = getJalaliFromDate(dateObj);
      if (dJalali.jy === todayJalali.jy && dJalali.jm === todayJalali.jm) return true;
      const msDiff = now.getTime() - dateObj.getTime();
      return msDiff >= -3600000 && msDiff <= 30 * 86400000;
    }
    return false;
  }

  if (filterToUse === 'year') {
    if (diffDays !== null && diffDays >= -1 && diffDays <= 365) return true;
    if (jalaliObj && jalaliObj.jy === todayJalali.jy) return true;
    if (dateObj && !isNaN(dateObj.getTime())) {
      const dJalali = getJalaliFromDate(dateObj);
      if (dJalali.jy === todayJalali.jy) return true;
      const msDiff = now.getTime() - dateObj.getTime();
      return msDiff >= -3600000 && msDiff <= 365 * 86400000;
    }
    return false;
  }

  if (filterToUse === 'custom' && customDateVal) {
    const targetDate = new Date(customDateVal);
    if (!isNaN(targetDate.getTime())) {
      const targetJalali = getJalaliFromDate(targetDate);
      if (
        jalaliObj &&
        jalaliObj.jy === targetJalali.jy &&
        jalaliObj.jm === targetJalali.jm &&
        jalaliObj.jd === targetJalali.jd
      ) {
        return true;
      }
      if (dateObj && !isNaN(dateObj.getTime()) && dateObj.toDateString() === targetDate.toDateString()) {
        return true;
      }
    }
  }

  return true;
}

function ReportsTab({
  history = [],
  directSales = [],
  dailyBackups = [],
  onClearHistory,
}: ReportsTabProps) {
  const [dateFilter, setDateFilter] = useState<'latest' | 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all' | 'custom'>('all');
  const [selectedBackupId, setSelectedBackupId] = useState<string>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<InvoiceReceiptData | null>(null);

  // Set of session and sale IDs present in closed backups to prevent duplicate counting and rendering
  const backupSessionIdSet = useMemo(() => {
    const set = new Set<string>();
    dailyBackups.forEach((b) => {
      (b.history || []).forEach((h) => {
        if (h && h.id) set.add(h.id);
      });
    });
    return set;
  }, [dailyBackups]);

  const backupSaleIdSet = useMemo(() => {
    const set = new Set<string>();
    dailyBackups.forEach((b) => {
      (b.directSales || []).forEach((s) => {
        if (s && s.id) set.add(s.id);
      });
    });
    return set;
  }, [dailyBackups]);

  // Helper to check if a backup matches the date filter
  const checkBackupDateInRange = (b: DailyWorkingDayBackup, filterToUse: string = dateFilter, ignoreSelection = false) => {
    if (!ignoreSelection && selectedBackupId !== 'all') {
      return b.id === selectedBackupId;
    }

    if (filterToUse === 'latest') {
      return dailyBackups.length > 0 && dailyBackups[0].id === b.id;
    }

    const now = new Date();
    const todayJalali = getJalaliFromDate(now);
    const todayJdn = jalaliToJdn(todayJalali.jy, todayJalali.jm, todayJalali.jd);

    const jalaliObj = b.workingDatePersian ? parseJalaliString(b.workingDatePersian) : null;
    const dateObj = b.closedAt || b.dateISO ? new Date(b.closedAt || b.dateISO || '') : null;

    return matchDateFilter(jalaliObj, dateObj, filterToUse, now, todayJalali, todayJdn, customDate);
  };

  // Helper to check if an open shift session/sale matches date filter
  const checkOpenShiftDateInRange = (dateStr?: string, filterToUse: string = dateFilter, ignoreSelection = false) => {
    if (!ignoreSelection && selectedBackupId !== 'all') {
      return false;
    }

    if (filterToUse === 'latest') {
      return dailyBackups.length === 0;
    }

    if (!dateStr) return false;
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return false;

    const now = new Date();
    const todayJalali = getJalaliFromDate(now);
    const todayJdn = jalaliToJdn(todayJalali.jy, todayJalali.jm, todayJalali.jd);
    const jalaliObj = getJalaliFromDate(dateObj);

    return matchDateFilter(jalaliObj, dateObj, filterToUse, now, todayJalali, todayJdn, customDate);
  };

  // 1. Matching Backups for current filter
  const matchingBackups = useMemo(() => {
    return dailyBackups.filter((b) => checkBackupDateInRange(b));
  }, [dailyBackups, dateFilter, selectedBackupId, customDate]);

  // 2. Matching Open Shift Sessions and Sales (excluding items already in backups)
  const matchingOpenSessions = useMemo(() => {
    return history
      .filter((h) => !backupSessionIdSet.has(h.id))
      .filter((h) => checkOpenShiftDateInRange(h.endTime || h.startTime));
  }, [history, backupSessionIdSet, dateFilter, selectedBackupId, customDate]);

  const matchingOpenSales = useMemo(() => {
    return directSales
      .filter((s) => !backupSaleIdSet.has(s.id))
      .filter((s) => checkOpenShiftDateInRange(s.date));
  }, [directSales, backupSaleIdSet, dateFilter, selectedBackupId, customDate]);

  // 3. Combined and deduplicated list of all items across Backups and Active Shift
  const unfilteredDisplayItems = useMemo(() => {
    const list: Array<{
      type: 'session' | 'sale' | 'backup_shift';
      id: string;
      title: string;
      customer: string;
      dateStr: string;
      durationMin?: number;
      gameplayCost: number;
      buffetCost: number;
      extraCost?: number;
      totalCost: number;
      paymentMethod: 'cash' | 'card' | 'debt' | 'mixed';
      cardPaid?: number;
      cashPaid?: number;
      debtPaid?: number;
      cardReaderName?: string;
      notes?: string;
      rawSession?: SessionHistory;
    }> = [];

    const seenIds = new Set<string>();

    const addSession = (h: SessionHistory, backupDate?: string) => {
      if (!h || !h.id || seenIds.has(h.id)) return;
      seenIds.add(h.id);
      list.push({
        type: 'session',
        id: h.id,
        title: h.systemName,
        customer: h.customerName || 'مشتری آزاد',
        dateStr: h.endTime || h.startTime || backupDate || '',
        durationMin: h.durationMinutes,
        gameplayCost: h.gamePlayCost || 0,
        buffetCost: h.buffetCost || 0,
        extraCost: h.extraServicesCost || 0,
        totalCost: h.totalCost || 0,
        paymentMethod: h.paymentMethod,
        cardPaid: h.cardPaidAmount,
        cashPaid: h.cashPaidAmount,
        debtPaid: h.debtAmount,
        cardReaderName: h.cardReaderName,
        notes: h.notes,
        rawSession: h,
      });
    };

    const addSale = (s: DirectBuffetSale, backupDate?: string) => {
      if (!s || !s.id || seenIds.has(s.id)) return;
      seenIds.add(s.id);
      list.push({
        type: 'sale',
        id: s.id,
        title: `فروش مستقیم بوفه (${(s.items || []).map((i) => i.name).join('، ')})`,
        customer: s.customerName || 'مشتری بوفه',
        dateStr: s.date || backupDate || '',
        gameplayCost: 0,
        buffetCost: s.totalCost || 0,
        totalCost: s.totalCost || 0,
        paymentMethod: s.paymentMethod || 'cash',
        cardPaid: s.cardPaidAmount,
        cashPaid: s.cashPaidAmount,
        debtPaid: s.debtAmount,
        cardReaderName: s.cardReaderName,
      });
    };

    // Add sessions and sales from matching backups
    matchingBackups.forEach((b) => {
      let hasSessions = false;
      if (b.history && b.history.length > 0) {
        hasSessions = true;
        b.history.forEach((h) => addSession(h, b.closedAt));
      }
      if (b.directSales && b.directSales.length > 0) {
        b.directSales.forEach((s) => addSale(s, b.closedAt));
      }

      // If backup has financial summary without individual sessions, show shift row
      const grossRevenue = b.totalGrossRevenue || 0;
      const gameplayRevenue = b.totalGameplayRevenue || 0;
      const sessionBuffetCost = b.totalSessionBuffetCost || 0;
      if (!hasSessions && (grossRevenue > 0 || gameplayRevenue + sessionBuffetCost > 0)) {
        const shiftId = `shift-${b.id}`;
        if (!seenIds.has(shiftId)) {
          seenIds.add(shiftId);
          list.push({
            type: 'backup_shift',
            id: shiftId,
            title: `💾 شیفت بسته شده روز کاری (${b.workingDatePersian})`,
            customer: b.notes ? `یادداشت شیفت: ${b.notes}` : 'ثبت و بایگانی شیفت در دیتابیس',
            dateStr: b.closedAt || b.dateISO || new Date().toISOString(),
            gameplayCost: gameplayRevenue,
            buffetCost: sessionBuffetCost + (b.totalDirectBuffetSales || 0),
            totalCost:
              grossRevenue ||
              (gameplayRevenue + sessionBuffetCost + (b.totalDirectBuffetSales || 0)),
            paymentMethod:
              b.paidCardAmount && b.paidCardAmount > 0 && b.paidCashAmount && b.paidCashAmount > 0
                ? 'mixed'
                : b.paidCardAmount && b.paidCardAmount > 0
                ? 'card'
                : b.debtAccumulatedAmount && b.debtAccumulatedAmount > 0 && !b.paidCashAmount
                ? 'debt'
                : 'cash',
            cardPaid: b.paidCardAmount,
            cashPaid: b.paidCashAmount,
            debtPaid: b.debtAccumulatedAmount,
            notes: b.notes,
          });
        }
      }
    });

    // Add matching open shift sessions
    matchingOpenSessions.forEach((h) => addSession(h));

    // Add matching open shift direct sales
    matchingOpenSales.forEach((s) => addSale(s));

    // Sort newest first
    list.sort((a, b) => {
      const timeA = new Date(a.dateStr).getTime() || 0;
      const timeB = new Date(b.dateStr).getTime() || 0;
      return timeB - timeA;
    });

    return list;
  }, [matchingBackups, matchingOpenSessions, matchingOpenSales]);

  // Financial calculations derived consistently from unfilteredDisplayItems
  const totalGameplayRevenue = useMemo(() => {
    return unfilteredDisplayItems.reduce((sum, it) => sum + (it.gameplayCost || 0), 0);
  }, [unfilteredDisplayItems]);

  const totalSessionBuffet = useMemo(() => {
    return unfilteredDisplayItems.reduce((sum, it) => sum + (it.type === 'session' ? it.buffetCost : 0), 0);
  }, [unfilteredDisplayItems]);

  const totalDirectBuffetSales = useMemo(() => {
    return unfilteredDisplayItems.reduce(
      (sum, it) => sum + (it.type === 'sale' ? it.buffetCost : it.type === 'backup_shift' ? it.buffetCost : 0),
      0
    );
  }, [unfilteredDisplayItems]);

  const totalGrossRevenueFiltered = useMemo(() => {
    return unfilteredDisplayItems.reduce((sum, it) => sum + (it.totalCost || 0), 0);
  }, [unfilteredDisplayItems]);

  const paidCardFiltered = useMemo(() => {
    return unfilteredDisplayItems.reduce((sum, it) => {
      if (it.paymentMethod === 'card') return sum + it.totalCost;
      if (it.paymentMethod === 'mixed' && it.cardPaid) return sum + it.cardPaid;
      return sum;
    }, 0);
  }, [unfilteredDisplayItems]);

  const paidCashFiltered = useMemo(() => {
    return unfilteredDisplayItems.reduce((sum, it) => {
      if (it.paymentMethod === 'cash') return sum + it.totalCost;
      if (it.paymentMethod === 'mixed' && it.cashPaid) return sum + it.cashPaid;
      return sum;
    }, 0);
  }, [unfilteredDisplayItems]);

  const debtAccumulatedFiltered = useMemo(() => {
    return unfilteredDisplayItems.reduce((sum, it) => {
      if (it.paymentMethod === 'debt') return sum + it.totalCost;
      if (it.paymentMethod === 'mixed' && it.debtPaid) return sum + it.debtPaid;
      return sum;
    }, 0);
  }, [unfilteredDisplayItems]);

  // Card Reader Breakdown
  const cardReaderBreakdown = useMemo(() => {
    const breakdown: Record<string, { id: string; name: string; amount: number; count: number }> = {};
    unfilteredDisplayItems.forEach((it) => {
      const cardAmt = it.paymentMethod === 'card' ? it.totalCost : (it.cardPaid || 0);
      if (cardAmt > 0) {
        const id = it.cardReaderName || 'default-pos';
        const name = it.cardReaderName ? `کارتخوان (${it.cardReaderName})` : 'کارتخوان پیش‌فرض';
        if (!breakdown[id]) breakdown[id] = { id, name, amount: 0, count: 0 };
        breakdown[id].amount += cardAmt;
        breakdown[id].count += 1;
      }
    });
    return Object.values(breakdown);
  }, [unfilteredDisplayItems]);

  // Filtered display items for table search
  const displayItems = useMemo(() => {
    if (!search) return unfilteredDisplayItems;
    const q = search.toLowerCase();
    return unfilteredDisplayItems.filter((item) => {
      return (
        item.title.toLowerCase().includes(q) ||
        item.customer.toLowerCase().includes(q) ||
        (item.notes || '').toLowerCase().includes(q) ||
        formatDatePersian(item.dateStr).toLowerCase().includes(q)
      );
    });
  }, [unfilteredDisplayItems, search]);

  // صفحه‌بندی: فقط ۵۰ ردیف در هر صفحه رندر می‌شود
  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(displayItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = useMemo(
    () => displayItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [displayItems, currentPage]
  );
  useEffect(() => { setPage(1); }, [dateFilter, selectedBackupId, customDate, search]);

  // High-Level Global KPI Cards (computed across all backups + open shift)
  const netEarningsToday = useMemo(() => {
    const fromBackups = dailyBackups
      .filter((b) => checkBackupDateInRange(b, 'today', true))
      .reduce((sum, b) => sum + (b.totalGrossRevenue || 0), 0);
    const fromOpenSessions = history
      .filter((h) => !backupSessionIdSet.has(h.id))
      .filter((h) => checkOpenShiftDateInRange(h.endTime || h.startTime, 'today', true))
      .reduce((sum, h) => sum + (h.totalCost || 0), 0);
    const fromOpenSales = directSales
      .filter((s) => !backupSaleIdSet.has(s.id))
      .filter((s) => checkOpenShiftDateInRange(s.date, 'today', true))
      .reduce((sum, s) => sum + (s.totalCost || 0), 0);
    return fromBackups + fromOpenSessions + fromOpenSales;
  }, [dailyBackups, history, directSales, backupSessionIdSet, backupSaleIdSet]);

  const netEarningsWeek = useMemo(() => {
    const fromBackups = dailyBackups
      .filter((b) => checkBackupDateInRange(b, 'week', true))
      .reduce((sum, b) => sum + (b.totalGrossRevenue || 0), 0);
    const fromOpenSessions = history
      .filter((h) => !backupSessionIdSet.has(h.id))
      .filter((h) => checkOpenShiftDateInRange(h.endTime || h.startTime, 'week', true))
      .reduce((sum, h) => sum + (h.totalCost || 0), 0);
    const fromOpenSales = directSales
      .filter((s) => !backupSaleIdSet.has(s.id))
      .filter((s) => checkOpenShiftDateInRange(s.date, 'week', true))
      .reduce((sum, s) => sum + (s.totalCost || 0), 0);
    return fromBackups + fromOpenSessions + fromOpenSales;
  }, [dailyBackups, history, directSales, backupSessionIdSet, backupSaleIdSet]);

  const netEarningsMonth = useMemo(() => {
    const fromBackups = dailyBackups
      .filter((b) => checkBackupDateInRange(b, 'month', true))
      .reduce((sum, b) => sum + (b.totalGrossRevenue || 0), 0);
    const fromOpenSessions = history
      .filter((h) => !backupSessionIdSet.has(h.id))
      .filter((h) => checkOpenShiftDateInRange(h.endTime || h.startTime, 'month', true))
      .reduce((sum, h) => sum + (h.totalCost || 0), 0);
    const fromOpenSales = directSales
      .filter((s) => !backupSaleIdSet.has(s.id))
      .filter((s) => checkOpenShiftDateInRange(s.date, 'month', true))
      .reduce((sum, s) => sum + (s.totalCost || 0), 0);
    return fromBackups + fromOpenSessions + fromOpenSales;
  }, [dailyBackups, history, directSales, backupSessionIdSet, backupSaleIdSet]);

  const netEarningsYear = useMemo(() => {
    const fromBackups = dailyBackups
      .filter((b) => checkBackupDateInRange(b, 'year', true))
      .reduce((sum, b) => sum + (b.totalGrossRevenue || 0), 0);
    const fromOpenSessions = history
      .filter((h) => !backupSessionIdSet.has(h.id))
      .filter((h) => checkOpenShiftDateInRange(h.endTime || h.startTime, 'year', true))
      .reduce((sum, h) => sum + (h.totalCost || 0), 0);
    const fromOpenSales = directSales
      .filter((s) => !backupSaleIdSet.has(s.id))
      .filter((s) => checkOpenShiftDateInRange(s.date, 'year', true))
      .reduce((sum, s) => sum + (s.totalCost || 0), 0);
    return fromBackups + fromOpenSessions + fromOpenSales;
  }, [dailyBackups, history, directSales, backupSessionIdSet, backupSaleIdSet]);

  // Visual Progress analytics data
  const breakdownChartData = [
    { name: 'درآمد اصلی سیستم‌ها', value: totalGameplayRevenue, colorClass: 'bg-blue-500', textClass: 'text-blue-400' },
    { name: 'فروش بوفه متصل سیستم', value: totalSessionBuffet, colorClass: 'bg-indigo-500', textClass: 'text-indigo-400' },
    { name: 'فروش مستقیم مستقل بوفه', value: totalDirectBuffetSales, colorClass: 'bg-violet-500', textClass: 'text-violet-400' },
    { name: 'بدهی معوق حاصله (نسیه)', value: debtAccumulatedFiltered, colorClass: 'bg-amber-500', textClass: 'text-amber-400' },
  ];

  const highestValue = Math.max(...breakdownChartData.map(item => item.value), 1);

  // سلامت بکاپ مالی: اگر بیش از ۳۰ روز از آخرین پشتیبان‌گیری گذشته باشد هشدار داده می‌شود
  const BACKUP_STALE_DAYS = 30;
  const lastBackupAt = dailyBackups.length > 0
    ? Math.max(...dailyBackups.map((b) => new Date(b.closedAt || b.dateISO).getTime() || 0))
    : 0;
  const daysSinceBackup = lastBackupAt > 0 ? Math.floor((Date.now() - lastBackupAt) / 86400000) : null;
  const backupStale = daysSinceBackup === null || daysSinceBackup >= BACKUP_STALE_DAYS;

  return (
    <div className="space-y-6" dir="rtl">

      {/* Backup health check */}
      {backupStale && (
        <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-2xl flex items-start sm:items-center justify-between gap-3 shadow-xl" role="alert">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-rose-300 font-bold text-sm">
                {daysSinceBackup === null
                  ? 'هیچ بکاپ مالی ثبت نشده است!'
                  : `آخرین بکاپ مالی ${toPersianDigits(daysSinceBackup)} روز پیش بوده است!`}
              </h4>
              <p className="text-[11px] text-rose-200/70">
                بیش از ۳۰ روز از پشتیبان‌گیری گذشته و داده‌های مالی در برابر خرابی محافظت نمی‌شوند. از بخش «دیتابیس بکاپ‌ها» همین امروز بکاپ بگیرید.
              </p>
            </div>
          </div>
        </div>
      )}
      {!backupStale && daysSinceBackup !== null && (
        <div className="p-3 bg-emerald-950/30 border border-emerald-500/25 rounded-2xl flex items-center gap-3 shadow-lg" role="status">
          <div className="p-2 bg-emerald-500/15 text-emerald-400 rounded-xl border border-emerald-500/25 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-[11px] text-emerald-200/80 font-medium">
            پشتیبان‌گیری مالی سالم است — آخرین بکاپ {daysSinceBackup === 0 ? 'امروز' : `${toPersianDigits(daysSinceBackup)} روز پیش`} ثبت شده است.
          </p>
        </div>
      )}
      
      {/* High-Level KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Earnings Card 1 */}
        <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <span className="text-slate-400 text-xs block font-medium">کل کارکرد بوفه و بازی امروز</span>
            <span className="text-xl font-bold text-emerald-400 font-mono">
              {formatCurrency(netEarningsToday)}
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <TrendingUp className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        {/* Earnings Card 2 */}
        <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <span className="text-slate-400 text-xs block font-medium">درآمد ناخالص 7 روز اخیر (شامل بکاپ‌ها)</span>
            <span className="text-xl font-bold text-white font-mono">
              {formatCurrency(netEarningsWeek)}
            </span>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* Earnings Card 3 */}
        <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <span className="text-slate-400 text-xs block font-medium">درآمد 30 روز اخیر (ماهانه)</span>
            <span className="text-xl font-bold text-white font-mono">
              {formatCurrency(netEarningsMonth)}
            </span>
          </div>
          <div className="p-3 bg-violet-500/10 text-violet-400 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Earnings Card 4 */}
        <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <span className="text-slate-400 text-xs block font-medium">برآیند کل درآمد امسال (یک سال اخیر)</span>
            <span className="text-xl font-bold text-amber-400 font-mono">
              {formatCurrency(netEarningsYear)}
            </span>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <CircleDollarSign className="w-5 h-5 animate-bounce" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Right side block: Handcrafted Visual Analytics (Takes 5 cols) */}
        <div className="lg:col-span-12 xl:col-span-5 space-y-6">
          <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-5 shadow-xl">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">آنالیز سهم کانال‌های درآمد</h3>
              <p className="text-[10px] text-slate-400">
                محاسبه هوشمند بر مبنای <strong className="text-blue-400 font-bold">{toPersianDigits(matchingBackups.length)} روز کاری بایگانی شده</strong> و شیفت جاری
              </p>
            </div>
            
            {/* Bar Chart */}
            <div className="space-y-4 py-2">
              {breakdownChartData.map((item, idx) => {
                const pct = totalGrossRevenueFiltered > 0 ? (item.value / totalGrossRevenueFiltered) * 100 : 0;
                const progressWidthPct = (item.value / highestValue) * 100;
                
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300 font-medium">{item.name}</span>
                      <span className="font-mono text-slate-400">
                        {pct.toFixed(1)}% ({item.value.toLocaleString()} تومان)
                      </span>
                    </div>
                    {/* Progress tracking slot */}
                    <div className="w-full bg-surface-0b0e14 rounded-full h-3.5 overflow-hidden p-0.5 border border-white/5">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${item.colorClass}`}
                        style={{ width: `${Math.max(3, progressWidthPct)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Micro Breakdown List details with high-contrast color codes */}
            <div className="space-y-2.5 pt-3 text-xs border-t border-white/5">
              <div className="flex justify-between items-center text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>توتال درآمد کارهای سیستم:</span>
                </span>
                <span className="font-semibold text-blue-400 font-mono">{formatCurrency(totalGameplayRevenue)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <span>کارکرد بوفه کل (نقدی + متصل):</span>
                </span>
                <span className="font-semibold text-indigo-400 font-mono">{formatCurrency(totalSessionBuffet + totalDirectBuffetSales)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>دریافتی کارتخوان (POS):</span>
                </span>
                <span className="font-semibold text-white font-mono">{formatCurrency(paidCardFiltered)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
                  <span>دریافتی نقدی صندوق (شامل بوفه):</span>
                </span>
                <span className="font-semibold text-white font-mono">{formatCurrency(paidCashFiltered)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>جمع نسیه موقت معوق:</span>
                </span>
                <span className="font-semibold text-amber-500 font-mono">{formatCurrency(debtAccumulatedFiltered)}</span>
              </div>
              
              <div className="h-px bg-white/5 my-2"></div>
              
              <div className="flex justify-between items-center text-xs font-bold bg-surface-0b0e14 p-2.5 rounded-lg border border-white/50">
                <span className="text-slate-300">مجموع محاسباتی بازه جاری:</span>
                <span className="text-blue-400 font-mono text-sm">{formatCurrency(totalGrossRevenueFiltered)}</span>
              </div>

              {/* Card Reader Breakdown List */}
              <div className="h-px bg-white/5 my-2"></div>
              <div className="space-y-2 text-right">
                <span className="text-[10px] text-slate-400 font-bold block">تفکیک ورودی فعال کارتخوان‌ها (POS):</span>
                {cardReaderBreakdown.length === 0 ? (
                  <div className="text-[10px] text-slate-500 text-center py-1">تراکنشی برای کارتخوان‌ها ثبت نشده است.</div>
                ) : (
                  <div className="space-y-1.5">
                    {cardReaderBreakdown.map((pos) => (
                      <div key={pos.id} className="flex justify-between items-center text-[10px] bg-surface-0b0e14/50 hover:bg-surface-0b0e14 px-2.5 py-1.5 rounded-lg border border-white/5 text-slate-400 transition-all">
                        <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                          <span>🔌</span>
                          <span>{pos.name}</span>
                          <span className="text-[9px] bg-surface-151921 text-slate-400 px-1.5 py-0.5 rounded font-sans">
                            {pos.count} تراکنش
                          </span>
                        </span>
                        <span className="font-semibold text-sky-400 font-mono">{formatCurrency(pos.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Left side block: Full Tables List and Filtering (Takes 7 cols) */}
        <div className="lg:col-span-12 xl:col-span-7 space-y-4">
          
          {/* Filtering row controls section */}
          <div className="p-4 bg-surface-151921 border border-white/5 rounded-2xl flex flex-col gap-3 shadow-xl">
            
            {/* Top row: Direct Backup Selector Dropdown & Quick Modes */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Database className="w-4 h-4 text-rose-500" />
                <span>منبع گزارش:</span>
                <select
                  value={selectedBackupId}
                  onChange={(e) => {
                    setSelectedBackupId(e.target.value);
                    if (e.target.value !== 'all') {
                      setDateFilter('all');
                    }
                  }}
                  className="bg-surface-0b0e14 text-white border border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">📂 کلیه سوابق (شیفت جاری + بکاپ‌ها)</option>
                  {dailyBackups.map((b, idx) => (
                    <option key={b.id} value={b.id}>
                      {idx === 0 ? '⭐ آخرین بکاپ: ' : '📅 '}
                      روز کاری {b.workingDatePersian} ({formatCurrency(b.totalGrossRevenue || 0)})
                    </option>
                  ))}
                </select>
              </div>

              {dailyBackups.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBackupId(dailyBackups[0].id);
                    setDateFilter('all');
                  }}
                  className="px-3 py-1.5 bg-rose-600/15 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>مشاهده آخرین شیفت بسته شده ({dailyBackups[0].workingDatePersian})</span>
                </button>
              )}
            </div>

            {/* Bottom row: Quick date selectors & search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              
              {/* Quick date selectors */}
              <div className="flex flex-wrap items-center gap-1 bg-surface-0b0e14 p-1 border border-white/5 rounded-xl text-[11px] w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBackupId('all');
                    setDateFilter('today');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all font-semibold shrink-0 cursor-pointer ${
                    selectedBackupId === 'all' && dateFilter === 'today' ? 'bg-surface-151921 text-white border border-white/10 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  امروز
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBackupId('all');
                    setDateFilter('yesterday');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all font-semibold shrink-0 cursor-pointer ${
                    selectedBackupId === 'all' && dateFilter === 'yesterday' ? 'bg-surface-151921 text-white border border-white/10 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  دیروز
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBackupId('all');
                    setDateFilter('week');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all font-semibold shrink-0 cursor-pointer ${
                    selectedBackupId === 'all' && dateFilter === 'week' ? 'bg-surface-151921 text-white border border-white/10 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  7 روز اخیر
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBackupId('all');
                    setDateFilter('month');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all font-semibold shrink-0 cursor-pointer ${
                    selectedBackupId === 'all' && dateFilter === 'month' ? 'bg-surface-151921 text-white border border-white/10 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  30 روز اخیر (ماهانه)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBackupId('all');
                    setDateFilter('year');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all font-semibold shrink-0 cursor-pointer ${
                    selectedBackupId === 'all' && dateFilter === 'year' ? 'bg-surface-151921 text-white border border-white/10 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  365 روز اخیر (سالانه)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBackupId('all');
                    setDateFilter('all');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all font-semibold shrink-0 cursor-pointer ${
                    selectedBackupId === 'all' && dateFilter === 'all' ? 'bg-surface-151921 text-white border border-white/10 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  همه تاریخ‌ها
                </button>

                {/* Custom Date Picker Selector (تقویم شمسی) */}
                <div className="flex items-center gap-1.5 pr-1.5 mr-1 border-r border-white/10">
                  <JalaliDatePicker
                    value={customDate}
                    onChange={(iso) => {
                      setCustomDate(iso);
                      setSelectedBackupId('all');
                      setDateFilter('custom');
                    }}
                    onClear={() => {
                      setCustomDate('');
                      setDateFilter('all');
                    }}
                    getJalali={getJalaliFromDate}
                    jdnFromJalali={jalaliToJdn}
                    toPersianDigits={toPersianDigits}
                  />
                  {dateFilter === 'custom' && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomDate('');
                        setDateFilter('all');
                      }}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-bold px-1"
                      title="حذف فیلتر تقویم"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Text Search input */}
              <div className="relative text-xs w-full md:w-56 shrink-0">
                <span className="absolute right-3 top-2.5 text-slate-500">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="جستجو نام، دستگاه یا تاریخ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 bg-surface-0b0e14 border border-white/5 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-right animate-none"
                />
              </div>

            </div>

          </div>

          {/* Settle Logs details table list */}
          <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
                <CircleDollarSign className="w-4 h-4 text-emerald-400" />
                <span>فاکتورها و تسویه‌های ثبت شده ({toPersianDigits(displayItems.length)} مورد)</span>
              </h3>
              {selectedBackupId !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedBackupId('all')}
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-bold cursor-pointer"
                >
                  نمایش همه شیفت‌ها
                </button>
              )}
            </div>
            
            <div className="border border-white/5 rounded-xl overflow-hidden text-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right min-w-[500px]" dir="rtl">
                  <thead>
                    <tr className="bg-surface-0b0e14 font-semibold text-slate-400 border-b border-white/5 text-[10px]">
                      <th className="px-4 py-3">عنوان فیزیکی دستگاه / خرید</th>
                      <th className="px-4 py-3">نام مشتری / توضیحات</th>
                      <th className="px-4 py-3 text-center">مدت زمان بازی</th>
                      <th className="px-4 py-3">تفکیک هزینه‌ها</th>
                      <th className="px-4 py-3 text-left">مجموع حساب فاکتور</th>
                      <th className="px-3 py-3 text-center">فاکتور</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-surface-0b0e14/20">
                    {displayItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-slate-400 space-y-2">
                          <p>صندوق مالی در بازه زمانی تعیین‌شده در این فیلتر خالی است.</p>
                          {dailyBackups.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBackupId(dailyBackups[0].id);
                                setDateFilter('all');
                              }}
                              className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg text-xs font-bold cursor-pointer inline-block"
                            >
                              مشاهده آخرین شیفت بسته شده در بکاپ ({dailyBackups[0].workingDatePersian})
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      pagedItems.map((item, idx) => (
                        <tr key={`${item.type}-${item.id}-${idx}`} className="hover:bg-white/5 transition-colors text-[11px]">
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-200 block">{item.title}</span>
                            <span className="text-[9px] text-slate-500 block font-mono mt-0.5">
                              {formatDatePersian(item.dateStr)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-300 font-medium vertical-top">
                            <span className="font-bold text-slate-200">{item.customer}</span>
                            {item.notes && (
                              <div className="text-[10px] text-blue-300 mt-1 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 font-sans flex items-center gap-1 w-fit">
                                <span>📝 {item.notes}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-medium text-slate-400">
                            {item.durationMin ? `${item.durationMin} دقیقه` : '-'}
                          </td>
                          <td className="px-4 py-3 space-y-0.5 text-[10px]">
                            {item.gameplayCost > 0 && (
                              <span className="text-slate-400 block">گیم‌پلی: {item.gameplayCost.toLocaleString()} ت</span>
                            )}
                            {item.buffetCost > 0 && (
                              <span className="text-indigo-400 block font-medium">بوفه: {item.buffetCost.toLocaleString()} ت</span>
                            )}
                            {item.extraCost && item.extraCost > 0 ? (
                              <span className="text-amber-400 block font-medium">خدمات: {item.extraCost.toLocaleString()} ت</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-left font-mono font-bold space-y-1">
                            <div className="text-slate-100 text-xs">{formatCurrency(item.totalCost || 0)}</div>
                            <div className="flex flex-col items-end gap-1">
                              {item.paymentMethod === 'card' ? (
                                <span className="inline-block px-1.5 py-0.5 text-[8px] tracking-tight bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                                  کارتخوان {item.cardReaderName ? `(${item.cardReaderName})` : ''}
                                </span>
                              ) : item.paymentMethod === 'cash' ? (
                                <span className="inline-block px-1.5 py-0.5 text-[8px] tracking-tight bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                                  نقدی صندوق
                                </span>
                              ) : item.paymentMethod === 'debt' ? (
                                <span className="inline-block px-1.5 py-0.5 text-[8px] tracking-tight bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded">
                                  نسیه دفتری
                                </span>
                              ) : (
                                <div className="space-y-0.5 text-right w-full flex flex-col items-end">
                                  <span className="inline-block px-1.5 py-0.5 text-[8px] tracking-tight bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded">
                                    ترکیبی
                                  </span>
                                  {item.cashPaid && <span className="block text-[8px] text-emerald-400 font-normal">نقدی: {item.cashPaid.toLocaleString()}</span>}
                                  {item.cardPaid && <span className="block text-[8px] text-blue-400 font-normal">کارت: {item.cardPaid.toLocaleString()}</span>}
                                  {item.debtPaid && <span className="block text-[8px] text-amber-400 font-normal">نسیه: {item.debtPaid.toLocaleString()}</span>}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {item.rawSession ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedInvoiceForModal({
                                    invoiceNumber: `INV-${item.rawSession!.systemName.replace(/\s+/g, '')}-${item.rawSession!.id.slice(-4)}`,
                                    date: item.rawSession!.endTime,
                                    customerName: item.rawSession!.customerName,
                                    customerPhone: item.rawSession!.customerPhone,
                                    systemName: item.rawSession!.systemName,
                                    systemType: item.rawSession!.systemType,
                                    startTime: item.rawSession!.startTime,
                                    endTime: item.rawSession!.endTime,
                                    durationMinutes: item.rawSession!.durationMinutes,
                                    playersCount: item.rawSession!.playersCount,
                                    hourlyRate: item.rawSession!.hourlyRateUsed,
                                    gamePlayCost: item.rawSession!.gamePlayCost,
                                    buffetItems: item.rawSession!.buffetItems,
                                    buffetCost: item.rawSession!.buffetCost,
                                    extraServices: item.rawSession!.extraServices,
                                    extraServicesCost: item.rawSession!.extraServicesCost,
                                    partialPayments: item.rawSession!.partialPayments,
                                    totalPartialPaid: item.rawSession!.partialPayments?.reduce((s, p) => s + p.amount, 0),
                                    roundingOffset: item.rawSession!.roundingOffset,
                                    totalCost: item.rawSession!.totalCost,
                                    netPayable: item.rawSession!.totalCost,
                                    paymentMethod: item.rawSession!.paymentMethod,
                                    cashPaidAmount: item.rawSession!.cashPaidAmount,
                                    cardPaidAmount: item.rawSession!.cardPaidAmount,
                                    debtAmount: item.rawSession!.debtAmount,
                                    cardReaderName: item.rawSession!.cardReaderName,
                                    notes: item.rawSession!.notes,
                                  });
                                }}
                                className="px-2.5 py-1 bg-white/5 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg border border-white/5 transition-all text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                <span>فاکتور</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-mono">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 py-3 border-t border-white/5 text-xs">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    قبلی
                  </button>
                  <span className="text-slate-400 font-mono">
                    صفحه {currentPage} از {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage(currentPage + 1)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    بعدی
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Invoice Modal Preview */}
      {selectedInvoiceForModal && (
        <InvoiceReceiptModal
          isOpen={!!selectedInvoiceForModal}
          onClose={() => setSelectedInvoiceForModal(null)}
          invoice={selectedInvoiceForModal}
        />
      )}

    </div>
  );
}

export default React.memo(ReportsTab);
