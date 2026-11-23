import React, { useState, useRef } from 'react';
import { 
  Calendar, Search, CircleDollarSign, TrendingUp, Layers, Clock, 
  ChevronRight, AlertCircle, Eye, Trash2, Database, DollarSign, 
  CreditCard, BookOpen, ChevronLeft, ArrowLeftRight, HardDrive, ShoppingBag,
  Download, Upload, CheckCircle, CheckCircle2, ShieldCheck, Info, FileSpreadsheet, FileJson,
  Table, Sparkles, Lock, X, Receipt, Printer
} from 'lucide-react';
import * as XLSX from 'xlsx';
import initSqlJs from 'sql.js';
import { DailyWorkingDayBackup, SessionHistory, DirectBuffetSale, SystemLog } from '../types';
import { formatCurrency, formatDatePersian, toPersianDigits, serializeBackupPayload } from '../utils';
import { isEncryptedBackup, decryptBackup, EncryptedBackupEnvelope } from '../backupCrypto';
import InvoiceReceiptModal, { InvoiceReceiptData } from './InvoiceReceiptModal';

let sqlPromise: Promise<any> | null = null;
const getSqlJsInstance = () => {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`,
      useOldExtensionFunctions: false
    } as any);
  }
  return sqlPromise;
};

interface BackupsTabProps {
  dailyBackups: DailyWorkingDayBackup[];
  onDeleteBackup?: (id: string) => void;
  onRestoreBackupToCurrent?: (backup: DailyWorkingDayBackup) => void; // Optional nice fallback feature
  onNavigateToReports?: () => void;
  rates: any;
  systems: any;
  buffetItems: any;
  debtors: any;
  history: any;
  directSales: any;
  systemLogs?: SystemLog[];
  cardReaders: any;
  alarmIntervalSeconds: number;
  layoutMode: 'grid' | 'list';
  onImportFullBackup: (data: any) => void;
  adminPassword?: string;
  adminUsername?: string;
  operators?: any[];
  extraServicePresets?: any[];
  appName?: string;
  appLogo?: string;
  userPermissions?: any;
  telegramConfig?: any;
}

export default function BackupsTab({
  dailyBackups,
  onDeleteBackup,
  onRestoreBackupToCurrent,
  onNavigateToReports,
  rates,
  systems,
  buffetItems,
  debtors,
  history,
  directSales,
  systemLogs = [],
  cardReaders,
  alarmIntervalSeconds,
  layoutMode,
  onImportFullBackup,
  adminPassword = '123',
  adminUsername = 'admin',
  operators = [],
  extraServicePresets = [],
  appName,
  appLogo,
  userPermissions,
  telegramConfig,
}: BackupsTabProps) {
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [dateSearchTerm, setDateSearchTerm] = useState('');
  const [aggregationRange, setAggregationRange] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<InvoiceReceiptData | null>(null);
  const [backupToDelete, setBackupToDelete] = useState<DailyWorkingDayBackup | null>(null);
  const [backupToRestore, setBackupToRestore] = useState<DailyWorkingDayBackup | null>(null);
  const [restoreSuccessMessage, setRestoreSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{
    success?: boolean;
    error?: string;
  } | null>(null);

  // Admin password verification modal state for database import
  const [pendingRestore, setPendingRestore] = useState<{
    payload: any;
    encrypted?: EncryptedBackupEnvelope;
    fileName: string;
    summaryLines: string[];
  } | null>(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [passwordModalError, setPasswordModalError] = useState('');

  // Default backup folder path state
  const [backupPath, setBackupPath] = useState<string>(() => {
    return localStorage.getItem('gamenet_backup_path') || './backups';
  });
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [tempPath, setTempPath] = useState(backupPath);

  // Standard digit translator helper to keep file names in standard digits
  const toEnglishDigits = (str: string): string => {
    return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
  };

  // Export format selector state
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'db' | 'json'>('db');

  // 1. Export database payload to chosen format (.xlsx, .db, .json)
  const handleExportDatabaseFile = async (formatToUse?: 'xlsx' | 'db' | 'json') => {
    const selectedFmt = formatToUse || exportFormat;
    
    // Clean Persian date string for filename
    const dateStr = new Date().toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-');
    const safeDateStr = toEnglishDigits(dateStr);

    if (selectedFmt === 'xlsx') {
      try {
        const wb = XLSX.utils.book_new();

        // Sheet 1: General Summary
        const totalDebts = debtors ? debtors.reduce((s: number, d: any) => s + (d.totalDebt || 0), 0) : 0;
        const summaryRows = [
          { "عنوان شاخص": "تاریخ استخراج خروجی", "مقدار / توضیحات": formatDatePersian(new Date().toISOString()) },
          { "عنوان شاخص": "تعداد روزهای کاری بایگانی شده", "مقدار / توضیحات": dailyBackups ? dailyBackups.length : 0 },
          { "عنوان شاخص": "تعداد نشست‌های ثبت شده در تاریخچه", "مقدار / توضیحات": history ? history.length : 0 },
          { "عنوان شاخص": "تعداد بدهکاران حساب", "مقدار / توضیحات": debtors ? debtors.length : 0 },
          { "عنوان شاخص": "مجموع بدهی‌های جاری (تومان)", "مقدار / توضیحات": totalDebts },
          { "عنوان شاخص": "تعداد اقلام بوفه", "مقدار / توضیحات": buffetItems ? buffetItems.length : 0 },
          { "عنوان شاخص": "تعداد دستگاه‌ها / سیستم‌ها", "مقدار / توضیحات": systems ? systems.length : 0 },
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
        XLSX.utils.book_append_sheet(wb, wsSummary, "خلاصه دیتابیس");

        // Sheet 2: Daily Backups Archive
        const dailyRows = (dailyBackups || []).map((b: any) => ({
          "شناسه": b.id,
          "تاریخ شمسی": b.workingDatePersian,
          "تاریخ و زمان بسته شدن": formatDatePersian(b.closedAt),
          "درآمد کنسول‌ها (تومان)": b.totalGameplayRevenue || 0,
          "فروش بوفه نشست‌ها (تومان)": b.totalSessionBuffetCost || 0,
          "فروش مستقیم بوفه (تومان)": b.totalDirectBuffetSales || 0,
          "درآمد ناخالص کل (تومان)": b.totalGrossRevenue || 0,
          "پرداخت نقدی (تومان)": b.paidCashAmount || 0,
          "پرداخت کارتخوان (تومان)": b.paidCardAmount || 0,
          "بدهی / نسیه (تومان)": b.debtAccumulatedAmount || 0,
          "تعداد نشست‌ها": b.sessions ? b.sessions.length : 0,
          "یادداشت‌ها": b.notes || ''
        }));
        const wsDaily = XLSX.utils.json_to_sheet(dailyRows.length ? dailyRows : [{ "وضعیت": "هیچ شیفتی ثبت نشده است" }]);
        XLSX.utils.book_append_sheet(wb, wsDaily, "پشتیبان‌های روزانه");

        // Sheet 3: Session History
        const historyRows = (history || []).map((h: any) => ({
          "شناسه": h.id,
          "نام دستگاه": h.systemName,
          "نوع دستگاه": h.systemType,
          "نام مشتری": h.customerName || 'عمومی',
          "زمان شروع": formatDatePersian(h.startTime),
          "زمان پایان": formatDatePersian(h.endTime),
          "مدت کارکرد (دقیقه)": Math.round(h.durationMinutes || 0),
          "هزینه بازی (تومان)": h.gameplayCost || 0,
          "هزینه بوفه (تومان)": h.buffetCost || 0,
          "مبلغ کل فاکتور (تومان)": h.totalCost || 0,
          "روش پرداخت": h.paymentMethod === 'cash' ? 'نقدی' : h.paymentMethod === 'card' ? 'کارتخوان' : h.paymentMethod === 'debt' ? 'نسیه' : 'ترکیبی'
        }));
        const wsHistory = XLSX.utils.json_to_sheet(historyRows.length ? historyRows : [{ "وضعیت": "تاریخچه‌ای یافت نشد" }]);
        XLSX.utils.book_append_sheet(wb, wsHistory, "تاریخچه نشست‌ها");

        // Sheet 4: Debtors List
        const debtorsRows = (debtors || []).map((d: any) => ({
          "شناسه": d.id,
          "نام و نام خانوادگی": d.name,
          "شماره تماس": d.phone || '-',
          "مبلغ کل بدهی (تومان)": d.totalDebt || 0,
          "تاریخ آخرین تغییر": d.updatedAt ? formatDatePersian(d.updatedAt) : '-'
        }));
        const wsDebtors = XLSX.utils.json_to_sheet(debtorsRows.length ? debtorsRows : [{ "وضعیت": "بدهکاری وجود ندارد" }]);
        XLSX.utils.book_append_sheet(wb, wsDebtors, "لیست بدهکاران");

        // Sheet 5: Buffet Inventory
        const buffetRows = (buffetItems || []).map((bi: any) => ({
          "شناسه": bi.id,
          "نام کالا": bi.name,
          "دسته‌بندی": bi.category === 'fridge' ? 'یخچال' : bi.category === 'cafe' ? 'کافه' : 'تنقلات',
          "قیمت خرید (تومان)": bi.costPrice || 0,
          "قیمت فروش (تومان)": bi.price || 0,
          "موجودی انبار": bi.stock || 0
        }));
        const wsBuffet = XLSX.utils.json_to_sheet(buffetRows.length ? buffetRows : [{ "وضعیت": "آیتمی در بوفه ثبت نشده است" }]);
        XLSX.utils.book_append_sheet(wb, wsBuffet, "انبار بوفه");

        // Sheet 6: Direct Buffet Sales
        const directRows = (directSales || []).map((s: any) => ({
          "شناسه": s.id,
          "نام کالا": s.itemName,
          "تعداد": s.quantity,
          "قیمت واحد (تومان)": s.unitPrice,
          "مبلغ کل (تومان)": s.totalPrice,
          "روش پرداخت": s.paymentMethod === 'cash' ? 'نقدی' : s.paymentMethod === 'card' ? 'کارتخوان' : 'نسیه',
          "تاریخ و زمان": formatDatePersian(s.timestamp)
        }));
        const wsDirect = XLSX.utils.json_to_sheet(directRows.length ? directRows : [{ "وضعیت": "فروش مستقیمی ثبت نشده است" }]);
        XLSX.utils.book_append_sheet(wb, wsDirect, "فروش مستقیم بوفه");

        // Sheet 7: Rates
        const ratesArray = Array.isArray(rates)
          ? rates
          : Object.entries(rates || {}).map(([key, config]: [string, any]) => ({
              systemType: key,
              ...config,
            }));

        const ratesRows = ratesArray.map((r: any) => ({
          "نوع سیستم": r.systemType || r.type || 'عمومی',
          "نرخ ۱ دسته (تومان/ساعت)": r.hourlyRate1P ?? r.hourlyRate1Player ?? 0,
          "نرخ ۲ دسته (تومان/ساعت)": r.hourlyRate2P ?? r.hourlyRate2Player ?? 0,
          "نرخ ۳ دسته (تومان/ساعت)": r.hourlyRate3P ?? r.hourlyRate3Player ?? 0,
          "نرخ ۴ دسته (تومان/ساعت)": r.hourlyRate4P ?? r.hourlyRate4Player ?? 0
        }));
        const wsRates = XLSX.utils.json_to_sheet(ratesRows.length ? ratesRows : [{ "وضعیت": "نرخی ثبت نشده است" }]);
        XLSX.utils.book_append_sheet(wb, wsRates, "تعرفه‌ها");

        // Sheet 8: Systems
        const systemsRows = (systems || []).map((s: any) => ({
          "شناسه": s.id,
          "نام دستگاه": s.name,
          "نوع دستگاه": s.type,
          "وضعیت": s.status === 'occupied' ? 'مشغول' : 'آزاد'
        }));
        const wsSystems = XLSX.utils.json_to_sheet(systemsRows.length ? systemsRows : [{ "وضعیت": "دستگاهی ثبت نشده است" }]);
        XLSX.utils.book_append_sheet(wb, wsSystems, "دستگاه‌ها");

        // Write file
        XLSX.writeFile(wb, `gamenet_backup_${safeDateStr}.xlsx`);
        setImportStatus({ success: true, error: undefined });
        setTimeout(() => setImportStatus(null), 4000);
      } catch (err: any) {
        console.error('XLSX export error:', err);
        setImportStatus({ error: 'خطا در ایجاد فایل خروجی اکسل.' });
      }
      return;
    }

    // Standard JSON / .db export payload
    try {
      const backupPayload = {
        gamenet_backup_version: 1,
        exportedAt: new Date().toISOString(),
        rates,
        systems,
        buffetItems,
        debtors,
        history,
        directSales,
        systemLogs,
        dailyBackups,
        cardReaders,
        alarmIntervalSeconds,
        layoutMode,
        adminPassword,
        adminUsername,
        operators,
        extraServicePresets,
        appName,
        appLogo,
        userPermissions,
        telegramConfig
      };
      
      const jsonString = await serializeBackupPayload(backupPayload);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `gamenet_backup_${safeDateStr}.${selectedFmt}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating DB backup file:', err);
      setImportStatus({ error: 'خطا در ایجاد فایل بکاپ دیتابیس لوکال.' });
    }
  };

  // 2. Import database from loaded file (.xlsx, .xls, .xlsm, .csv, .db, .json, .sqlite)
  const handleImportDatabaseFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(null);
    const fileName = file.name.toLowerCase();

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        if (!buffer || buffer.byteLength === 0) {
          throw new Error('فایل خالی یا خوانده نشده است.');
        }

        const uint8 = new Uint8Array(buffer);
        const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8).trim();

        // Attempt 1: JSON format (.json or text inside .db)
        if (text.startsWith('{') || text.startsWith('[')) {
          try {
            const parsed = JSON.parse(text);
            if (isEncryptedBackup(parsed)) {
              setPendingRestore({
                payload: null,
                encrypted: parsed,
                fileName: file.name,
                summaryLines: [
                  'فایل پشتیبان رمزنگاری‌شده سیستم',
                  `فایل: ${file.name}`
                ]
              });
              setAdminPasswordInput('');
              setPasswordModalError('');
              return;
            }
            if (parsed && typeof parsed === 'object') {
              const requiredKeys = ['rates', 'systems', 'buffetItems', 'debtors', 'history', 'directSales', 'dailyBackups'];
              const numKeysPassed = requiredKeys.filter(key => key in parsed).length;

              if (numKeysPassed >= 2 || parsed.gamenet_backup_version) {
                setPendingRestore({
                  payload: parsed,
                  fileName: file.name,
                  summaryLines: [
                    'ساختار پشتیبان کامل دیتابیس سیستم',
                    `فایل: ${file.name}`
                  ]
                });
                setAdminPasswordInput('');
                setPasswordModalError('');
                return;
              }
            }
          } catch {
            // Not JSON, continue to SQLite / Excel
          }
        }

          let extractedDailyBackups: any[] = [];
          let extractedDebtors: any[] = [];
          let extractedBuffetItems: any[] = [];
          let extractedHistory: any[] = [];
          let extractedDirectSales: any[] = [];

          // Helper to extract value from row object matching candidate keys
          const getRowVal = (row: Record<string, any>, candidateKeys: string[]): any => {
            if (!row || typeof row !== 'object') return undefined;
            const rowKeys = Object.keys(row);
            for (const candidate of candidateKeys) {
              const candClean = candidate.toLowerCase().replace(/[\(\)\/\_\-\s]/g, '');
              for (const key of rowKeys) {
                const keyClean = key.toLowerCase().replace(/[\(\)\/\_\-\s]/g, '');
                if (keyClean === candClean || keyClean.includes(candClean)) {
                  if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
                    return row[key];
                  }
                }
              }
            }
            return undefined;
          };

          // Helper to parse numbers safely from strings with Persian digits or 'تومان'
          const parseFlexibleNumber = (val: any): number => {
            if (typeof val === 'number') return isNaN(val) ? 0 : val;
            if (!val) return 0;
            let str = String(val);
            str = str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
            const cleaned = str.replace(/[^0-9.]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? 0 : num;
          };

          // Individual Entity Row Parsers
          const parseDebtorRow = (r: any) => {
            const name = String(getRowVal(r, ['نام و نام خانوادگی', 'نام', 'مشتری', 'بدهکار', 'نام مشتری', 'نام بدهکار', 'عنوان', 'نام و فامیلی', 'name', 'customer', ' debtor']) || '').trim();
            const phone = String(getRowVal(r, ['شماره تماس', 'تلفن', 'موبایل', 'شماره', 'همراه', 'phone', 'mobile', 'tel']) || '').trim();
            const debtVal = getRowVal(r, ['مبلغ کل بدهی (تومان)', 'مبلغ بدهی (تومان)', 'مبلغ کل بدهی', 'مبلغ بدهی', 'بدهی', 'نسیه', 'بدهکاری', 'کل بدهی', 'مانده', 'مبلغ', 'totaldebt', 'debt', 'amount']);
            const totalDebt = parseFlexibleNumber(debtVal);
            if (name || totalDebt > 0 || phone) {
              return {
                id: String(r['شناسه'] || r['id'] || 'debtor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
                name: name || 'مشتری بدهکار',
                phone: phone,
                totalDebt: totalDebt,
                updatedAt: new Date().toISOString()
              };
            }
            return null;
          };

          const parseBuffetRow = (r: any) => {
            const name = String(getRowVal(r, ['نام کالا', 'کالا', 'محصول', 'نام', 'آیتم', 'عنوان', 'نام محصول', 'item', 'product', 'title']) || '').trim();
            const categoryRaw = String(getRowVal(r, ['دسته‌بندی', 'دسته', 'گروه', 'category']) || '').toLowerCase();
            const category = (categoryRaw.includes('یخچال') || categoryRaw.includes('fridge')) ? 'fridge' : (categoryRaw.includes('کافه') || categoryRaw.includes('cafe')) ? 'cafe' : 'snack';
            const costPrice = parseFlexibleNumber(getRowVal(r, ['قیمت خرید (تومان)', 'قیمت خرید', 'خرید', 'costprice', 'cost']));
            const price = parseFlexibleNumber(getRowVal(r, ['قیمت فروش (تومان)', 'قیمت فروش', 'قیمت', 'نرخ', 'مبلغ', 'price', 'sellprice']));
            const stock = parseFlexibleNumber(getRowVal(r, ['موجودی انبار', 'موجودی', 'تعداد', 'انبار', 'stock', 'quantity', 'qty']));
            if (name || price > 0 || stock > 0) {
              return {
                id: String(r['شناسه'] || r['id'] || 'buffet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
                name: name || 'کالای بوفه',
                category,
                costPrice,
                price,
                stock
              };
            }
            return null;
          };

          const parseHistoryRow = (r: any) => {
            const sysName = String(getRowVal(r, ['نام دستگاه', 'دستگاه', 'سیستم', 'کنسول', 'system', 'console']) || 'دستگاه').trim();
            const sysType = String(getRowVal(r, ['نوع دستگاه', 'نوع', 'کنسول', 'type']) || 'ps5').trim();
            const custName = String(getRowVal(r, ['نام مشتری', 'مشتری', 'نام', 'customer']) || 'عمومی').trim();
            const duration = parseFlexibleNumber(getRowVal(r, ['مدت کارکرد (دقیقه)', 'مدت کارکرد', 'مدت', 'دقیقه', 'کارکرد', 'duration']));
            const gpCost = parseFlexibleNumber(getRowVal(r, ['هزینه بازی (تومان)', 'هزینه بازی', 'هزینه کنسول', 'gameplay']));
            const bufCost = parseFlexibleNumber(getRowVal(r, ['هزینه بوفه (تومان)', 'هزینه بوفه', 'بوفه', 'buffet']));
            const totCost = parseFlexibleNumber(getRowVal(r, ['مبلغ کل فاکتور (تومان)', 'مبلغ کل فاکتور', 'مبلغ کل', 'جمع کل', 'فاکتور', 'total'])) || (gpCost + bufCost);
            const pMethodRaw = String(getRowVal(r, ['روش پرداخت', 'پرداخت', 'نحوه پرداخت', 'payment']) || '').toLowerCase();
            const pMethod = pMethodRaw.includes('نقدی') || pMethodRaw.includes('cash') ? 'cash' : pMethodRaw.includes('کارت') || pMethodRaw.includes('card') ? 'card' : 'debt';
            if (sysName || duration > 0 || totCost > 0) {
              return {
                id: String(r['شناسه'] || r['id'] || 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
                systemName: sysName,
                systemType: sysType,
                customerName: custName,
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                durationMinutes: duration,
                gameplayCost: gpCost,
                buffetCost: bufCost,
                totalCost: totCost,
                paymentMethod: pMethod
              };
            }
            return null;
          };

          const parseDailyBackupRow = (r: any) => {
            const workDate = String(getRowVal(r, ['تاریخ شمسی', 'تاریخ', 'تاریخ شیفت', 'date', 'workingdate']) || formatDatePersian(new Date().toISOString())).trim();
            const gpRev = parseFlexibleNumber(getRowVal(r, ['درآمد کنسول‌ها (تومان)', 'درآمد کنسول‌ها', 'درآمد کنسول', 'کنسول']));
            const bufRev = parseFlexibleNumber(getRowVal(r, ['فروش بوفه نشست‌ها (تومان)', 'فروش بوفه نشست‌ها', 'بوفه نشست']));
            const dirRev = parseFlexibleNumber(getRowVal(r, ['فروش مستقیم بوفه (تومان)', 'فروش مستقیم بوفه', 'فروش مستقیم']));
            const grossRev = parseFlexibleNumber(getRowVal(r, ['درآمد ناخالص کل (تومان)', 'درآمد ناخالص کل', 'درآمد کل', 'درآمد', 'جمع کل'])) || (gpRev + bufRev + dirRev);
            const cashAmt = parseFlexibleNumber(getRowVal(r, ['پرداخت نقدی (تومان)', 'پرداخت نقدی', 'نقد']));
            const cardAmt = parseFlexibleNumber(getRowVal(r, ['پرداخت کارتخوان (تومان)', 'پرداخت کارتخوان', 'کارتخوان', 'کارت']));
            const debtAmt = parseFlexibleNumber(getRowVal(r, ['بدهی / نسیه (تومان)', 'بدهی / نسیه', 'نسیه', 'بدهی']));
            const notes = String(getRowVal(r, ['یادداشت‌ها', 'توضیحات', 'یادداشت', 'notes']) || '').trim();
            if (workDate || grossRev > 0) {
              return {
                id: String(r['شناسه'] || r['id'] || 'backup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
                workingDatePersian: workDate,
                closedAt: new Date().toISOString(),
                totalGameplayRevenue: gpRev,
                totalSessionBuffetCost: bufRev,
                totalDirectBuffetSales: dirRev,
                totalGrossRevenue: grossRev,
                paidCashAmount: cashAmt,
                paidCardAmount: cardAmt,
                debtAccumulatedAmount: debtAmt,
                notes,
                sessions: [],
                directBuffetSales: []
              };
            }
            return null;
          };

          const parseDirectSaleRow = (r: any) => {
            const iName = String(getRowVal(r, ['نام کالا', 'کالا', 'نام', 'item']) || 'کالا').trim();
            const qty = parseFlexibleNumber(getRowVal(r, ['تعداد', 'quantity', 'qty'])) || 1;
            const uPrice = parseFlexibleNumber(getRowVal(r, ['قیمت واحد (تومان)', 'قیمت واحد', 'قیمت', 'price']));
            const tPrice = parseFlexibleNumber(getRowVal(r, ['مبلغ کل (تومان)', 'مبلغ کل', 'جمع کل', 'قیمت کل', 'total'])) || (uPrice * qty);
            const pMethodRaw = String(getRowVal(r, ['روش پرداخت', 'پرداخت', 'payment']) || '').toLowerCase();
            const pMethod = pMethodRaw.includes('نقدی') || pMethodRaw.includes('cash') ? 'cash' : pMethodRaw.includes('کارت') || pMethodRaw.includes('card') ? 'card' : 'debt';
            if (iName || tPrice > 0) {
              return {
                id: String(r['شناسه'] || r['id'] || 'direct_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
                itemName: iName,
                quantity: qty,
                unitPrice: uPrice,
                totalPrice: tPrice,
                paymentMethod: pMethod,
                timestamp: new Date().toISOString()
              };
            }
            return null;
          };

          // --- ATTEMPT 2: SQLite Physical Database Binary (.db / .sqlite) ---
          const isSQLiteHeader = text.startsWith('SQLite format 3') || (uint8[0] === 83 && uint8[1] === 81 && uint8[2] === 76 && uint8[3] === 105);
          if (isSQLiteHeader || fileName.endsWith('.db') || fileName.endsWith('.sqlite') || fileName.endsWith('.sqlite3')) {
            try {
              const SQL = await getSqlJsInstance();
              const db = new SQL.Database(uint8);

              let sqliteDailyBackups: any[] = [];
              let sqliteDebtors: any[] = [];
              let sqliteBuffetItems: any[] = [];
              let sqliteHistory: any[] = [];
              let sqliteDirectSales: any[] = [];

              const tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
              if (tablesRes && tablesRes.length > 0 && tablesRes[0].values) {
                const tableNames = tablesRes[0].values.map((v: any) => String(v[0]));

                for (const tableName of tableNames) {
                  try {
                    const queryRes = db.exec(`SELECT * FROM "${tableName}";`);
                    if (!queryRes || queryRes.length === 0) continue;

                    const cols = queryRes[0].columns;
                    const rows = queryRes[0].values.map((rowVals: any[]) => {
                      const obj: Record<string, any> = {};
                      cols.forEach((col, idx) => { obj[col] = rowVals[idx]; });
                      return obj;
                    });

                    const nameClean = tableName.toLowerCase();
                    const isDailyTable = /پشتیبان|شیفت|آرشیو|روزانه|daily|shift|backup/i.test(nameClean);
                    const isDebtorTable = /بدهکار|نسیه|مشتری|مشتریان|حساب|debtor|debt/i.test(nameClean);
                    const isBuffetTable = /بوفه|انبار|کالا|محصول|اجناس|کالاها|buffet|stock|inventory/i.test(nameClean);
                    const isHistoryTable = /تاریخچه|نشست|بازی|کنسول|فاکتور|history|session/i.test(nameClean);
                    const isDirectTable = /فروش مستقیم|فروش بوفه|direct/i.test(nameClean);

                    if (isDailyTable) {
                      rows.forEach(r => { const item = parseDailyBackupRow(r); if (item) sqliteDailyBackups.push(item); });
                    } else if (isDebtorTable) {
                      rows.forEach(r => { const item = parseDebtorRow(r); if (item) sqliteDebtors.push(item); });
                    } else if (isBuffetTable) {
                      rows.forEach(r => { const item = parseBuffetRow(r); if (item) sqliteBuffetItems.push(item); });
                    } else if (isHistoryTable) {
                      rows.forEach(r => { const item = parseHistoryRow(r); if (item) sqliteHistory.push(item); });
                    } else if (isDirectTable) {
                      rows.forEach(r => { const item = parseDirectSaleRow(r); if (item) sqliteDirectSales.push(item); });
                    } else {
                      rows.forEach(r => {
                        if (!r || typeof r !== 'object') return;
                        const rowKeysStr = Object.keys(r).join(' ').toLowerCase();

                        if (rowKeysStr.includes('بدهی') || rowKeysStr.includes('نسیه') || rowKeysStr.includes('debt') || (rowKeysStr.includes('بدهکار') && (rowKeysStr.includes('نام') || rowKeysStr.includes('تلفن')))) {
                          const item = parseDebtorRow(r); if (item) sqliteDebtors.push(item);
                        } else if (rowKeysStr.includes('موجودی') || rowKeysStr.includes('انبار') || rowKeysStr.includes('کالا') || rowKeysStr.includes('buffet') || rowKeysStr.includes('قیمت خرید')) {
                          const item = parseBuffetRow(r); if (item) sqliteBuffetItems.push(item);
                        } else if (rowKeysStr.includes('زمان شروع') || rowKeysStr.includes('هزینه بازی') || rowKeysStr.includes('کارکرد') || rowKeysStr.includes('نشست')) {
                          const item = parseHistoryRow(r); if (item) sqliteHistory.push(item);
                        } else if (rowKeysStr.includes('درآمد') || rowKeysStr.includes('کنسول‌ها') || rowKeysStr.includes('تاریخ شمسی') || rowKeysStr.includes('شیفت')) {
                          const item = parseDailyBackupRow(r); if (item) sqliteDailyBackups.push(item);
                        } else if (rowKeysStr.includes('فروش مستقیم') || (rowKeysStr.includes('قیمت واحد') && rowKeysStr.includes('تعداد'))) {
                          const item = parseDirectSaleRow(r); if (item) sqliteDirectSales.push(item);
                        } else {
                          const dItem = parseDebtorRow(r);
                          const bItem = parseBuffetRow(r);
                          if (dItem && dItem.totalDebt > 0) {
                            sqliteDebtors.push(dItem);
                          } else if (bItem && (bItem.price > 0 || bItem.stock > 0)) {
                            sqliteBuffetItems.push(bItem);
                          } else if (dItem && dItem.name) {
                            sqliteDebtors.push(dItem);
                          }
                        }
                      });
                    }
                  } catch (tblErr) {
                    console.warn('Error reading SQLite table:', tblErr);
                  }
                }
              }

              db.close();

              const totalSQLiteCount = sqliteDailyBackups.length + sqliteDebtors.length + sqliteBuffetItems.length + sqliteHistory.length + sqliteDirectSales.length;

              if (totalSQLiteCount > 0) {
                const restorePayload = {
                  rates,
                  systems,
                  buffetItems: sqliteBuffetItems.length > 0 ? sqliteBuffetItems : buffetItems,
                  debtors: sqliteDebtors.length > 0 ? sqliteDebtors : debtors,
                  history: sqliteHistory.length > 0 ? sqliteHistory : history,
                  directSales: sqliteDirectSales.length > 0 ? sqliteDirectSales : directSales,
                  dailyBackups: sqliteDailyBackups.length > 0 ? sqliteDailyBackups : dailyBackups,
                  cardReaders,
                  alarmIntervalSeconds,
                  layoutMode,
                  adminPassword,
                  adminUsername
                };

                setPendingRestore({
                  payload: restorePayload,
                  fileName: file.name,
                  summaryLines: [
                    `پشتیبان‌های روزانه: ${toPersianDigits(sqliteDailyBackups.length)} مورد`,
                    `لیست بدهکاران: ${toPersianDigits(sqliteDebtors.length)} مورد`,
                    `انبار بوفه: ${toPersianDigits(sqliteBuffetItems.length)} مورد`,
                    `تاریخچه نشست‌ها: ${toPersianDigits(sqliteHistory.length)} مورد`,
                    `فروش مستقیم بوفه: ${toPersianDigits(sqliteDirectSales.length)} مورد`
                  ]
                });
                setAdminPasswordInput('');
                setPasswordModalError('');
                return;
              }
            } catch (sqliteErr) {
              console.warn('SQLite import failed, falling back to XLSX parser:', sqliteErr);
            }
          }

          // --- ATTEMPT 3: Excel Spreadsheet (.xlsx, .xls, .xlsm, .csv) ---
          try {
            const wb = XLSX.read(buffer, { type: 'array' });
            if (wb && wb.SheetNames && wb.SheetNames.length > 0) {
              // Loop through all sheets in workbook
              wb.SheetNames.forEach((sheetName) => {
            const sheet = wb.Sheets[sheetName];
            const rows: any[] = XLSX.utils.sheet_to_json(sheet);
            if (!rows || rows.length === 0) return;

            const nameClean = sheetName.toLowerCase();
            const isDailySheet = /پشتیبان|شیفت|آرشیو|روزانه|daily|shift|backup/i.test(nameClean);
            const isDebtorSheet = /بدهکار|نسیه|مشتری|مشتریان|حساب|debtor|debt/i.test(nameClean);
            const isBuffetSheet = /بوفه|انبار|کالا|محصول|اجناس|کالاها|buffet|stock|inventory/i.test(nameClean);
            const isHistorySheet = /تاریخچه|نشست|بازی|کنسول|فاکتور|history|session/i.test(nameClean);
            const isDirectSheet = /فروش مستقیم|فروش بوفه|direct/i.test(nameClean);

            if (isDailySheet) {
              rows.forEach(r => { const item = parseDailyBackupRow(r); if (item) extractedDailyBackups.push(item); });
            } else if (isDebtorSheet) {
              rows.forEach(r => { const item = parseDebtorRow(r); if (item) extractedDebtors.push(item); });
            } else if (isBuffetSheet) {
              rows.forEach(r => { const item = parseBuffetRow(r); if (item) extractedBuffetItems.push(item); });
            } else if (isHistorySheet) {
              rows.forEach(r => { const item = parseHistoryRow(r); if (item) extractedHistory.push(item); });
            } else if (isDirectSheet) {
              rows.forEach(r => { const item = parseDirectSaleRow(r); if (item) extractedDirectSales.push(item); });
            } else {
              // Unclassified or generic sheet name (e.g. "Sheet1", "دیتا", "گزارش")
              // Inspect rows dynamically by keys!
              rows.forEach(r => {
                if (!r || typeof r !== 'object') return;
                const rowKeysStr = Object.keys(r).join(' ').toLowerCase();

                if (rowKeysStr.includes('بدهی') || rowKeysStr.includes('نسیه') || rowKeysStr.includes('debt') || (rowKeysStr.includes('بدهکار') && (rowKeysStr.includes('نام') || rowKeysStr.includes('تلفن')))) {
                  const item = parseDebtorRow(r); if (item) extractedDebtors.push(item);
                } else if (rowKeysStr.includes('موجودی') || rowKeysStr.includes('انبار') || rowKeysStr.includes('کالا') || rowKeysStr.includes('buffet') || rowKeysStr.includes('قیمت خرید')) {
                  const item = parseBuffetRow(r); if (item) extractedBuffetItems.push(item);
                } else if (rowKeysStr.includes('زمان شروع') || rowKeysStr.includes('هزینه بازی') || rowKeysStr.includes('کارکرد') || rowKeysStr.includes('نشست')) {
                  const item = parseHistoryRow(r); if (item) extractedHistory.push(item);
                } else if (rowKeysStr.includes('درآمد') || rowKeysStr.includes('کنسول‌ها') || rowKeysStr.includes('تاریخ شمسی') || rowKeysStr.includes('شیفت')) {
                  const item = parseDailyBackupRow(r); if (item) extractedDailyBackups.push(item);
                } else if (rowKeysStr.includes('فروش مستقیم') || (rowKeysStr.includes('قیمت واحد') && rowKeysStr.includes('تعداد'))) {
                  const item = parseDirectSaleRow(r); if (item) extractedDirectSales.push(item);
                } else {
                  // Universal fallback for basic 2-column or 3-column rows
                  const values = Object.values(r);
                  if (values.length >= 1) {
                    // Try parsing as debtor if numeric value is present
                    const dItem = parseDebtorRow(r);
                    const bItem = parseBuffetRow(r);
                    if (dItem && dItem.totalDebt > 0) {
                      extractedDebtors.push(dItem);
                    } else if (bItem && (bItem.price > 0 || bItem.stock > 0)) {
                      extractedBuffetItems.push(bItem);
                    } else if (dItem && dItem.name) {
                      extractedDebtors.push(dItem);
                    }
                  }
                }
              });
            }
          });

          const totalExtractedCount = extractedDailyBackups.length + extractedDebtors.length + extractedBuffetItems.length + extractedHistory.length + extractedDirectSales.length;

          if (totalExtractedCount === 0) {
            throw new Error('هیچ داده‌ای در فایل اکسل انتخاب شده پیدا نشد. لطفاً از داشتن ردیف‌های داده با عناوین ستون مناسب اطمینان حاصل نمایید.');
          }

          const restorePayload = {
            rates,
            systems,
            buffetItems: extractedBuffetItems.length > 0 ? extractedBuffetItems : buffetItems,
            debtors: extractedDebtors.length > 0 ? extractedDebtors : debtors,
            history: extractedHistory.length > 0 ? extractedHistory : history,
            directSales: extractedDirectSales.length > 0 ? extractedDirectSales : directSales,
            dailyBackups: extractedDailyBackups.length > 0 ? extractedDailyBackups : dailyBackups,
            cardReaders,
            alarmIntervalSeconds,
            layoutMode,
            adminPassword,
            adminUsername
          };

          setPendingRestore({
            payload: restorePayload,
            fileName: file.name,
            summaryLines: [
              `پشتیبان‌های روزانه: ${toPersianDigits(extractedDailyBackups.length)} مورد`,
              `لیست بدهکاران: ${toPersianDigits(extractedDebtors.length)} مورد`,
              `انبار بوفه: ${toPersianDigits(extractedBuffetItems.length)} مورد`,
              `تاریخچه نشست‌ها: ${toPersianDigits(extractedHistory.length)} مورد`,
              `فروش مستقیم بوفه: ${toPersianDigits(extractedDirectSales.length)} مورد`
            ]
          });
          setAdminPasswordInput('');
          setPasswordModalError('');
          return;
        }
      } catch (excelErr) {
        console.warn('Excel parse error:', excelErr);
      }

      throw new Error('ساختار داده‌ای شناخته‌شده‌ای در این فایل پیدا نشد. لطفاً از صحت فایل (.db, .xlsx, .xlsm, .json, .csv) اطمینان حاصل کنید.');
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('Error importing DB file:', err);
        setImportStatus({ error: errorMsg || 'خطا در بارگذاری و تحلیل فایل پشتیبان.', success: false });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setImportStatus({ error: 'خطا در خواندن فایل از روی حافظه دیسک.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsArrayBuffer(file);
  };

  // Find the currently inspected workspace backup
  const selectedBackup = dailyBackups.find(b => b.id === selectedBackupId);

  // Parse total backups for calculations
  const totalBackupsCount = dailyBackups.length;

  // Compute stats across all saved backups based on date ranges
  const getAggregatedStats = (daysLimit: number) => {
    const limitMs = daysLimit * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    // Filter backups within date limit range
    const filtered = dailyBackups.filter(b => {
      if (daysLimit === 1) return true; // Show latest or all for base filters if needed
      const closeTimeMs = new Date(b.closedAt).getTime();
      return (now - closeTimeMs) <= limitMs;
    });

    const gameplay = filtered.reduce((sum, b) => sum + b.totalGameplayRevenue, 0);
    const buffet = filtered.reduce((sum, b) => sum + (b.totalSessionBuffetCost + b.totalDirectBuffetSales), 0);
    const gross = filtered.reduce((sum, b) => sum + b.totalGrossRevenue, 0);
    const cash = filtered.reduce((sum, b) => sum + b.paidCashAmount, 0);
    const card = filtered.reduce((sum, b) => sum + b.paidCardAmount, 0);
    const debt = filtered.reduce((sum, b) => sum + b.debtAccumulatedAmount, 0);

    return { gameplay, buffet, gross, cash, card, debt, count: filtered.length };
  };

  const dailyStats = dailyBackups.length > 0 ? {
    gameplay: dailyBackups[0].totalGameplayRevenue,
    buffet: dailyBackups[0].totalSessionBuffetCost + dailyBackups[0].totalDirectBuffetSales,
    gross: dailyBackups[0].totalGrossRevenue,
    cash: dailyBackups[0].paidCashAmount,
    card: dailyBackups[0].paidCardAmount,
    debt: dailyBackups[0].debtAccumulatedAmount,
    count: 1
  } : { gameplay: 0, buffet: 0, gross: 0, cash: 0, card: 0, debt: 0, count: 0 };

  const weeklyStats = getAggregatedStats(7);
  const monthlyStats = getAggregatedStats(30);
  const yearlyStats = getAggregatedStats(365);

  const activeStats = 
    aggregationRange === 'daily' ? dailyStats : 
    aggregationRange === 'weekly' ? weeklyStats : 
    aggregationRange === 'monthly' ? monthlyStats : yearlyStats;

  // Filter backup files by query/dates
  const filteredBackups = dailyBackups.filter(b => {
    const searchTerm = dateSearchTerm.toLowerCase();
    const matchesNotes = b.notes?.toLowerCase().includes(searchTerm);
    const matchesPersian = b.workingDatePersian.toLowerCase().includes(searchTerm);
    const matchesISO = b.closedAt.toLowerCase().includes(searchTerm);
    return matchesNotes || matchesPersian || matchesISO;
  });

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* DB Core Header widgets */}
      <div className="p-5 bg-gradient-to-r from-surface-151921 to-surface-12161e border border-white/5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20">
            <Database className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-black text-white">دیتابیس پشتیبان مالی و بایگانی شیفت‌ها</h2>
            <p className="text-[11px] text-slate-400">بانک اطلاعاتی متمرکز لوکال جهت پیگیری درآمد روزانه، تراکنش‌های کارتخوان و مطالبات دفتری (نسیه ها) به تفکیک تاریخ</p>
          </div>
        </div>
        
        {/* DB capacity counts */}
        <div className="flex gap-4">
          <div className="px-3.5 py-2 bg-surface-0c0f16/90 border border-white/5 rounded-xl text-center shrink-0">
            <span className="text-[9px] text-slate-400 block mb-0.5">کل بکاپ‌های ارسالی</span>
            <span className="text-sm font-extrabold text-blue-400 font-mono">{toPersianDigits(totalBackupsCount)} روز</span>
          </div>
          <div className="px-3.5 py-2 bg-surface-0c0f16/90 border border-white/5 rounded-xl text-center shrink-0">
            <span className="text-[9px] text-slate-400 block mb-0.5">وضعیت ذخیره‌سازی لوکال</span>
            <span className="text-sm font-extrabold text-emerald-400 flex items-center gap-1.5 font-sans justify-center mt-0.5">
              <HardDrive className="w-3.5 h-3.5" />
              <span>پایدار (OK)</span>
            </span>
          </div>
        </div>
      </div>

      {/* DB Backup File Exporter/Importer Panel */}
      <div className="p-5 bg-gradient-to-r from-surface-131722 to-surface-161b26 border border-blue-500/15 rounded-2xl space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/5 pb-3">
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              مرکز پشتیبان‌گیری دیسک سخت و تبادل فایل دیتابیس (.db)
            </h3>
            <p className="text-[10px] text-slate-400">
              تهیه فایل‌های پشتیبان کامل خارج از سیستم جهت محافظت نهایی و بازیابی از پوشه <code className="bg-surface-0c0f16 px-1.5 py-0.5 rounded text-blue-400 text-[10px] font-mono">{backupPath}</code>
            </p>
          </div>
          
          <div className="text-[10px] text-slate-300 bg-surface-0c0f16/50 px-3 py-1.5 rounded-lg border border-white/5 flex items-center gap-1.5 select-none font-sans">
            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>پیشنهاد می‌شود فایل‌ها را در پوشه پیش‌فرض تعیین‌شده (<strong className="text-blue-400">{backupPath}</strong>) روی سیستم خود نگهداری کنید.</span>
          </div>
        </div>

        {/* Backup Path Configuration Box */}
        <div className="p-4 bg-surface-0b0e14/80 border border-white/5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 block font-bold">مسیر پیش‌فرض پوشه پشتیبان (بکاپ‌ها):</span>
            {isEditingPath ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={tempPath}
                  onChange={(e) => setTempPath(e.target.value)}
                  className="px-2.5 py-1 bg-surface-151921 border border-white/10 rounded-lg text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-64 text-left"
                  dir="ltr"
                  placeholder="./backups"
                />
                <button
                  type="button"
                  onClick={() => {
                    const finalPath = tempPath.trim() || './backups';
                    setBackupPath(finalPath);
                    localStorage.setItem('gamenet_backup_path', finalPath);
                    setIsEditingPath(false);
                  }}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                >
                  ذخیره
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTempPath(backupPath);
                    setIsEditingPath(false);
                  }}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-slate-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                >
                  لغو
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-1 font-mono text-[11px] text-blue-400">
                <code className="bg-surface-0b0e14 px-2 py-0.5 rounded border border-white/5">{backupPath}</code>
              </div>
            )}
          </div>
          
          {!isEditingPath && (
            <button
              type="button"
              onClick={() => setIsEditingPath(true)}
              className="px-3 py-1.5 bg-surface-1c202e hover:bg-surface-232a3e text-slate-300 hover:text-white border border-white/5 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
            >
              تغییر مسیر پوشه پشتیبان
            </button>
          )}
        </div>

        {/* Action Panel Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Card 1: EXPORT FILE (.db format) */}
          <div className="p-4 bg-surface-0a0d14 border border-white/5 hover:border-blue-500/20 rounded-xl transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-blue-400" />
                  <span>تهیه خروجی دیتابیس (پشتیبان‌گیری)</span>
                </span>
                <span className="text-[10px] text-blue-400 font-mono bg-blue-500/10 px-2.5 py-0.5 rounded border border-blue-500/20 font-bold">
                  {exportFormat.toUpperCase()}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-300 leading-relaxed text-justify">
                ذخیره کامل تمام اطلاعات، نسیه‌ها، بوفه و تاریخچه‌ها در قالب <strong className="text-blue-400">فایل استاندارد دیتابیس (.db)</strong> جهت نگهداری امن در سیستم یا انتقال.
              </p>

              {/* DB Format Indicator */}
              <div className="flex items-center gap-2 p-2 bg-surface-121620 border border-blue-500/20 rounded-xl text-[10.5px] font-bold text-blue-400">
                <Database className="w-4 h-4 text-blue-400 shrink-0" />
                <span>فرمت پشتیبان‌گیری: فایل دیتابیس (.db)</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleExportDatabaseFile('db')}
              className="w-full h-10 text-white bg-blue-600 hover:bg-blue-500 border border-blue-500/30 shadow-lg shadow-blue-950/40 rounded-xl font-bold text-[11px] flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
            >
              <Download className="w-4 h-4 animate-bounce" />
              <span>دانلود دیتابیس با فرمت فایل دیتابیس (.db)</span>
            </button>
          </div>

          {/* Card 2: IMPORT FILE (.db format) */}
          <div className="p-4 bg-surface-0a0d14 border border-white/5 hover:border-blue-500/20 rounded-xl transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-blue-400" />
                  <span>بازیابی و بارگذاری دیتابیس (Restore)</span>
                </span>
                <span className="text-[9px] text-blue-400 font-mono bg-blue-500/10 px-2.5 py-0.5 rounded border border-blue-500/20 dir-ltr font-bold">
                  .db
                </span>
              </div>
              <p className="text-[10.5px] text-slate-300 leading-relaxed text-justify">
                بارگذاری فایل‌های پشتیبان با پسوند <strong className="text-blue-400">.db</strong> (فایل دیتابیس). دیتابیس هوشمند فایل را آنالیز نموده و کلیه اطلاعات را در سیستم جایگذاری می‌نماید.
              </p>

              {/* Supported format badge */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="px-2.5 py-1 bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[10px] rounded-md font-mono flex items-center gap-1.5 font-bold shadow-sm">
                  <Database className="w-3.5 h-3.5" />
                  <span>.DB Database</span>
                </span>
              </div>
            </div>

            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".db,.json,.xlsx,.xls,.xlsm,.csv"
                onChange={handleImportDatabaseFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-10 bg-surface-1d2433 hover:bg-surface-2b354c text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-xl font-bold text-[11px] flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
              >
                <Upload className="w-4 h-4 text-blue-400 animate-pulse" />
                <span>انتخاب و بارگذاری فایل پشتیبان دیتابیس (.db)</span>
              </button>
            </div>
          </div>

        </div>

        {/* Feedback alerts states */}
        {importStatus?.success && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-[11px] flex items-center gap-2.5 animate-in slide-in-from-top duration-300">
            <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
            <span className="font-bold">دیتابیس با موفقیت بازگردانی کامل شد! کلیه فاکتورها، بوفه و بازی داک‌ها به تاریخ و وضعیت بکاپ برگردانده شدند.</span>
          </div>
        )}
        {importStatus?.error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-[11px] flex items-center gap-2.5 animate-in slide-in-from-top duration-300">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span className="font-bold">خطا در بازیابی دیتابیس فیزیکی: {importStatus.error}</span>
          </div>
        )}

      </div>

      {/* Aggregate Reporting dashboard (Daily / Weekly / Monthly toggler) */}
      <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Layers className="w-4 h-4 text-emerald-400" />
              خلاصه محاسباتی دوره‌ای کانال‌های دیتابیس
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">محاسبه برآیند کل فاکتورها، بوفه‌ها و تراکنش‌های بایگانی شده در بازه‌های زمانی متناوب</p>
          </div>
          
          {/* Toggle buttons tab controls */}
          <div className="flex items-center gap-1 bg-surface-090c11 p-1 border border-white/5 rounded-xl">
            <button
              onClick={() => setAggregationRange('daily')}
              className={`px-3 py-1.5 rounded-lg transition-all font-bold text-[10px] cursor-pointer ${
                aggregationRange === 'daily' ? 'bg-rose-500 text-white shadow font-extrabold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              آخرین روز کاری بسته شده
            </button>
            <button
              onClick={() => setAggregationRange('weekly')}
              className={`px-3 py-1.5 rounded-lg transition-all font-bold text-[10px] cursor-pointer ${
                aggregationRange === 'weekly' ? 'bg-rose-500 text-white shadow font-extrabold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              مجموع یک هفته اخیر (7 روز)
            </button>
            <button
              onClick={() => setAggregationRange('monthly')}
              className={`px-3 py-1.5 rounded-lg transition-all font-bold text-[10px] cursor-pointer ${
                aggregationRange === 'monthly' ? 'bg-rose-500 text-white shadow font-extrabold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              مجموع یک ماه اخیر (30 روز)
            </button>
            <button
              onClick={() => setAggregationRange('yearly')}
              className={`px-3 py-1.5 rounded-lg transition-all font-bold text-[10px] cursor-pointer ${
                aggregationRange === 'yearly' ? 'bg-rose-500 text-white shadow font-extrabold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              مجموع یک سال اخیر (365 روز)
            </button>
          </div>
        </div>

        {totalBackupsCount === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            هنوز هیچ روز کاری بسته‌شده‌ای در دیتابیس لوکال برنامه بایگانی نگردیده است.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Box 1 */}
            <div className="p-3 bg-surface-0b0e14 border border-white/5 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-400 block font-medium">مجموع کارکرد سیستم‌ها</span>
              <span className="font-mono text-xs font-bold text-blue-400 block">{formatCurrency(activeStats.gameplay)}</span>
            </div>
            {/* Box 2 */}
            <div className="p-3 bg-surface-0b0e14 border border-white/5 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-400 block font-medium">مجموع فروش بوفه</span>
              <span className="font-mono text-xs font-bold text-indigo-400 block">{formatCurrency(activeStats.buffet)}</span>
            </div>
            {/* Box 3 */}
            <div className="p-3 bg-surface-0b0e14 border border-emerald-500/10 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-400 block font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
                کل فروش ناخالص
              </span>
              <span className="font-mono text-xs font-extrabold text-emerald-400 block">{formatCurrency(activeStats.gross)}</span>
            </div>
            {/* Box 4 */}
            <div className="p-3 bg-surface-0b0e14 border border-white/5 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-400 block font-medium">رقم پرداختی نقدی (دخل)</span>
              <span className="font-mono text-xs font-bold text-white block">{formatCurrency(activeStats.cash)}</span>
            </div>
            {/* Box 5 */}
            <div className="p-3 bg-surface-0b0e14 border border-white/5 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-400 block font-medium">پرداخت با کارتخوان</span>
              <span className="font-mono text-xs font-bold text-white block">{formatCurrency(activeStats.card)}</span>
            </div>
            {/* Box 6 */}
            <div className="p-3 bg-surface-0b0e14 border border-white/5 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-400 block font-medium">کل نسیه دفتری ایجادشده</span>
              <span className="font-mono text-xs font-bold text-amber-500 block">{formatCurrency(activeStats.debt)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Right Pane: Archive of closed work days (List to select Date) - Takes 5 cols */}
        <div className="lg:col-span-12 xl:col-span-5 space-y-4">
          <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-rose-500" />
                انتخاب تاریخ روز کاری
              </h3>
              <span className="text-[10px] text-slate-500 hover:underline cursor-pointer">مرتب‌سازی نزولی</span>
            </div>

            {/* Micro search input to filter specific Persian days */}
            <div className="relative text-xs">
              <span className="absolute right-3 top-2.5 text-slate-505 shrink-0">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="جستجوی تاریخ هجری شمسی، یادداشت..."
                value={dateSearchTerm}
                onChange={(e) => setDateSearchTerm(e.target.value)}
                className="w-full pr-9 pl-3 py-1.5 bg-surface-0b0e14 border border-white/5 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-rose-500 text-xs text-right"
              />
            </div>

            {/* List scrollbox */}
            <div className="space-y-2 max-h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/5 pr-1 text-xs">
              {filteredBackups.length === 0 ? (
                <div className="text-center py-10 text-slate-600">
                  {dateSearchTerm ? 'موردی موافق جستجو یافت نشد!' : 'بانک اطلاعاتی روز‌های کاری خالیست.'}
                </div>
              ) : (
                filteredBackups.map((item, index) => {
                  const isSelected = selectedBackupId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedBackupId(item.id)}
                      className={`w-full p-3 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer group ${
                        isSelected 
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 shadow-lg shadow-rose-950/10' 
                          : 'bg-surface-0b0e14/40 border-white/5 text-slate-350 hover:border-white/10 hover:bg-white/5'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className={`${isSelected ? 'text-rose-400' : 'text-slate-200'} font-sans`}>
                            📆 {item.workingDatePersian || formatDatePersian(item.closedAt).split('،')[0]}
                          </span>
                          <span className="text-[9px] font-sans opacity-60">
                            ({toPersianDigits(item.history.length)} نوبت • {toPersianDigits(item.directSales.length)} بوفه)
                          </span>
                        </div>
                        
                        {item.notes && (
                          <p className="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-[200px]">
                            {item.notes}
                          </p>
                        )}
                        <span className="text-[9px] text-slate-500 block font-mono">
                          بسته شده در ساعت: {item.closedAt && !isNaN(new Date(item.closedAt).getTime()) ? new Date(item.closedAt).toLocaleTimeString('fa-IR') : '-'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-left">
                          <span className="font-bold font-mono text-emerald-450 block text-xs">
                            {formatCurrency(item.totalGrossRevenue)}
                          </span>
                          <span className="text-[9px] text-slate-500 capitalize block">
                            توسط {item.closedBy === 'admin' ? 'مدیر' : 'اپراتور'}
                          </span>
                        </div>
                        <ChevronLeft className={`w-4 h-4 transition-transform ${isSelected ? 'translate-x-0 text-rose-400' : 'translate-x-0.5 text-slate-500 group-hover:translate-x-0'}`} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Left Pane: Detailed inspection panel for selected back-up day - Takes 7 cols */}
        <div className="lg:col-span-12 xl:col-span-7">
          {selectedBackup ? (
            <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-5 shadow-xl animate-in fade-in slide-in-from-left duration-200 text-xs">
              
              {/* Inspection Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div className="space-y-1">
                  <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-lg font-bold font-sans">
                    نمایش تاریخ منتخب دیتابیس
                  </span>
                  <h3 className="text-sm font-black text-white font-sans mt-1">
                    روز کاری {selectedBackup.workingDatePersian}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    تاریخ ثبت قطعی: {formatDatePersian(selectedBackup.closedAt)}
                  </span>
                </div>

                <div className="flex gap-2">
                  {onRestoreBackupToCurrent && (
                    <button
                      type="button"
                      onClick={() => setBackupToRestore(selectedBackup)}
                      className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-600 border border-indigo-500/20 text-indigo-400 hover:text-white transition-all rounded-xl font-bold text-[10px] flex items-center gap-1.5 cursor-pointer shadow"
                      title="بازنشانی این اطلاعات به عنوان تراکنش‌های جاری صندوق"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      بازنشانی به صندوق زنده
                    </button>
                  )}

                  {onDeleteBackup && (
                    <button
                      type="button"
                      onClick={() => setBackupToDelete(selectedBackup)}
                      className="p-2 bg-rose-500/10 hover:bg-rose-600 border border-rose-500/25 text-rose-400 hover:text-white rounded-xl transition-all cursor-pointer shadow-sm"
                      title="حذف دائمی پشتیبان از حافظه دستگاه"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Note container */}
              {selectedBackup.notes && (
                <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl space-y-1 text-slate-300">
                  <span className="text-[9px] text-rose-400 font-bold block">✍️ یادداشت‌های اپراتور این روز کاری:</span>
                  <p className="leading-relaxed text-[11px] font-sans italic">{selectedBackup.notes}</p>
                </div>
              )}

              {/* Quick grid stats for this backup day */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-surface-0b0e14 border border-white/5 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-400 block">سهم بازی پورت سیستم‌ها:</span>
                  <span className="font-mono font-bold text-[11px] text-slate-200 block">{formatCurrency(selectedBackup.totalGameplayRevenue)}</span>
                </div>
                <div className="p-3 bg-surface-0b0e14 border border-white/5 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-400 block">فروش بوفه متصل نوبت‌ها:</span>
                  <span className="font-mono font-bold text-[11px] text-slate-200 block">{formatCurrency(selectedBackup.totalSessionBuffetCost)}</span>
                </div>
                <div className="p-3 bg-surface-0b0e14 border border-white/5 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-400 block">فروش مستقل بوفه آزاد:</span>
                  <span className="font-mono font-bold text-[11px] text-slate-200 block">{formatCurrency(selectedBackup.totalDirectBuffetSales)}</span>
                </div>
                <div className="p-3 bg-surface-0b0e14 border border-white/5 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-400 block">دریافت کارتخوان (POS):</span>
                  <span className="font-mono font-bold text-[11px] text-blue-400 block">{formatCurrency(selectedBackup.paidCardAmount)}</span>
                </div>
                <div className="p-3 bg-surface-0b0e14 border border-white/5 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-400 block">دریافت نقدی صندوق:</span>
                  <span className="font-mono font-bold text-[11px] text-emerald-450 block">{formatCurrency(selectedBackup.paidCashAmount)}</span>
                </div>
                <div className="p-3 bg-surface-1b1813 border border-amber-500/10 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-amber-400 block">مجموع بدهی نسیه دفتری:</span>
                  <span className="font-mono font-bold text-[11px] text-amber-500 block">{formatCurrency(selectedBackup.debtAccumulatedAmount)}</span>
                </div>
              </div>

              {/* Collapsible deep transaction logs listings */}
              <div className="space-y-4 pt-1">
                <span className="text-[11px] font-bold text-slate-350 block flex items-center gap-1.5">
                  <CircleDollarSign className="w-4 h-4 text-emerald-450" />
                  صورت تراکنش‌های نهایی‌شده روز کاری مستند در بکاپ
                </span>

                <div className="border border-white/5 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right" dir="rtl">
                      <thead>
                        <tr className="bg-surface-0b0e14 text-slate-400 text-[10px] border-b border-white/5">
                          <th className="px-3 py-2.5">بخش / دستگاه</th>
                          <th className="px-3 py-2.5">مشتری</th>
                          <th className="px-3 py-2.5 text-center">زمان بازی</th>
                          <th className="px-3 py-2.5 text-left">مبلغ کل فاکتور</th>
                          <th className="px-3 py-2.5 text-center">فاکتور و چاپ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 bg-surface-0b0e14/30">
                        {selectedBackup.history.length === 0 && selectedBackup.directSales.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-slate-550">
                              هیچ تراکنشی در این گزارش روزانه ثبت نگردیده بود.
                            </td>
                          </tr>
                        ) : (
                          <>
                            {/* History list */}
                            {selectedBackup.history.map((h, hIdx) => (
                              <tr key={`bk-hist-${h.id}-${hIdx}`} className="hover:bg-white/5 transition-colors text-[10.5px]">
                                <td className="px-3 py-2">
                                  <span className="font-bold text-slate-200 block">{h.systemName}</span>
                                  <span className="text-[8px] text-slate-500 font-mono block">
                                    {h.endTime && !isNaN(new Date(h.endTime).getTime()) ? new Date(h.endTime).toLocaleTimeString('fa-IR') : '-'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-medium text-slate-300">
                                  {h.customerName}
                                </td>
                                <td className="px-3 py-2 text-center font-mono text-slate-400">
                                  {toPersianDigits(h.durationMinutes)} دقیقه
                                </td>
                                <td className="px-3 py-2 text-left space-y-0.5">
                                  <div className="font-mono font-bold text-slate-200">{formatCurrency(h.totalCost)}</div>
                                  <div className="text-[8px] opacity-75">
                                    {h.paymentMethod === 'card' && <span className="text-blue-400 font-bold bg-blue-500/10 px-1 py-0.2 rounded">کارتخوان {h.cardReaderName ? `(${h.cardReaderName})` : ''}</span>}
                                    {h.paymentMethod === 'cash' && <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1 py-0.2 rounded">نقدی</span>}
                                    {h.paymentMethod === 'debt' && <span className="text-amber-500 font-bold bg-amber-500/10 px-1 py-0.2 rounded">نسیه {h.debtAmount?.toLocaleString() || ''}</span>}
                                    {h.paymentMethod === 'mixed' && <span className="text-purple-400 font-bold bg-purple-500/10 px-1 py-0.2 rounded">ترکیبی</span>}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedInvoiceForModal({
                                        invoiceNumber: `INV-${h.systemName.replace(/\s+/g, '')}-${h.id.slice(-4)}`,
                                        date: h.endTime,
                                        customerName: h.customerName,
                                        customerPhone: h.customerPhone,
                                        systemName: h.systemName,
                                        systemType: h.systemType,
                                        startTime: h.startTime,
                                        endTime: h.endTime,
                                        durationMinutes: h.durationMinutes,
                                        playersCount: h.playersCount,
                                        hourlyRate: h.hourlyRateUsed,
                                        gamePlayCost: h.gamePlayCost,
                                        buffetItems: h.buffetItems,
                                        buffetCost: h.buffetCost,
                                        extraServices: h.extraServices,
                                        extraServicesCost: h.extraServicesCost,
                                        partialPayments: h.partialPayments,
                                        totalPartialPaid: h.partialPayments?.reduce((s, p) => s + p.amount, 0),
                                        roundingOffset: h.roundingOffset,
                                        totalCost: h.totalCost,
                                        netPayable: h.totalCost,
                                        paymentMethod: h.paymentMethod,
                                        cashPaidAmount: h.cashPaidAmount,
                                        cardPaidAmount: h.cardPaidAmount,
                                        debtAmount: h.debtAmount,
                                        cardReaderName: h.cardReaderName,
                                        debtDetails: h.debtDetails,
                                        notes: h.notes,
                                      });
                                    }}
                                    className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 hover:text-amber-300 border border-amber-500/20 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 mx-auto cursor-pointer"
                                    title="مشاهده و چاپ مجدد فاکتور از دیتابیس بکاپ"
                                  >
                                    <Receipt className="w-3.5 h-3.5" />
                                    <span>فاکتور</span>
                                  </button>
                                </td>
                              </tr>
                            ))}

                            {/* Direct sales list */}
                            {selectedBackup.directSales.map((sale, sIdx) => (
                              <tr key={`bk-sale-${sale.id}-${sIdx}`} className="hover:bg-white/5 transition-colors text-[10.5px]">
                                <td className="px-3 py-2">
                                  <span className="font-bold text-blue-400 block flex items-center gap-1">
                                    <ShoppingBag className="w-3 h-3 shrink-0" />
                                    بوفه مستقیم
                                  </span>
                                  <span className="text-[8px] text-slate-500 font-mono block">
                                    {sale.date && !isNaN(new Date(sale.date).getTime()) ? new Date(sale.date).toLocaleTimeString('fa-IR') : '-'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-medium text-slate-300">{sale.customerName}</td>
                                <td className="px-3 py-2 text-center text-slate-650">-</td>
                                <td className="px-3 py-2 text-left space-y-0.5">
                                  <div className="font-mono font-bold text-slate-200">{formatCurrency(sale.totalCost)}</div>
                                  <span className="text-[8px] text-indigo-400 bg-indigo-500/10 px-1 py-0.2 rounded font-bold">بوفه آزاد</span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedInvoiceForModal({
                                        invoiceNumber: `BUF-${sale.id.slice(-4)}`,
                                        date: sale.date,
                                        customerName: sale.customerName,
                                        systemName: 'بوفه آزاد',
                                        systemType: 'فروش مستقیم',
                                        startTime: sale.date,
                                        endTime: sale.date,
                                        durationMinutes: 0,
                                        playersCount: 0,
                                        gamePlayCost: 0,
                                        buffetItems: sale.items,
                                        buffetCost: sale.totalCost,
                                        totalCost: sale.totalCost,
                                        netPayable: sale.totalCost,
                                        paymentMethod: sale.paymentMethod,
                                        cashPaidAmount: sale.cashPaidAmount,
                                        cardPaidAmount: sale.cardPaidAmount,
                                        debtAmount: sale.debtAmount,
                                        cardReaderName: sale.cardReaderName,
                                      });
                                    }}
                                    className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 hover:text-amber-300 border border-amber-500/20 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 mx-auto cursor-pointer"
                                    title="مشاهده فاکتور بوفه از دیتابیس بکاپ"
                                  >
                                    <Receipt className="w-3.5 h-3.5" />
                                    <span>فاکتور</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* System Logs archived in this backup */}
              {selectedBackup.systemLogs && selectedBackup.systemLogs.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-[11px] font-bold text-slate-350 block flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-purple-400" />
                    لاگ‌ها و رویدادهای سیستم ذخیره‌شده در این روز کاری ({toPersianDigits(selectedBackup.systemLogs.length)} مورد)
                  </span>

                  <div className="border border-white/5 rounded-xl overflow-hidden bg-surface-0b0e14/30">
                    <div className="max-h-60 overflow-y-auto divide-y divide-white/5 text-[10.5px]">
                      {selectedBackup.systemLogs.map((log) => (
                        <div key={log.id} className="p-2.5 flex items-start justify-between gap-2 hover:bg-white/5 transition-colors">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-medium text-slate-200">
                              {log.systemName && (
                                <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono">
                                  {log.systemName}
                                </span>
                              )}
                              <span>{log.message}</span>
                            </div>
                            {log.details && (
                              <p className="text-[9.5px] text-slate-400 font-mono">{log.details}</p>
                            )}
                          </div>
                          <span className="text-[8.5px] text-slate-500 font-mono shrink-0">
                            {log.timestamp && !isNaN(new Date(log.timestamp).getTime())
                              ? new Date(log.timestamp).toLocaleTimeString('fa-IR')
                              : '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="h-full min-h-[350px] p-6 bg-surface-151921/60 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 shadow-inner">
              <Database className="w-12 h-12 text-slate-700 animate-pulse" />
              <p className="text-sm font-bold text-slate-400">گزینه‌ای جهت تماشا انتخاب نشده است</p>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                لطفاً از ستون سمت راست، تاریخ یکی از روزهای کاری بسته شده دیتابیس را انتخاب کنید یا مابین تاریخ‌ها جستجو نمایید تا کلیه اسناد مالی به تفکیک روی کل این نما به صورت کامل صادر گردد.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Admin Password Verification Modal for Database Import */}
      {pendingRestore && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface-0b0e14 border border-blue-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-right dir-rtl animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">ورود رمز عبور مدیریت</h3>
                  <p className="text-[11px] text-slate-400">جهت تایید بازیابی و بارگذاری دیتابیس، لطفاً رمز مدیریت سیستمی که این بکاپ از آن گرفته شده را وارد نمایید.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingRestore(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Box */}
            <div className="p-3 bg-surface-121620 border border-white/5 rounded-xl space-y-1.5 text-xs text-slate-300">
              <span className="text-[10px] text-blue-400 font-bold block">📊 خلاصه اطلاعات فایل پشتیبان ({pendingRestore.fileName}):</span>
              <div className="space-y-1 text-[11px] font-sans pt-0.5">
                {pendingRestore.summaryLines.map((line, idx) => (
                  <span key={idx} className="block text-slate-300">• {line}</span>
                ))}
              </div>
            </div>

            {/* Password Input Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPasswordModalError('');
                const trimmed = adminPasswordInput.trim();
                if (!trimmed) {
                  setPasswordModalError('لطفاً رمز عبور مدیریت را وارد نمایید.');
                  return;
                }

                const finishRestore = (data: any) => {
                  onImportFullBackup(data);
                  setImportStatus({ success: true, error: undefined });
                  setTimeout(() => setImportStatus(null), 5000);
                  setPendingRestore(null);
                  setAdminPasswordInput('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                };

                if (pendingRestore.encrypted) {
                  try {
                    finishRestore(await decryptBackup(pendingRestore.encrypted, adminPasswordInput));
                  } catch {
                    setPasswordModalError('رمز عبور وارد شده اشتباه است یا فایل خراب است!');
                  }
                  return;
                }

                const backupPass = pendingRestore.payload?.adminPassword;
                const expectedPass = (typeof backupPass === 'string' && backupPass !== '') ? backupPass : (adminPassword || '123');
                if (trimmed !== expectedPass) {
                  setPasswordModalError('رمز عبور وارد شده اشتباه است!');
                  return;
                }

                finishRestore(pendingRestore.payload);
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200 block">
                  رمز عبور مدیر:
                </label>
                <div className="relative">
                  <input
                    type="password"
                    autoFocus
                    value={adminPasswordInput}
                    onChange={(e) => {
                      setAdminPasswordInput(e.target.value);
                      setPasswordModalError('');
                    }}
                    placeholder="رمز مدیریت سیستم مبدأ بکاپ..."
                    className="w-full text-center text-sm font-mono px-4 py-2.5 bg-surface-151921 border border-blue-500/30 focus:border-blue-400 rounded-xl text-white outline-none placeholder-slate-500 transition-all shadow-inner"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {passwordModalError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordModalError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPendingRestore(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="flex-1 h-10 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold text-xs transition-all cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-950/50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>تایید و جایگذاری دیتابیس</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Restoring Backup to Live Cashier/Reports */}
      {backupToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface-151921 border border-indigo-500/30 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 text-right" dir="rtl">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-black text-white">بازنشانی اطلاعات به صندوق زنده</h3>
                <p className="text-[11px] text-slate-400">انتقال سوابق این روز کاری به بخش صندوق و گزارشات زنده</p>
              </div>
            </div>

            <div className="p-3.5 bg-surface-0b0e14 border border-white/5 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">روز کاری منتخب:</span>
                <span className="font-bold text-indigo-400 font-sans">
                  {backupToRestore.workingDatePersian || formatDatePersian(backupToRestore.closedAt)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">مجموع درآمد این روز:</span>
                <span className="font-bold font-mono text-emerald-400">
                  {formatCurrency(backupToRestore.totalGrossRevenue)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">تعداد فاکتورها و لاگ‌ها:</span>
                <span className="font-mono text-slate-200">
                  {toPersianDigits(backupToRestore.history.length)} گیم‌پلی • {toPersianDigits(backupToRestore.directSales.length)} بوفه • {toPersianDigits(backupToRestore.systemLogs?.length || 0)} لاگ
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              با تایید، کلیه فاکتورها، فروش‌های بوفه و لاگ‌های ثبت‌شده در این روز، به عنوان اطلاعات جاری صندوق و گزارشات سیستم بارگذاری می‌شوند.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setBackupToRestore(null)}
                className="flex-1 h-10 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onRestoreBackupToCurrent) {
                    onRestoreBackupToCurrent(backupToRestore);
                  }
                  setRestoreSuccessMessage(`اطلاعات روز کاری ${backupToRestore.workingDatePersian || ''} با موفقیت به صندوق و گزارشات زنده بازنشانی شد.`);
                  setBackupToRestore(null);
                }}
                className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-950/50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تایید و بازنشانی</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Restore Success Toast / Banner */}
      {restoreSuccessMessage && (
        <div className="fixed bottom-6 right-6 left-6 sm:left-auto sm:max-w-md z-50 p-4 bg-emerald-950/90 border border-emerald-500/30 rounded-2xl shadow-2xl backdrop-blur-md flex items-start gap-3 text-right animate-in slide-in-from-bottom-5 duration-300" dir="rtl">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="flex-1 space-y-1 text-xs">
            <h4 className="font-bold text-emerald-300">بازنشانی موفقیت‌آمیز</h4>
            <p className="text-[11px] text-slate-200">{restoreSuccessMessage}</p>
            {onNavigateToReports && (
              <button
                type="button"
                onClick={() => {
                  setRestoreSuccessMessage(null);
                  onNavigateToReports();
                }}
                className="mt-2 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>مشاهده در تب گزارشات و صندوق</span>
                <ChevronRight className="w-3 h-3 rotate-180" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setRestoreSuccessMessage(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Custom Confirmation Modal for Deleting Backup (Replaces window.confirm) */}
      {backupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface-151921 border border-rose-500/30 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 text-right" dir="rtl">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-black text-white">حذف دائمی نسخه پشتیبان</h3>
                <p className="text-[11px] text-slate-400">این عملیات غیرقابل بازگشت است</p>
              </div>
            </div>

            <div className="p-3.5 bg-surface-0b0e14 border border-white/5 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">روز کاری:</span>
                <span className="font-bold text-rose-400 font-sans">
                  {backupToDelete.workingDatePersian || formatDatePersian(backupToDelete.closedAt)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">درآمد ثبت‌شده:</span>
                <span className="font-bold font-mono text-emerald-400">
                  {formatCurrency(backupToDelete.totalGrossRevenue)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">تعداد فاکتورها:</span>
                <span className="font-mono">
                  {toPersianDigits(backupToDelete.history.length)} نوبت گیم‌پلی • {toPersianDigits(backupToDelete.directSales.length)} بوفه
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              آیا از حذف دائمی این رکورد از تاریخچه بکاپ‌های ذخیره‌شده اطمینان دارید؟
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setBackupToDelete(null)}
                className="flex-1 h-10 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteBackup) {
                    onDeleteBackup(backupToDelete.id);
                  }
                  if (selectedBackupId === backupToDelete.id) {
                    setSelectedBackupId(null);
                  }
                  setBackupToDelete(null);
                }}
                className="flex-1 h-10 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-rose-950/50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>بله، حذف قطعی</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Reusable Printable Invoice Modal for Archived Database Records */}
      <InvoiceReceiptModal
        isOpen={selectedInvoiceForModal !== null}
        onClose={() => setSelectedInvoiceForModal(null)}
        invoice={selectedInvoiceForModal}
        clubName="کلوب و گیم‌نت مجهز"
      />

    </div>
  );
}
