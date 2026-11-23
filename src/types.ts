export type SystemType = string;
export type SystemStatus = 'free' | 'active' | 'inactive';

export interface RateConfig {
  hourlyRate1P: number; // Single controller cost
  hourlyRate2P: number; // Double controller cost
  hourlyRate3P: number; // 3 Controllers cost
  hourlyRate4P: number; // 4 Controllers cost
}

export interface RatesTable {
  [customType: string]: RateConfig;
}

export interface SessionBuffetItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  priority?: number; // sorting priority copied from the catalog item (higher first)
}

export interface PlayerCountHistoryItem {
  playersCount: 1 | 2 | 3 | 4;
  startTime: string; // ISO string
  endTime: string; // ISO string
  elapsedMs: number;
  hourlyRateUsed: number;
  cost: number;
}

export interface PartialPayment {
  id: string;
  amount: number;
  paymentMethod: 'cash' | 'card';
  cardReaderId?: string;
  cardReaderName?: string;
  date: string; // ISO string
  note?: string; // e.g. "سهم علی (خروج از بازی)"
}

export interface ActiveSession {
  customerName: string;
  customerPhone?: string;
  startTime: string; // ISO string
  pausedTime?: string; // ISO string (if currently paused)
  totalPausedMs: number;
  lastResumeTime: string; // ISO string (last time it was unpaused/started)
  playersCount: 1 | 2 | 3 | 4;
  buffetItems: SessionBuffetItem[];
  previousGamePlayCost?: number; // Total cost of earlier finished segments
  previousDurationMinutes?: number; // Total minutes played on previous systems
  previousElapsedMs?: number; // Total elapsed ms played on previous systems
  lastPlayersCountChangeElapsedTimeMs?: number; // Total elapsed active time at last change
  playersCountHistory?: PlayerCountHistoryItem[]; // Detailed record of segments
  playerCountChanges?: { playersCount: 1 | 2 | 3 | 4; atElapsedMs: number }[];
  customTimerLimitType?: 'none' | 'time' | 'amount';
  customTimerValue?: number; // target minutes if 'time', or target amount if 'amount'
  customTimerNotified?: boolean; // track if chime played & notification triggered
  extraServices?: SessionBuffetItem[];
  isPowerOutagePaused?: boolean;
  powerOutageTime?: string;
  autoPausedForSettle?: boolean;
  partialPayments?: PartialPayment[];
}

export interface System {
  id: string;
  name: string;
  type: SystemType;
  status: SystemStatus;
  activeSession?: ActiveSession;
  note?: string;
}

export interface BuffetItem {
  id: string;
  name: string;
  price: number;
  cost?: number; // purchasing cost (for margin calculations)
  stock?: number; // current inventory amount (optional)
  category?: 'fridge' | 'cafe' | 'snack';
  priority?: number; // sorting priority (higher first)
}

export type TransactionType = 'debt_added' | 'payment_made';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string; // ISO string
  description: string;
  playMinutes?: number; // Play time (minutes) this invoice adds to the debtor's total play time
}

export interface DebtCustomer {
  id: string;
  name: string;
  phone: string;
  balance: number; // How much they owe (positive value)
  transactions: Transaction[];
  totalPlayTimeMinutes?: number; // Total played time in minutes (or manual custom override)
}

export interface CardReader {
  id: string;
  name: string;
}

export interface ExtraServicePreset {
  id: string;
  name: string;
  price: number;
  description: string;
  category: 'equipment' | 'damage' | 'vip';
}

export interface SessionHistory {
  id: string;
  systemId: string;
  systemName: string;
  systemType: SystemType;
  customerName: string;
  customerPhone?: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  playersCount: number;
  hourlyRateUsed: number;
  gamePlayCost: number;
  buffetCost: number;
  buffetItems?: SessionBuffetItem[];
  extraServicesCost?: number;
  extraServices?: SessionBuffetItem[];
  totalCost: number;
  paymentMethod: 'cash' | 'card' | 'debt' | 'mixed';
  debtCustomerId?: string;
  cashPaidAmount?: number;
  cardPaidAmount?: number;
  debtAmount?: number;
  debtDetails?: { debtorId?: string; name: string; phone?: string; amount: number }[];
  cardReaderId?: string;
  cardReaderName?: string;
  partialPayments?: PartialPayment[];
  notes?: string;
  roundingOffset?: number;
}

export interface DirectBuffetSale {
  id: string;
  date: string;
  customerName: string;
  totalCost: number;
  items: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  paymentMethod?: 'cash' | 'card' | 'debt' | 'mixed';
  debtCustomerId?: string;
  cashPaidAmount?: number;
  cardPaidAmount?: number;
  debtAmount?: number;
  cardReaderId?: string;
  cardReaderName?: string;
}

export interface DailyWorkingDayBackup {
  id: string; // unique ID
  dateISO: string; // timestamp when closed
  workingDatePersian: string; // Persian date name (e.g. "۱۴۰۲/۰۷/۱۵")
  closedAt: string; // ISO string when ended
  notes?: string;
  closedBy: 'admin' | 'user';
  
  // Financial stats on close
  totalGameplayRevenue: number;
  totalSessionBuffetCost: number;
  totalDirectBuffetSales: number;
  totalGrossRevenue: number;
  paidCardAmount: number;
  paidCashAmount: number;
  debtAccumulatedAmount: number;
  
  // Saved logs for this specific day
  history: SessionHistory[];
  directSales: DirectBuffetSale[];
  systemLogs?: SystemLog[];
}

export interface UserPermissions {
  buffet: boolean;
  debt: boolean;
  reports: boolean;
  backups: boolean;
  settings: boolean;
  closeWorkingDay?: boolean;
  allowUserEdits?: boolean;
}

export interface Operator {
  id: string;
  name: string;
  username: string;
  password?: string;
  permissions: UserPermissions;
  isActive: boolean;
  createdAt?: string;
}

export interface SystemLog {
  id: string;
  timestamp: string; // ISO string
  type: 'session_start' | 'session_pause' | 'session_resume' | 'session_settle' | 'buffet' | 'debt' | 'system' | 'power';
  message: string;
  systemName?: string;
  details?: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  apiEndpoint?: string;
}

