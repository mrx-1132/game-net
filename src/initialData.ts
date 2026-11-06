import { RatesTable, System, BuffetItem, DebtCustomer, SessionHistory, CardReader, ExtraServicePreset } from './types';

export const DEFAULT_RATES: RatesTable = {
  PS5: {
    hourlyRate1P: 60000,  // Single player (تومان)
    hourlyRate2P: 80000,  // Two players 
    hourlyRate3P: 100000, // Three players
    hourlyRate4P: 120000  // Four players
  },
  PS4: {
    hourlyRate1P: 40000,
    hourlyRate2P: 55000,
    hourlyRate3P: 70000,
    hourlyRate4P: 85000
  },
  PS4_VIP: {
    hourlyRate1P: 50000,
    hourlyRate2P: 70000,  // Lan / Co-op on same console or extra seat
    hourlyRate3P: 85000,
    hourlyRate4P: 100000
  },
  PC: {
    hourlyRate1P: 45000,  // Hourly rate for 1 PC user / controller
    hourlyRate2P: 60000,  // Two players co-op/seat
    hourlyRate3P: 75000,
    hourlyRate4P: 90000
  }
};

export const DEFAULT_SYSTEMS: System[] = [
  { id: 'sys-1', name: 'سیستم 1 (PS5 VIP)', type: 'PS5', status: 'free' },
  { id: 'sys-2', name: 'سیستم 2 (PS5 Standard)', type: 'PS5', status: 'free' },
  { id: 'sys-3', name: 'سیستم 3 (PS4 Pro)', type: 'PS4', status: 'free' },
  { id: 'sys-4', name: 'سیستم 4 (PS4 Slim)', type: 'PS4', status: 'free' },
  { id: 'sys-5', name: 'سیستم 5 (PS4 Standard)', type: 'PS4', status: 'free' },
  { id: 'sys-6', name: 'سیستم 6 (PS4 VIP)', type: 'PS4_VIP', status: 'free' },
];

export const DEFAULT_BUFFET: BuffetItem[] = [
  { id: 'b-1', name: 'نوشابه انرژی‌زا هایپ', price: 65000, cost: 45000, stock: 24, category: 'fridge' },
  { id: 'b-2', name: 'چیپس بزرگ چی‌توز', price: 35000, cost: 22000, stock: 15, category: 'snack' },
  { id: 'b-3', name: 'رانی هلو', price: 25000, cost: 17000, stock: 30, category: 'fridge' },
  { id: 'b-4', name: 'نوشابه قوطی کوکا', price: 20000, cost: 13000, stock: 40, category: 'fridge' },
  { id: 'b-5', name: 'آب معدنی کوچک', price: 8000, cost: 4000, stock: 50, category: 'fridge' },
  { id: 'b-6', name: 'کیک شکلاتی نظری', price: 15000, cost: 9500, stock: 12, category: 'snack' },
  { id: 'b-7', name: 'نسکافه داغ تک‌نفره', price: 30000, cost: 15000, stock: 25, category: 'cafe' },
  { id: 'b-8', name: 'قهوه اسپرسو دبل', price: 35000, cost: 12000, stock: 20, category: 'cafe' },
];

export const DEFAULT_DEBTORS: DebtCustomer[] = [
  {
    id: 'debt-1',
    name: 'سپهر محمدی',
    phone: '09123456789',
    balance: 75000,
    totalPlayTimeMinutes: 3000, // 50 hours of gameplay
    transactions: [
      {
        id: 'tx-1_1',
        type: 'debt_added',
        amount: 75000,
        date: new Date(Date.now() - 48 * 3600000).toISOString(),
        description: 'باقیمانده حساب بازی با سیستم 2 (PS5)'
      }
    ]
  },
  {
    id: 'debt-2',
    name: 'آرمان رضایی',
    phone: '09359876543',
    balance: 120000,
    transactions: [
      {
        id: 'tx-2_1',
        type: 'debt_added',
        amount: 150000,
        date: new Date(Date.now() - 24 * 3600000).toISOString(),
        description: 'سیستم 3 و خرید انرژی‌زا و چیپس'
      },
      {
        id: 'tx-2_2',
        type: 'payment_made',
        amount: 30000,
        date: new Date(Date.now() - 12 * 3600000).toISOString(),
        description: 'پرداختی علی‌الحساب نقدی'
      }
    ]
  }
];

export const DEFAULT_HISTORY: SessionHistory[] = [
  {
    id: 'h-1',
    systemId: 'sys-3',
    systemName: 'سیستم 3 (PS4 Pro)',
    systemType: 'PS4',
    customerName: 'کامران امیری',
    startTime: new Date(Date.now() - 5 * 3600000).toISOString(),
    endTime: new Date(Date.now() - 3.5 * 3600000).toISOString(),
    durationMinutes: 90,
    playersCount: 2,
    hourlyRateUsed: 55000,
    gamePlayCost: 82500,
    buffetCost: 45000, // کیک + رانی
    totalCost: 127500,
    paymentMethod: 'card'
  },
  {
    id: 'h-2',
    systemId: 'sys-1',
    systemName: 'سیستم 1 (PS5 VIP)',
    systemType: 'PS5',
    customerName: 'سپهر محمدی',
    startTime: new Date(Date.now() - 2.5 * 3600000).toISOString(),
    endTime: new Date(Date.now() - 1.5 * 3600000).toISOString(),
    durationMinutes: 60,
    playersCount: 1,
    hourlyRateUsed: 60000,
    gamePlayCost: 60000,
    buffetCost: 15000, // کیک
    totalCost: 75000,
    paymentMethod: 'debt',
    debtCustomerId: 'debt-1'
  },
  {
    id: 'h-3',
    systemId: 'sys-6',
    systemName: 'سیستم 6 (PS4 VIP)',
    systemType: 'PS4_VIP',
    customerName: 'رضا علوی',
    startTime: new Date(Date.now() - 8 * 3600000).toISOString(),
    endTime: new Date(Date.now() - 5 * 3600000).toISOString(),
    durationMinutes: 180,
    playersCount: 1,
    hourlyRateUsed: 50000,
    gamePlayCost: 150000,
    buffetCost: 65000, // انرژی‌زا هایپ
    totalCost: 215000,
    paymentMethod: 'cash'
  }
];

export const DEFAULT_CARD_READERS: CardReader[] = [
  { id: 'pos-1', name: 'کارتخوان بانک سامان' },
  { id: 'pos-2', name: 'کارتخوان بانک ملی' },
];

export const DEFAULT_EXTRA_SERVICE_PRESETS: ExtraServicePreset[] = [
  {
    id: 'srv-controller',
    name: 'کرایه دسته اضافی',
    price: 15000,
    description: 'استفاده از کنترلر اضافه فراتر از تعداد پیش‌فرض',
    category: 'equipment'
  },
  {
    id: 'srv-headset',
    name: 'کرایه هدفون حرفه‌ای',
    price: 10000,
    description: 'هدست گیمینگ با وضوح بالا و صدای فراگیر',
    category: 'equipment'
  },
  {
    id: 'srv-steering-wheel',
    name: 'شبیه‌ساز فرمان و پدال بازی',
    price: 30000,
    description: 'کرایه کیت فرمان جهت بازی‌های مسابقه‌ای و رانندگی',
    category: 'equipment'
  },
  {
    id: 'srv-damage-controller',
    name: 'خسارت انداختن دسته بازی',
    price: 50000,
    description: 'جریمه سقوط یا ضربه خوردن دسته بازی (طبق قوانین کلوب)',
    category: 'damage'
  },
  {
    id: 'srv-damage-headset',
    name: 'خسارت کشیدگی سیم هدفون',
    price: 30000,
    description: 'خسارت یا قطع و وصلی کابل هدفون به دلیل کشیدگی',
    category: 'damage'
  },
  {
    id: 'srv-vip-room',
    name: 'سرویس ویژه اتاق VIP',
    price: 25000,
    description: 'هزینه شارژ ویژه استفاده از خدمات متمایز اتاق اختصاصی',
    category: 'vip'
  },
];
