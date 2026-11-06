import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Trophy, 
  Gamepad2, 
  Wrench, 
  Plus, 
  Trash2, 
  Check, 
  Clock, 
  Search, 
  User, 
  Phone, 
  Coins, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  ChevronLeft,
  X,
  FileText
} from 'lucide-react';
import { formatCurrency, formatDatePersian } from '../utils';

// Interfaces for our Special Services
interface VIPReservation {
  id: string;
  customerName: string;
  customerPhone: string;
  systemName: string;
  reserveTime: string; // Persian date & time string
  depositAmount: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
}

interface Tournament {
  id: string;
  title: string;
  gameName: string;
  entryFee: number;
  prizePool: string;
  startDate: string;
  maxParticipants: number;
  participants: {
    id: string;
    name: string;
    phone: string;
    paid: boolean;
    registeredAt: string;
  }[];
  status: 'upcoming' | 'ongoing' | 'finished';
}

interface RentalAccount {
  id: string;
  title: string; // e.g. "Steam VIP Account - Red Dead 2 & GTA V"
  platform: 'Steam' | 'PlayStation' | 'Xbox' | 'EA / Ubisoft';
  gamesList: string;
  dailyRate: number;
  status: 'available' | 'rented';
  currentRenterName?: string;
  currentRenterPhone?: string;
  rentedAt?: string;
  returnDueTime?: string;
}

interface RepairJob {
  id: string;
  customerName: string;
  customerPhone: string;
  deviceType: 'PS5 Controller' | 'PS4 Controller' | 'Xbox Controller' | 'Console' | 'Other';
  serialNumber?: string;
  issueDescription: string;
  estimatedCost: number;
  depositPaid: number;
  status: 'pending' | 'in_repair' | 'ready' | 'delivered';
  notes?: string;
  createdAt: string;
}

export default function SpecialServicesTab() {
  const [activeSubTab, setActiveSubTab] = useState<'reservations' | 'tournaments' | 'rentals' | 'repairs'>('reservations');
  const [searchQuery, setSearchQuery] = useState('');

  // Local states with LocalStorage persistence
  const [reservations, setReservations] = useState<VIPReservation[]>(() => {
    try {
      const saved = localStorage.getItem('gamenet_services_reservations');
      if (saved && saved !== 'undefined' && saved !== 'null') {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse gamenet_services_reservations', e);
    }
    return [
      {
        id: 'res-1',
        customerName: 'رضا یوسفی',
        customerPhone: '09123456789',
        systemName: 'کنسول PS5 VIP - اتاق ۱',
        reserveTime: 'امروز ساعت ۱۸:۳۰',
        depositAmount: 50000,
        status: 'pending',
        notes: 'دسته اضافی هم رزرو شود',
        createdAt: new Date().toISOString()
      },
      {
        id: 'res-2',
        customerName: 'پوریا محمدی',
        customerPhone: '09129876543',
        systemName: 'سیستم گیمینگ PC 1',
        reserveTime: 'فردا ساعت ۱۵:۰۰',
        depositAmount: 30000,
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    ];
  });

  const [tournaments, setTournaments] = useState<Tournament[]>(() => {
    try {
      const saved = localStorage.getItem('gamenet_services_tournaments');
      if (saved && saved !== 'undefined' && saved !== 'null') {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse gamenet_services_tournaments', e);
    }
    return [
      {
        id: 'tour-1',
        title: 'جام هفتگی FIFA 24 پی‌اس‌فایو',
        gameName: 'FC 24 (PS5)',
        entryFee: 100000,
        prizePool: '۳,۰۰۰,۰۰۰ تومان وجه نقد + ۲ ساعت بازی رایگان',
        startDate: '۱۴۰۵/۰۴/۲۵',
        maxParticipants: 16,
        status: 'upcoming',
        participants: [
          { id: 'p-1', name: 'علی حسینی', phone: '09121112233', paid: true, registeredAt: new Date().toISOString() },
          { id: 'p-2', name: 'سامان کریمی', phone: '09124445566', paid: false, registeredAt: new Date().toISOString() }
        ]
      }
    ];
  });

  const [rentals, setRentals] = useState<RentalAccount[]>(() => {
    try {
      const saved = localStorage.getItem('gamenet_services_rentals');
      if (saved && saved !== 'undefined' && saved !== 'null') {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse gamenet_services_rentals', e);
    }
    return [
      {
        id: 'rent-1',
        title: 'اکانت اشتراکی استیم VIP شماره ۱',
        platform: 'Steam',
        gamesList: 'Counter-Strike 2 Prime, Red Dead Redemption 2, Hogwarts Legacy',
        dailyRate: 40000,
        status: 'available'
      },
      {
        id: 'rent-2',
        title: 'اکانت پلی استیشن پلاس اکسترا ۳ ماهه',
        platform: 'PlayStation',
        gamesList: 'PS Plus Extra 300+ Games Access',
        dailyRate: 50000,
        status: 'rented',
        currentRenterName: 'امید عزیزی',
        currentRenterPhone: '09307778899',
        rentedAt: '۱۴۰۵/۰۴/۲۰',
        returnDueTime: '۱۴۰۵/۰۴/۲۳'
      }
    ];
  });

  const [repairs, setRepairs] = useState<RepairJob[]>(() => {
    try {
      const saved = localStorage.getItem('gamenet_services_repairs');
      if (saved && saved !== 'undefined' && saved !== 'null') {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse gamenet_services_repairs', e);
    }
    return [
      {
        id: 'rep-1',
        customerName: 'سپهر راد',
        customerPhone: '09192223344',
        deviceType: 'PS5 Controller',
        serialNumber: 'G1109923C4',
        issueDescription: 'آنالوگ سمت چپ دریفت شدید دارد و دکمه R2 گیر می‌کند',
        estimatedCost: 180000,
        depositPaid: 50000,
        status: 'in_repair',
        notes: 'مشتری تاکید کرد تا آخر هفته تحویل داده شود',
        createdAt: new Date().toISOString()
      },
      {
        id: 'rep-2',
        customerName: 'عرفان شریفی',
        customerPhone: '09351234567',
        deviceType: 'Xbox Controller',
        issueDescription: 'سوکت شارژ تایپ سی کار نمیکند و نیاز به تعویض دارد',
        estimatedCost: 250000,
        depositPaid: 0,
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    ];
  });

  // Persist states to local storage on change
  useEffect(() => {
    localStorage.setItem('gamenet_services_reservations', JSON.stringify(reservations));
  }, [reservations]);

  useEffect(() => {
    localStorage.setItem('gamenet_services_tournaments', JSON.stringify(tournaments));
  }, [tournaments]);

  useEffect(() => {
    localStorage.setItem('gamenet_services_rentals', JSON.stringify(rentals));
  }, [rentals]);

  useEffect(() => {
    localStorage.setItem('gamenet_services_repairs', JSON.stringify(repairs));
  }, [repairs]);

  // Modals / Form states
  const [showResModal, setShowResModal] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [showRentOutModal, setShowRentOutModal] = useState<RentalAccount | null>(null);
  const [showRegPlayerModal, setShowRegPlayerModal] = useState<Tournament | null>(null);

  // New Reservation Form state
  const [newRes, setNewRes] = useState({
    customerName: '',
    customerPhone: '',
    systemName: '',
    reserveTime: '',
    depositAmount: '',
    notes: ''
  });

  // New Tournament Form state
  const [newTour, setNewTour] = useState({
    title: '',
    gameName: '',
    entryFee: '',
    prizePool: '',
    startDate: '',
    maxParticipants: '16'
  });

  // New Rental Form state
  const [newRental, setNewRental] = useState({
    title: '',
    platform: 'Steam' as any,
    gamesList: '',
    dailyRate: ''
  });

  // New Repair Form state
  const [newRepair, setNewRepair] = useState({
    customerName: '',
    customerPhone: '',
    deviceType: 'PS5 Controller' as any,
    serialNumber: '',
    issueDescription: '',
    estimatedCost: '',
    depositPaid: '',
    notes: ''
  });

  // Rent out action form state
  const [rentOutData, setRentOutData] = useState({
    renterName: '',
    renterPhone: '',
    returnDueTime: ''
  });

  // Tournament Player Registration form state
  const [regPlayerData, setRegPlayerData] = useState({
    name: '',
    phone: '',
    paid: false
  });

  // HANDLERS
  const handleAddReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRes.customerName || !newRes.systemName || !newRes.reserveTime) return;

    const res: VIPReservation = {
      id: `res-${Date.now()}`,
      customerName: newRes.customerName,
      customerPhone: newRes.customerPhone,
      systemName: newRes.systemName,
      reserveTime: newRes.reserveTime,
      depositAmount: Number(newRes.depositAmount) || 0,
      notes: newRes.notes,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    setReservations([res, ...reservations]);
    setShowResModal(false);
    setNewRes({ customerName: '', customerPhone: '', systemName: '', reserveTime: '', depositAmount: '', notes: '' });
  };

  const handleDeleteReservation = (id: string) => {
    if (confirm('آیا از حذف این رزرو مطمئن هستید؟')) {
      setReservations(reservations.filter(r => r.id !== id));
    }
  };

  const handleUpdateReservationStatus = (id: string, status: VIPReservation['status']) => {
    setReservations(reservations.map(r => r.id === id ? { ...r, status } : r));
  };

  // Tournament handlers
  const handleAddTournament = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTour.title || !newTour.gameName) return;

    const tour: Tournament = {
      id: `tour-${Date.now()}`,
      title: newTour.title,
      gameName: newTour.gameName,
      entryFee: Number(newTour.entryFee) || 0,
      prizePool: newTour.prizePool,
      startDate: newTour.startDate || formatDatePersian(new Date().toISOString()),
      maxParticipants: Number(newTour.maxParticipants) || 16,
      status: 'upcoming',
      participants: []
    };

    setTournaments([tour, ...tournaments]);
    setShowTourModal(false);
    setNewTour({ title: '', gameName: '', entryFee: '', prizePool: '', startDate: '', maxParticipants: '16' });
  };

  const handleRegisterPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRegPlayerModal || !regPlayerData.name) return;

    const updated = tournaments.map(t => {
      if (t.id === showRegPlayerModal.id) {
        return {
          ...t,
          participants: [
            ...t.participants,
            {
              id: `p-${Date.now()}`,
              name: regPlayerData.name,
              phone: regPlayerData.phone,
              paid: regPlayerData.paid,
              registeredAt: new Date().toISOString()
            }
          ]
        };
      }
      return t;
    });

    setTournaments(updated);
    setShowRegPlayerModal(null);
    setRegPlayerData({ name: '', phone: '', paid: false });
  };

  const handleToggleParticipantPaid = (tourId: string, partId: string) => {
    setTournaments(tournaments.map(t => {
      if (t.id === tourId) {
        return {
          ...t,
          participants: t.participants.map(p => p.id === partId ? { ...p, paid: !p.paid } : p)
        };
      }
      return t;
    }));
  };

  const handleDeleteParticipant = (tourId: string, partId: string) => {
    if (confirm('آیا از حذف این شرکت‌کننده مطمئن هستید؟')) {
      setTournaments(tournaments.map(t => {
        if (t.id === tourId) {
          return {
            ...t,
            participants: t.participants.filter(p => p.id !== partId)
          };
        }
        return t;
      }));
    }
  };

  const handleDeleteTournament = (id: string) => {
    if (confirm('آیا کل اطلاعات این مسابقه حذف شود؟')) {
      setTournaments(tournaments.filter(t => t.id !== id));
    }
  };

  const handleUpdateTournamentStatus = (id: string, status: Tournament['status']) => {
    setTournaments(tournaments.map(t => t.id === id ? { ...t, status } : t));
  };

  // Rentals handlers
  const handleAddRental = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRental.title) return;

    const rent: RentalAccount = {
      id: `rent-${Date.now()}`,
      title: newRental.title,
      platform: newRental.platform,
      gamesList: newRental.gamesList,
      dailyRate: Number(newRental.dailyRate) || 0,
      status: 'available'
    };

    setRentals([rent, ...rentals]);
    setShowRentalModal(false);
    setNewRental({ title: '', platform: 'Steam', gamesList: '', dailyRate: '' });
  };

  const handleRentOut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRentOutModal || !rentOutData.renterName) return;

    setRentals(rentals.map(r => {
      if (r.id === showRentOutModal.id) {
        return {
          ...r,
          status: 'rented',
          currentRenterName: rentOutData.renterName,
          currentRenterPhone: rentOutData.renterPhone,
          rentedAt: formatDatePersian(new Date().toISOString()),
          returnDueTime: rentOutData.returnDueTime
        };
      }
      return r;
    }));

    setShowRentOutModal(null);
    setRentOutData({ renterName: '', renterPhone: '', returnDueTime: '' });
  };

  const handleReturnRental = (id: string) => {
    setRentals(rentals.map(r => {
      if (r.id === id) {
        return {
          ...r,
          status: 'available',
          currentRenterName: undefined,
          currentRenterPhone: undefined,
          rentedAt: undefined,
          returnDueTime: undefined
        };
      }
      return r;
    }));
  };

  const handleDeleteRental = (id: string) => {
    if (confirm('آیا این آیتم اجاره‌ای کلاً حذف شود؟')) {
      setRentals(rentals.filter(r => r.id !== id));
    }
  };

  // Repairs handlers
  const handleAddRepair = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepair.customerName || !newRepair.issueDescription) return;

    const rep: RepairJob = {
      id: `rep-${Date.now()}`,
      customerName: newRepair.customerName,
      customerPhone: newRepair.customerPhone,
      deviceType: newRepair.deviceType,
      serialNumber: newRepair.serialNumber,
      issueDescription: newRepair.issueDescription,
      estimatedCost: Number(newRepair.estimatedCost) || 0,
      depositPaid: Number(newRepair.depositPaid) || 0,
      notes: newRepair.notes,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    setRepairs([rep, ...repairs]);
    setShowRepairModal(false);
    setNewRepair({ customerName: '', customerPhone: '', deviceType: 'PS5 Controller', serialNumber: '', issueDescription: '', estimatedCost: '', depositPaid: '', notes: '' });
  };

  const handleUpdateRepairStatus = (id: string, status: RepairJob['status']) => {
    setRepairs(repairs.map(r => r.id === id ? { ...r, status } : r));
  };

  const handleDeleteRepair = (id: string) => {
    if (confirm('آیا این رکورد تعمیرات حذف شود؟')) {
      setRepairs(repairs.filter(r => r.id !== id));
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* Top Welcome Title & Subtabs Menu */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-0f1219/40 border border-white/5 rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <h2 className="text-base sm:text-lg font-black text-white">پنل خدمات ویژه و درآمدزایی گیم‌نت</h2>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">مدیریت رزرو نوبت‌ها، برگزاری تورنمنت‌ها، اجاره اکانت بازی و سرویس سخت‌افزار مشتریان</p>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-black/25 p-1 border border-white/5 rounded-xl self-start md:self-auto overflow-x-auto w-full md:w-auto scrollbar-none">
          <button
            onClick={() => { setActiveSubTab('reservations'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'reservations'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>رزرو نوبت VIP</span>
          </button>
          <button
            onClick={() => { setActiveSubTab('tournaments'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'tournaments'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>مسابقات و لیگ‌ها</span>
          </button>
          <button
            onClick={() => { setActiveSubTab('rentals'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'rentals'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>اجاره اکانت بازی</span>
          </button>
          <button
            onClick={() => { setActiveSubTab('repairs'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'repairs'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>تعمیرات و سرویس</span>
          </button>
        </div>
      </div>

      {/* Control Actions & Search bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-0b0e14/40 border border-white/5 rounded-2xl p-4">
        
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder={
              activeSubTab === 'reservations' ? "جستجوی نام مشتری یا سیستم..." :
              activeSubTab === 'tournaments' ? "جستجوی نام مسابقه..." :
              activeSubTab === 'rentals' ? "جستجوی اکانت یا مستاجر..." :
              "جستجوی مشتری یا مدل دسته..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-9 py-2 bg-surface-06080c border border-white/5 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-sans"
          />
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
        </div>

        {/* Primary Action Button */}
        <div>
          {activeSubTab === 'reservations' && (
            <button
              onClick={() => setShowResModal(true)}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/20"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت رزرو نوبت جدید</span>
            </button>
          )}
          {activeSubTab === 'tournaments' && (
            <button
              onClick={() => setShowTourModal(true)}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/20"
            >
              <Plus className="w-4 h-4" />
              <span>ایجاد مسابقه جدید</span>
            </button>
          )}
          {activeSubTab === 'rentals' && (
            <button
              onClick={() => setShowRentalModal(true)}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/20"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن اکانت به لیست اجاره</span>
            </button>
          )}
          {activeSubTab === 'repairs' && (
            <button
              onClick={() => setShowRepairModal(true)}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/20"
            >
              <Plus className="w-4 h-4" />
              <span>پذیرش دستگاه تعمیراتی جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Lists Grid */}
      <div className="min-h-[400px]">
        
        {/* TAB 1: VIP RESERVATIONS */}
        {activeSubTab === 'reservations' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reservations
              .filter(r => r.customerName.includes(searchQuery) || r.systemName.includes(searchQuery))
              .map((res) => (
                <div 
                  key={res.id} 
                  className={`bg-surface-0f1219/50 border rounded-2xl p-5 space-y-4 transition-all relative overflow-hidden ${
                    res.status === 'active' ? 'border-emerald-500/30 shadow-lg shadow-emerald-950/5' :
                    res.status === 'cancelled' ? 'border-white/5 opacity-50' :
                    res.status === 'completed' ? 'border-blue-500/20 bg-surface-0f1219/25' :
                    'border-white/5 hover:border-white/10'
                  }`}
                >
                  {/* Top Header Card */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black text-white leading-none">{res.customerName}</h3>
                      {res.customerPhone && (
                        <p className="text-[10px] text-zinc-500 font-mono tracking-wider">{res.customerPhone}</p>
                      )}
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-lg font-bold ${
                      res.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15' :
                      res.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 animate-pulse' :
                      res.status === 'completed' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15' :
                      'bg-slate-800 text-slate-500 border border-white/5'
                    }`}>
                      {res.status === 'pending' ? 'در انتظار حضور' :
                       res.status === 'active' ? 'حاضر و مشغول بازی' :
                       res.status === 'completed' ? 'خاتمه یافته' : 'لغو شده'}
                    </span>
                  </div>

                  {/* Body Specs */}
                  <div className="p-3 bg-black/15 border border-white/5 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-450">
                      <span>دستگاه درخواستی:</span>
                      <span className="text-white font-bold">{res.systemName}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-450">
                      <span>زمان هماهنگ شده:</span>
                      <span className="text-indigo-400 font-bold">{res.reserveTime}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-450">
                      <span>مبلغ بیعانه دریافتی:</span>
                      <span className="text-emerald-450 font-bold font-mono">
                        {res.depositAmount > 0 ? `${formatCurrency(res.depositAmount)}` : 'بدون بیعانه'}
                      </span>
                    </div>
                  </div>

                  {res.notes && (
                    <p className="text-[10px] text-zinc-400 bg-black/10 p-2 border border-white/5 rounded-lg font-sans leading-relaxed">
                      📝 <span className="font-bold">یادداشت:</span> {res.notes}
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex gap-1">
                      {res.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUpdateReservationStatus(res.id, 'active')}
                            className="px-2.5 py-1 bg-emerald-600/15 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg border border-emerald-500/20 text-[10px] font-bold transition-all cursor-pointer"
                          >
                            حضور و شروع بازی
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateReservationStatus(res.id, 'cancelled')}
                            className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg border border-rose-500/15 text-[10px] font-bold transition-all cursor-pointer"
                          >
                            لغو نوبت
                          </button>
                        </>
                      )}
                      {res.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateReservationStatus(res.id, 'completed')}
                          className="px-2.5 py-1 bg-blue-600/15 hover:bg-blue-600 text-blue-450 hover:text-white rounded-lg border border-blue-500/20 text-[10px] font-bold transition-all cursor-pointer"
                        >
                          پایان رزرو
                        </button>
                      )}
                      {(res.status === 'cancelled' || res.status === 'completed') && (
                        <button
                          type="button"
                          onClick={() => handleUpdateReservationStatus(res.id, 'pending')}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                        >
                          بازگرداندن به انتظار
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteReservation(res.id)}
                      className="p-1.5 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                      title="حذف کلی رزرو"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

            {reservations.length === 0 && (
              <div className="col-span-full py-12 text-center text-zinc-500 bg-surface-0f1219/20 border border-dashed border-white/5 rounded-2xl">
                <Calendar className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                <p className="text-xs">هیچ نوبت رزروی ثبت نشده است.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TOURNAMENTS */}
        {activeSubTab === 'tournaments' && (
          <div className="space-y-6">
            {tournaments
              .filter(t => t.title.includes(searchQuery) || t.gameName.includes(searchQuery))
              .map((tour) => (
                <div key={tour.id} className="bg-surface-0f1219/40 border border-white/5 rounded-2xl p-5 space-y-4">
                  {/* Title & Banner Info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-white">{tour.title}</h3>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black ${
                          tour.status === 'upcoming' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15' :
                          tour.status === 'ongoing' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 animate-pulse' :
                          'bg-zinc-800 text-zinc-500 border border-white/5'
                        }`}>
                          {tour.status === 'upcoming' ? 'ثبت‌نام جاری' :
                           tour.status === 'ongoing' ? 'در حال برگزاری' : 'پایان یافته'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-[10px] text-zinc-400 font-sans">
                        <span>بازی اصلی: <strong className="text-indigo-400">{tour.gameName}</strong></span>
                        <span>تاریخ شروع: <strong className="text-amber-400">{tour.startDate}</strong></span>
                        <span>ظرفیت: <strong className="text-white">{tour.participants.length} / {tour.maxParticipants} نفر</strong></span>
                      </div>
                    </div>

                    {/* Status Selectors */}
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <button
                        onClick={() => setShowRegPlayerModal(tour)}
                        disabled={tour.participants.length >= tour.maxParticipants}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-45 disabled:pointer-events-none text-white font-bold rounded-lg text-[10px] cursor-pointer transition-all flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        ثبت شرکت‌کننده جدید
                      </button>

                      <div className="flex bg-black/35 rounded-lg p-0.5 border border-white/5">
                        <button
                          onClick={() => handleUpdateTournamentStatus(tour.id, 'upcoming')}
                          className={`px-2 py-1 text-[9px] font-bold rounded ${tour.status === 'upcoming' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          پیش‌نویس
                        </button>
                        <button
                          onClick={() => handleUpdateTournamentStatus(tour.id, 'ongoing')}
                          className={`px-2 py-1 text-[9px] font-bold rounded ${tour.status === 'ongoing' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          شروع جام
                        </button>
                        <button
                          onClick={() => handleUpdateTournamentStatus(tour.id, 'finished')}
                          className={`px-2 py-1 text-[9px] font-bold rounded ${tour.status === 'finished' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          خاتمه
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteTournament(tour.id)}
                        className="p-1.5 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                        title="حذف کلی مسابقه"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Financial Metrics & Awards Block */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface-0b0e14 border border-white/5 p-4 rounded-xl text-xs">
                    <div>
                      <span className="text-[9px] text-zinc-500 uppercase block">هزینه ثبت نام بازیکن:</span>
                      <strong className="text-white font-mono text-xs">{formatCurrency(tour.entryFee)}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 uppercase block">کل درآمد حاصله:</span>
                      <strong className="text-emerald-400 font-mono text-xs">
                        {formatCurrency(tour.participants.filter(p => p.paid).length * tour.entryFee)}
                        <span className="text-[10px] text-zinc-500 font-sans font-normal mr-1">
                          ({tour.participants.filter(p => p.paid).length} نفر پرداختی)
                        </span>
                      </strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 uppercase block">جوایز نفرات برتر:</span>
                      <strong className="text-amber-400 font-sans text-[11px] font-bold leading-none">{tour.prizePool}</strong>
                    </div>
                  </div>

                  {/* Registered Competitors Sub-table */}
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">لیست بازیکنان ثبت‌نام شده ({tour.participants.length} نفر):</h4>
                    
                    {tour.participants.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {tour.participants.map((player) => (
                          <div key={player.id} className="p-3 bg-black/15 border border-white/5 hover:border-white/10 rounded-xl flex items-center justify-between text-xs gap-3">
                            <div className="space-y-0.5">
                              <span className="text-white font-black block">{player.name}</span>
                              {player.phone && (
                                <span className="text-[9px] text-zinc-500 font-mono block">{player.phone}</span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              {/* Paid toggler */}
                              <button
                                type="button"
                                onClick={() => handleToggleParticipantPaid(tour.id, player.id)}
                                className={`px-2 py-0.5 text-[9px] rounded font-bold transition-all cursor-pointer ${
                                  player.paid 
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/15 hover:bg-rose-500/20'
                                }`}
                              >
                                {player.paid ? 'پرداخت شده' : 'تسویه نشده'}
                              </button>

                              {/* Delete participant */}
                              <button
                                type="button"
                                onClick={() => handleDeleteParticipant(tour.id, player.id)}
                                className="text-zinc-600 hover:text-rose-400 p-0.5 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                                title="حذف بازیکن"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-500 italic bg-surface-0b0e14/30 p-3 rounded-xl border border-dashed border-white/5">
                        تاکنون هیچ شرکت‌کننده‌ای برای این جام ثبت‌نام نکرده است.
                      </p>
                    )}
                  </div>
                </div>
              ))}

            {tournaments.length === 0 && (
              <div className="py-12 text-center text-zinc-500 bg-surface-0f1219/20 border border-dashed border-white/5 rounded-2xl">
                <Trophy className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                <p className="text-xs">هیچ تورنمنتی ایجاد نشده است.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: RENTAL ACCOUNTS */}
        {activeSubTab === 'rentals' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rentals
              .filter(r => r.title.includes(searchQuery) || (r.currentRenterName && r.currentRenterName.includes(searchQuery)))
              .map((account) => (
                <div 
                  key={account.id} 
                  className={`bg-surface-0f1219/50 border rounded-2xl p-5 space-y-4 transition-all relative overflow-hidden ${
                    account.status === 'rented' ? 'border-amber-500/30' : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  {/* Platform Badge */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                        account.platform === 'Steam' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15' :
                        account.platform === 'PlayStation' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15' :
                        account.platform === 'Xbox' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                      }`}>
                        {account.platform}
                      </span>
                      <h3 className="text-sm font-black text-white leading-normal pt-1">{account.title}</h3>
                    </div>
                    
                    <span className={`text-[9px] px-2 py-0.5 rounded-lg font-bold ${
                      account.status === 'available' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' :
                      'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                    }`}>
                      {account.status === 'available' ? 'آماده اجاره' : 'اجاره داده شده'}
                    </span>
                  </div>

                  {/* Games Catalog info */}
                  <div className="p-3 bg-black/15 border border-white/5 rounded-xl text-xs space-y-1.5">
                    <span className="text-[9px] text-zinc-500 block uppercase">بازی‌های شاخص اکانت:</span>
                    <p className="text-zinc-300 font-sans leading-relaxed text-[11px] line-clamp-2 h-9" title={account.gamesList}>
                      {account.gamesList}
                    </p>
                    
                    <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[10px] text-slate-450">
                      <span>نرخ اجاره روزانه:</span>
                      <strong className="text-emerald-400 font-mono text-xs">{formatCurrency(account.dailyRate)}</strong>
                    </div>
                  </div>

                  {/* Rent status specifics */}
                  {account.status === 'rented' && (
                    <div className="p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl space-y-2 text-[11px] font-sans text-amber-200">
                      <div className="flex justify-between">
                        <span>مستاجر اکانت:</span>
                        <strong className="text-white">{account.currentRenterName} ({account.currentRenterPhone})</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>تاریخ واگذاری:</span>
                        <strong className="text-white font-mono">{account.rentedAt}</strong>
                      </div>
                      {account.returnDueTime && (
                        <div className="flex justify-between">
                          <span>موعد عودت:</span>
                          <strong className="text-white font-mono">{account.returnDueTime}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex gap-1">
                      {account.status === 'available' ? (
                        <button
                          type="button"
                          onClick={() => setShowRentOutModal(account)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                        >
                          تحویل به مشتری (اجاره دادن)
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReturnRental(account.id)}
                          className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg border border-emerald-500/20 text-[10px] font-bold transition-all cursor-pointer"
                        >
                          تحویل گرفتن اکانت (تسویه)
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteRental(account.id)}
                      className="p-1.5 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                      title="حذف کلی اکانت"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

            {rentals.length === 0 && (
              <div className="col-span-full py-12 text-center text-zinc-500 bg-surface-0f1219/20 border border-dashed border-white/5 rounded-2xl">
                <Gamepad2 className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                <p className="text-xs">هیچ اکانت اجاره‌ای در دیتابیس ثبت نشده است.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: COMPONENT REPAIRS */}
        {activeSubTab === 'repairs' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {repairs
              .filter(r => r.customerName.includes(searchQuery) || r.deviceType.includes(searchQuery))
              .map((job) => (
                <div 
                  key={job.id} 
                  className={`bg-surface-0f1219/50 border rounded-2xl p-5 space-y-4 transition-all relative overflow-hidden ${
                    job.status === 'delivered' ? 'border-white/5 opacity-55' :
                    job.status === 'ready' ? 'border-emerald-500/30' :
                    job.status === 'in_repair' ? 'border-amber-500/30' :
                    'border-white/5 hover:border-white/10'
                  }`}
                >
                  {/* Job Header */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black text-white leading-normal">{job.customerName}</h3>
                      <p className="text-[10px] text-zinc-500 font-mono">{job.customerPhone || 'بدون شماره تماس'}</p>
                    </div>
                    
                    <span className={`text-[9px] px-2 py-0.5 rounded-lg font-bold ${
                      job.status === 'pending' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' :
                      job.status === 'in_repair' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15 animate-pulse' :
                      job.status === 'ready' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' :
                      'bg-slate-800 text-slate-500 border border-white/5'
                    }`}>
                      {job.status === 'pending' ? 'پذیرش شده / در نوبت' :
                       job.status === 'in_repair' ? 'در حال تعمیر و تعویض قطعه' :
                       job.status === 'ready' ? 'آماده تحویل به مشتری' : 'تحویل داده شده'}
                    </span>
                  </div>

                  {/* Device Spec details */}
                  <div className="p-3 bg-black/15 border border-white/5 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-450">نوع تجهیزات:</span>
                      <strong className="text-white">{job.deviceType}</strong>
                    </div>
                    {job.serialNumber && (
                      <div className="flex justify-between">
                        <span className="text-slate-450">سریال دستگاه:</span>
                        <strong className="text-zinc-400 font-mono text-[10px]">{job.serialNumber}</strong>
                      </div>
                    )}
                    <div className="flex flex-col text-right gap-1 pt-1.5 border-t border-white/5">
                      <span className="text-[9px] text-zinc-500 uppercase">ایرادهای گزارش شده:</span>
                      <p className="text-zinc-300 font-sans leading-normal text-[11px] bg-black/10 p-1.5 rounded border border-white/5">
                        ⚠️ {job.issueDescription}
                      </p>
                    </div>
                  </div>

                  {/* Financial calculation */}
                  <div className="grid grid-cols-2 gap-3 bg-black/10 p-2.5 rounded-xl border border-white/5 text-[11px]">
                    <div>
                      <span className="text-[9px] text-zinc-500 uppercase block">هزینه حدودی تعمیر:</span>
                      <strong className="text-white font-mono">{formatCurrency(job.estimatedCost)}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 uppercase block">بیعانه پرداختی:</span>
                      <strong className="text-emerald-400 font-mono">
                        {job.depositPaid > 0 ? formatCurrency(job.depositPaid) : 'تسویه در تحویل'}
                      </strong>
                    </div>
                  </div>

                  {job.notes && (
                    <p className="text-[10px] text-zinc-400 bg-black/5 p-2 rounded border border-white/5 leading-relaxed font-sans">
                      📝 <span className="font-bold">ملاحظات:</span> {job.notes}
                    </p>
                  )}

                  {/* Actions toolbar */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex gap-1.5 items-center">
                      <span className="text-[9px] text-slate-500">تغییر وضعیت:</span>
                      <div className="flex bg-black/35 rounded-lg p-0.5 border border-white/5">
                        <button
                          onClick={() => handleUpdateRepairStatus(job.id, 'in_repair')}
                          className={`px-2 py-1 text-[9px] font-bold rounded ${job.status === 'in_repair' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          تعمیر
                        </button>
                        <button
                          onClick={() => handleUpdateRepairStatus(job.id, 'ready')}
                          className={`px-2 py-1 text-[9px] font-bold rounded ${job.status === 'ready' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          آماده
                        </button>
                        <button
                          onClick={() => handleUpdateRepairStatus(job.id, 'delivered')}
                          className={`px-2 py-1 text-[9px] font-bold rounded ${job.status === 'delivered' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          تحویل
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteRepair(job.id)}
                      className="p-1.5 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                      title="حذف کلی پرونده تعمیر"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

            {repairs.length === 0 && (
              <div className="col-span-full py-12 text-center text-zinc-500 bg-surface-0f1219/20 border border-dashed border-white/5 rounded-2xl">
                <Wrench className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                <p className="text-xs">هیچ پرونده تعمیرات دسته‌ای در کارگاه پذیرش نشده است.</p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* MODAL 1: NEW VIP RESERVATION */}
      {showResModal && (
        <div className="fixed inset-0 bg-surface-06070a/85 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
          <div className="bg-surface-121620 border border-white/10 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl p-6 space-y-4 text-right">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-black text-white">ثبت نوبت رزرو مشتری</h3>
              <button onClick={() => setShowResModal(false)} className="text-zinc-500 hover:text-white transition-colors cursor-pointer text-lg">×</button>
            </div>

            <form onSubmit={handleAddReservation} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">نام و نام خانوادگی مشتری *</label>
                <input
                  type="text"
                  required
                  value={newRes.customerName}
                  onChange={(e) => setNewRes({ ...newRes, customerName: e.target.value })}
                  placeholder="مثال: امین اکبری"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">شماره همراه مشتری</label>
                <input
                  type="text"
                  value={newRes.customerPhone}
                  onChange={(e) => setNewRes({ ...newRes, customerPhone: e.target.value })}
                  placeholder="مثال: 09123456789"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">سیستم یا دستگاه رزرو شونده *</label>
                <input
                  type="text"
                  required
                  value={newRes.systemName}
                  onChange={(e) => setNewRes({ ...newRes, systemName: e.target.value })}
                  placeholder="مثال: پی‌اس‌فایو VIP شماره ۲"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">زمان دقیق رزرو (ساعت و روز) *</label>
                <input
                  type="text"
                  required
                  value={newRes.reserveTime}
                  onChange={(e) => setNewRes({ ...newRes, reserveTime: e.target.value })}
                  placeholder="مثال: امروز ساعت ۲۰:۴۵"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">مبلغ بیعانه پرداختی (تومان)</label>
                <input
                  type="number"
                  value={newRes.depositAmount}
                  onChange={(e) => setNewRes({ ...newRes, depositAmount: e.target.value })}
                  placeholder="در صورت عدم پرداخت، خالی بگذارید"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">یادداشت اضافی</label>
                <textarea
                  value={newRes.notes}
                  onChange={(e) => setNewRes({ ...newRes, notes: e.target.value })}
                  placeholder="تعداد دسته‌ها، بازی خاص و..."
                  rows={2}
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs transition-all shadow-lg cursor-pointer"
              >
                ثبت رزرو موقت
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: NEW TOURNAMENT */}
      {showTourModal && (
        <div className="fixed inset-0 bg-surface-06070a/85 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
          <div className="bg-surface-121620 border border-white/10 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl p-6 space-y-4 text-right">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-black text-white">برگزاری مسابقه جدید گیم‌نت</h3>
              <button onClick={() => setShowTourModal(false)} className="text-zinc-500 hover:text-white transition-colors cursor-pointer text-lg">×</button>
            </div>

            <form onSubmit={handleAddTournament} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">عنوان مسابقه *</label>
                <input
                  type="text"
                  required
                  value={newTour.title}
                  onChange={(e) => setNewTour({ ...newTour, title: e.target.value })}
                  placeholder="مثال: تورنمنت بزرگ فیفا ۲۴ شیراز"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">نام بازی انتخابی *</label>
                <input
                  type="text"
                  required
                  value={newTour.gameName}
                  onChange={(e) => setNewTour({ ...newTour, gameName: e.target.value })}
                  placeholder="مثال: FC 24 (PS5)"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">هزینه ورودی به ازای هر بازیکن (تومان)</label>
                <input
                  type="number"
                  value={newTour.entryFee}
                  onChange={(e) => setNewTour({ ...newTour, entryFee: e.target.value })}
                  placeholder="رایگان یا هزینه دلخواه"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">جوایز قهرمانان مسابقه</label>
                <input
                  type="text"
                  value={newTour.prizePool}
                  onChange={(e) => setNewTour({ ...newTour, prizePool: e.target.value })}
                  placeholder="مثال: ۲ میلیون تومان وجه نقد"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">تاریخ برگزاری</label>
                <input
                  type="text"
                  value={newTour.startDate}
                  onChange={(e) => setNewTour({ ...newTour, startDate: e.target.value })}
                  placeholder="مثال: ۱۴۰۵/۰۴/۳۰"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">حداکثر ظرفیت بازیکنان</label>
                <input
                  type="number"
                  value={newTour.maxParticipants}
                  onChange={(e) => setNewTour({ ...newTour, maxParticipants: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs transition-all shadow-lg cursor-pointer"
              >
                ایجاد لیگ و فعال‌سازی
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD RENTAL ACCOUNT */}
      {showRentalModal && (
        <div className="fixed inset-0 bg-surface-06070a/85 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
          <div className="bg-surface-121620 border border-white/10 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl p-6 space-y-4 text-right">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-black text-white">ثبت اکانت اجاره‌ای در دیتابیس</h3>
              <button onClick={() => setShowRentalModal(false)} className="text-zinc-500 hover:text-white transition-colors cursor-pointer text-lg">×</button>
            </div>

            <form onSubmit={handleAddRental} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">عنوان نمایشی اکانت *</label>
                <input
                  type="text"
                  required
                  value={newRental.title}
                  onChange={(e) => setNewRental({ ...newRental, title: e.target.value })}
                  placeholder="مثال: اکانت اختصاصی EA FC 24 و بازی‌ها"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">پلتفرم اکانت *</label>
                <select
                  value={newRental.platform}
                  onChange={(e) => setNewRental({ ...newRental, platform: e.target.value as any })}
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none text-right cursor-pointer"
                >
                  <option value="Steam">Steam (استیم)</option>
                  <option value="PlayStation">PlayStation (پلی استیشن)</option>
                  <option value="Xbox">Xbox (ایکس باکس)</option>
                  <option value="EA / Ubisoft">EA / Ubisoft / Epic Games</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">لیست بازی‌های موجود روی اکانت *</label>
                <textarea
                  required
                  value={newRental.gamesList}
                  onChange={(e) => setNewRental({ ...newRental, gamesList: e.target.value })}
                  placeholder="مثال: Red Dead 2, GTA V, CS2 Premium"
                  rows={3}
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">مبلغ اجاره روزانه (تومان) *</label>
                <input
                  type="number"
                  required
                  value={newRental.dailyRate}
                  onChange={(e) => setNewRental({ ...newRental, dailyRate: e.target.value })}
                  placeholder="مثال: 45000"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs transition-all shadow-lg cursor-pointer"
              >
                ثبت و قرارگیری در ویترین
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RENT OUT PROCESS FORM */}
      {showRentOutModal && (
        <div className="fixed inset-0 bg-surface-06070a/85 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
          <div className="bg-surface-121620 border border-white/10 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl p-6 space-y-4 text-right">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-black text-white">تحویل اکانت به مشتری</h3>
              <button onClick={() => setShowRentOutModal(null)} className="text-zinc-500 hover:text-white transition-colors cursor-pointer text-lg">×</button>
            </div>

            <p className="text-[11px] text-indigo-400">شما در حال واگذاری موقت {showRentOutModal.title} هستید.</p>

            <form onSubmit={handleRentOut} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">نام و نام خانوادگی مشتری *</label>
                <input
                  type="text"
                  required
                  value={rentOutData.renterName}
                  onChange={(e) => setRentOutData({ ...rentOutData, renterName: e.target.value })}
                  placeholder="مثال: یاشار عباسی"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">شماره همراه مشتری *</label>
                <input
                  type="text"
                  required
                  value={rentOutData.renterPhone}
                  onChange={(e) => setRentOutData({ ...rentOutData, renterPhone: e.target.value })}
                  placeholder="مثال: 09301234567"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">موعد دقیق عودت اکانت</label>
                <input
                  type="text"
                  value={rentOutData.returnDueTime}
                  onChange={(e) => setRentOutData({ ...rentOutData, returnDueTime: e.target.value })}
                  placeholder="مثال: ۳ روز دیگر - ۱۴۰۵/۰۴/۲۴"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs transition-all shadow-lg cursor-pointer"
              >
                ثبت تحویل فیزیکی و امانت
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: NEW REPAIR JOB */}
      {showRepairModal && (
        <div className="fixed inset-0 bg-surface-06070a/85 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
          <div className="bg-surface-121620 border border-white/10 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl p-6 space-y-4 text-right">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-black text-white">پذیرش دسته / کنسول جهت تعمیر</h3>
              <button onClick={() => setShowRepairModal(false)} className="text-zinc-500 hover:text-white transition-colors cursor-pointer text-lg">×</button>
            </div>

            <form onSubmit={handleAddRepair} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">نام مشتری *</label>
                <input
                  type="text"
                  required
                  value={newRepair.customerName}
                  onChange={(e) => setNewRepair({ ...newRepair, customerName: e.target.value })}
                  placeholder="مثال: مهران محمودی"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">تلفن همراه *</label>
                <input
                  type="text"
                  required
                  value={newRepair.customerPhone}
                  onChange={(e) => setNewRepair({ ...newRepair, customerPhone: e.target.value })}
                  placeholder="مثال: 09172223344"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold">نوع تجهیزات *</label>
                  <select
                    value={newRepair.deviceType}
                    onChange={(e) => setNewRepair({ ...newRepair, deviceType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none text-right cursor-pointer"
                  >
                    <option value="PS5 Controller">دسته PS5</option>
                    <option value="PS4 Controller">دسته PS4</option>
                    <option value="Xbox Controller">دسته Xbox</option>
                    <option value="Console">کنسول بازی</option>
                    <option value="Other">تجهیزات دیگر</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold">سریال یا نشانه فیزیکی</label>
                  <input
                    type="text"
                    value={newRepair.serialNumber}
                    onChange={(e) => setNewRepair({ ...newRepair, serialNumber: e.target.value })}
                    placeholder="رنگ دسته، بدنه، برچسب"
                    className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">توضیح کامل عیب یا قطعات تعویضی *</label>
                <textarea
                  required
                  value={newRepair.issueDescription}
                  onChange={(e) => setNewRepair({ ...newRepair, issueDescription: e.target.value })}
                  placeholder="مثال: تعویض برد آنالوگ دریفت خورده و شستشوی دکمه‌ها"
                  rows={2}
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold">کل هزینه تعمیرات (تومان)</label>
                  <input
                    type="number"
                    value={newRepair.estimatedCost}
                    onChange={(e) => setNewRepair({ ...newRepair, estimatedCost: e.target.value })}
                    placeholder="مثال: 150000"
                    className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold">مبلغ بیعانه بیعانه (تومان)</label>
                  <input
                    type="number"
                    value={newRepair.depositPaid}
                    onChange={(e) => setNewRepair({ ...newRepair, depositPaid: e.target.value })}
                    placeholder="مثال: 50000"
                    className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">ملاحظات و اولویت</label>
                <input
                  type="text"
                  value={newRepair.notes}
                  onChange={(e) => setNewRepair({ ...newRepair, notes: e.target.value })}
                  placeholder="خیلی فوری، مشتری همیشگی و..."
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs transition-all shadow-lg cursor-pointer"
              >
                ثبت رسید موقت تعمیرگاه
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: REG PLAYER TO TOURNAMENT */}
      {showRegPlayerModal && (
        <div className="fixed inset-0 bg-surface-06070a/85 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
          <div className="bg-surface-121620 border border-white/10 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl p-6 space-y-4 text-right">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-black text-white">ثبت‌نام بازیکن در مسابقات</h3>
              <button onClick={() => setShowRegPlayerModal(null)} className="text-zinc-500 hover:text-white transition-colors cursor-pointer text-lg">×</button>
            </div>

            <p className="text-[11px] text-zinc-400">مسابقه: <span className="text-indigo-400 font-bold">{showRegPlayerModal.title}</span></p>

            <form onSubmit={handleRegisterPlayer} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">نام مستعار یا گیمر تگ / نام واقعی *</label>
                <input
                  type="text"
                  required
                  value={regPlayerData.name}
                  onChange={(e) => setRegPlayerData({ ...regPlayerData, name: e.target.value })}
                  placeholder="مثال: علی رضایی (Ali_Sniper)"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold">شماره تماس بازیکن</label>
                <input
                  type="text"
                  value={regPlayerData.phone}
                  onChange={(e) => setRegPlayerData({ ...regPlayerData, phone: e.target.value })}
                  placeholder="مثال: 09121112233"
                  className="w-full px-3 py-2 bg-surface-080b11 border border-white/5 focus:border-indigo-500 rounded-xl text-white focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-2 p-2 bg-surface-080b11 rounded-xl border border-white/5 cursor-pointer" onClick={() => setRegPlayerData({ ...regPlayerData, paid: !regPlayerData.paid })}>
                <input
                  type="checkbox"
                  checked={regPlayerData.paid}
                  onChange={() => {}} // handled by click
                  className="w-4 h-4 rounded border-white/10 accent-indigo-600"
                />
                <span className="text-[11px] text-zinc-300 select-none">حق ورودی مسابقه پرداخت شد (تسویه نهایی)</span>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs transition-all shadow-lg cursor-pointer"
              >
                تایید نهایی و ثبت‌نام در جدول مسابقات
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
