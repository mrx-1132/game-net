import React, { useState } from 'react';
import { 
  Plus, Minus, ShoppingCart, Search, CreditCard, 
  CircleDollarSign, BookOpen, AlertCircle, CheckCircle2,
  Trash2, User, ChevronDown, Check, RefreshCw, Calculator
} from 'lucide-react';
import { BuffetItem, DebtCustomer, CardReader, UserPermissions } from '../types';
import { formatCurrency } from '../utils';

interface BuffetPOSDeskProps {
  buffetItems: BuffetItem[];
  debtors: DebtCustomer[];
  onRecordSale: (
    items: { id: string; name: string; price: number; quantity: number }[],
    customerName: string,
    paymentMethod: 'cash' | 'card' | 'debt' | 'mixed',
    debtCustomerId?: string,
    cashPaidAmount?: number,
    cardPaidAmount?: number,
    debtAmount?: number,
    cardReaderId?: string,
    cardReaderName?: string
  ) => void;
  cardReaders: CardReader[];
  cashDivisors?: number[];
  userRole?: 'admin' | 'user';
  userPermissions?: UserPermissions;
}

export default function BuffetPOSDesk({
  buffetItems,
  debtors,
  onRecordSale,
  cardReaders = [],
  cashDivisors = [2, 3, 4],
  userRole = 'user',
  userPermissions,
}: BuffetPOSDeskProps) {
  const canRegisterDebt = userRole === 'admin' || !!userPermissions?.debt;
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'fridge' | 'cafe' | 'snack'>('all');
  
  // Cart items: state of { itemId: quantity }
  const [cart, setCart] = useState<Record<string, number>>({});
  
  // Customer details
  const [clientType, setClientType] = useState<'walk_in' | 'debtor'>('walk_in');
  const [customCustomerName, setCustomCustomerName] = useState('مشتری آزاد بوفه');
  const [selectedDebtorId, setSelectedDebtorId] = useState<string>('');
  const [debtorSearch, setDebtorSearch] = useState('');
  const [isDebtorDropdownOpen, setIsDebtorDropdownOpen] = useState(false);

  // Payment settle state
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'debt' | 'mixed'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [debtAmountInput, setDebtAmountInput] = useState('');
  const [cashDivision, setCashDivision] = useState<number>(1);
  const [selectedCardReaderId, setSelectedCardReaderId] = useState<string>(cardReaders[0]?.id || '');

  React.useEffect(() => {
    if (cardReaders && cardReaders.length > 0 && !selectedCardReaderId) {
      setSelectedCardReaderId(cardReaders[0].id);
    }
  }, [cardReaders, selectedCardReaderId]);

  // Status & errors
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filtering products
  const filteredItems = buffetItems
    .filter((i) => {
      const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === 'all' || i.category === activeCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      const pA = a.priority || 0;
      const pB = b.priority || 0;
      if (pB !== pA) {
        return pB - pA;
      }
      return a.name.localeCompare(b.name, 'fa');
    });

  // Selected Debtor
  const activeDebtor = debtors.find(d => d.id === selectedDebtorId);

  // Filter debtors in dropdown
  const filteredDebtors = debtors.filter(
    (d) =>
      d.name.toLowerCase().includes(debtorSearch.toLowerCase()) ||
      d.phone.includes(debtorSearch)
  );

  const getCartTotal = () => {
    return Object.entries(cart).reduce((sum, [id, qty]) => {
      const p = buffetItems.find((item) => item.id === id);
      return sum + (p ? p.price * Number(qty) : 0);
    }, 0);
  };

  const handleAddToCart = (itemId: string) => {
    const p = buffetItems.find((item) => item.id === itemId);
    if (p && p.stock !== undefined && p.stock <= 0) {
      setErrorMessage(`محصول "${p.name}" در حال حاضر اتمام موجودی است.`);
      return;
    }
    setCart((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1,
    }));
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleUpdateQty = (itemId: string, increment: boolean) => {
    const current = cart[itemId] || 0;
    const p = buffetItems.find((item) => item.id === itemId);

    if (increment && p && p.stock !== undefined && current >= p.stock) {
      setErrorMessage(`بیشتر از موجودی انبار (${p.stock} عدد) برای کالا امکان‌پذیر نیست.`);
      return;
    }

    const next = increment ? current + 1 : current - 1;
    setCart((prev) => {
      const nextCart = { ...prev };
      if (next <= 0) {
        delete nextCart[itemId];
      } else {
        nextCart[itemId] = next;
      }
      return nextCart;
    });
    setErrorMessage('');
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart((prev) => {
      const nextCart = { ...prev };
      delete nextCart[itemId];
      return nextCart;
    });
  };

  const handleClearCart = () => {
    setCart({});
    setCashAmount('');
    setCardAmount('');
    setDebtAmountInput('');
    setErrorMessage('');
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const total = getCartTotal();
    const cartItems = Object.entries(cart).map(([id, qty]) => {
      const p = buffetItems.find((item) => item.id === id)!;
      return { id: p.id, name: p.name, price: p.price, quantity: Number(qty) };
    });

    if (cartItems.length === 0) {
      setErrorMessage('سبد خرید بوفه خالی است.');
      return;
    }

    let customerName = customCustomerName.trim() || 'مشتری مستقیم';
    let debtorId: string | undefined = undefined;

    const isDebtUsed = clientType === 'debtor' || payMethod === 'debt' || (payMethod === 'mixed' && (Number(debtAmountInput) || 0) > 0);
    if (isDebtUsed && !canRegisterDebt) {
      setErrorMessage('ثبت پرداخت نسیه در بوفه غیرفعال است. جهت ثبت نسیه، ابتدا دسترسی «دفتر نسیه» را در بخش تنظیمات فعال نمایید.');
      return;
    }

    if (clientType === 'debtor') {
      if (!selectedDebtorId) {
        setErrorMessage('لطفاً یک بدهکار را جهت ثبت به صورت نسیه انتخاب کنید.');
        return;
      }
      customerName = activeDebtor?.name || 'مشتری نسیه';
      debtorId = selectedDebtorId;
    }

    // Process payment validation
    let actualPayMethod = payMethod;
    let finalCash: number | undefined = undefined;
    let finalCard: number | undefined = undefined;
    let finalDebt: number | undefined = undefined;

    if (actualPayMethod === 'cash') {
      finalCash = total;
    } else if (actualPayMethod === 'card') {
      finalCard = total;
    } else if (actualPayMethod === 'debt') {
      if (clientType !== 'debtor') {
        setErrorMessage('برای ثبت فاکتور نسیه، ابتدا باید نوع مشتری را روی "دفتر نسیه" بگذارید.');
        return;
      }
      finalDebt = total;
    } else if (actualPayMethod === 'mixed') {
      const cashVal = Number(cashAmount) || 0;
      const cardVal = Number(cardAmount) || 0;
      const debtVal = clientType === 'debtor' ? (Number(debtAmountInput) || 0) : 0;
      
      if (cashVal < 0 || cardVal < 0 || debtVal < 0) {
        setErrorMessage('مبالغ پرداختی نمی‌توانند منفی باشند.');
        return;
      }

      if (cashVal + cardVal + debtVal !== total) {
        setErrorMessage(`جمع مبالغ ترکیبی (${(cashVal + cardVal + debtVal).toLocaleString()} تومان) باید دقیقاً با جمع فاکتور (${total.toLocaleString()} تومان) برابر باشد.`);
        return;
      }

      finalCash = cashVal;
      finalCard = cardVal;
      finalDebt = debtVal > 0 ? debtVal : undefined;
    }

    const chosenReader = cardReaders.find(r => r.id === selectedCardReaderId);
    const hasCardComponent = actualPayMethod === 'card' || (actualPayMethod === 'mixed' && finalCard && finalCard > 0);

    // Call checkout callback
    onRecordSale(
      cartItems,
      customerName,
      actualPayMethod,
      debtorId,
      finalCash,
      finalCard,
      finalDebt,
      hasCardComponent ? (chosenReader?.id || selectedCardReaderId) : undefined,
      hasCardComponent ? (chosenReader?.name || (selectedCardReaderId ? 'پیش‌فرض' : undefined)) : undefined
    );

    // Show success & reset
    setSuccessMessage(`فاکتور بوفه با موفقیت به مبلغ ${total.toLocaleString()} تومان تسویه و در حساب‌ها ثبت گردید.`);
    handleClearCart();
    
    // Automatically fade success after 4s
    setTimeout(() => {
      setSuccessMessage('');
    }, 5000);
  };

  const total = getCartTotal();

  return (
    <div className="bg-[#151921] border border-white/5 rounded-2xl p-5 shadow-2xl relative" dir="rtl">
      
      {/* Decorative tag */}
      <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 bg-blue-600/10 text-blue-400 border border-blue-500/20 text-[10px] font-black rounded-lg">
        <ShoppingCart className="w-3.5 h-3.5" />
        <span>پیشخوان فروش مستقل بوفه</span>
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-black text-white flex items-center gap-2">
          <CircleDollarSign className="w-5 h-5 text-emerald-400" />
          صندوق فروش دستی و اتصال به حساب دفتری بوفه
        </h3>
        <p className="text-[10px] text-slate-400 mt-0.5">
          بدون نیاز به پورت یا سیستم بازی، خوراکی‌ها صادر شده را مستقیماً نقد تسویه یا نسیه معطل ثبت دفتری کنید.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* RIGHT COLUMN: Food shelf catalog (Takes 7 cols) */}
        <div className="xl:col-span-7 space-y-4">
          
          {/* Header & filters */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            
            {/* Shelf search */}
            <div className="relative text-xs flex-grow max-w-md">
              <span className="absolute right-3 top-2.5 text-slate-500">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="جستجوی سریع محصول در بوفه..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-8 pl-3 py-2 bg-[#0B0E14] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
              />
            </div>

            {/* Sub-category pills */}
            <div className="flex items-center gap-1.5 bg-[#090C11] p-1 border border-white/5 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                  activeCategory === 'all' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                نمایش همه
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('fridge')}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                  activeCategory === 'fridge' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                🧊 یخچال
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('cafe')}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                  activeCategory === 'cafe' ? 'bg-amber-600 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                ☕ کافه
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('snack')}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                  activeCategory === 'snack' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                🍿 تنقلات
              </button>
            </div>

          </div>

          {/* Grid list of shelf */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 px-0.5 overflow-y-auto max-h-[380px] pb-2 text-right">
            {filteredItems.length === 0 ? (
              <div className="col-span-full py-16 text-center border border-dashed border-white/10 rounded-2xl text-slate-500 text-xs">
                کالایی با فیلتر شما همخوانی ندارد.
              </div>
            ) : (
              filteredItems.map((item) => {
                const countIn = cart[item.id] || 0;
                const isOutOfStock = item.stock !== undefined && item.stock <= 0;
                
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddToCart(item.id)}
                    className={`p-3 rounded-xl border text-right flex flex-col justify-between h-[100px] transition-all cursor-pointer ${
                      countIn > 0 
                        ? 'bg-blue-600/10 border-blue-500/40 shadow-md shadow-blue-500/5' 
                        : 'bg-[#0B0E14]/50 border-white/5 hover:border-white/15'
                    } ${isOutOfStock ? 'opacity-40 select-none cursor-not-allowed' : ''}`}
                    title={isOutOfStock ? "اتمام موجودی" : item.name}
                  >
                    <div className="w-full">
                      <div className="flex justify-between items-start gap-1 w-full">
                        <span className="text-xs font-bold text-white leading-tight block truncate max-w-[120px]">{item.name}</span>
                        {item.stock !== undefined && (
                          <span className={`text-[8px] font-medium font-mono px-1 rounded shrink-0 ${
                            item.stock <= 3 ? 'bg-rose-500/15 text-rose-450' : 'bg-slate-850 text-slate-400'
                          }`}>
                            {item.stock === 0 ? "ناموجود" : `موجودی: ${item.stock}`}
                          </span>
                        )}
                      </div>
                      
                      <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                        {item.category === 'fridge' ? '🧊 یخچال' : item.category === 'cafe' ? '☕ کافه' : '🍿 تنقلات'}
                      </span>
                    </div>

                    <div className="flex justify-between items-end w-full border-t border-white/5 pt-1.5 mt-1.5">
                      <span className="text-xs font-black text-emerald-400 font-mono">
                        {formatCurrency(item.price)}
                      </span>
                      
                      {countIn > 0 ? (
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-mono font-bold flex items-center justify-center text-[10px]">
                          {countIn}
                        </span>
                      ) : (
                        <span className="text-[9px] text-[#2563EB] font-bold">+ انتخاب</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

        </div>

        {/* LEFT COLUMN: Shopping Cart, Customer Selection & Payment (Takes 5 cols) */}
        <div className="xl:col-span-5 border-t xl:border-t-0 xl:border-r border-white/5 pt-5 xl:pt-0 xl:pr-6 flex flex-col justify-between">
          
          <form onSubmit={handleCheckoutSubmit} className="space-y-4">
            
            {/* Feedback items */}
            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Shopping cart summary list */}
            <div>
              <span className="text-xs font-bold text-slate-400 block mb-2">سبد خرید فعلی بوفه:</span>
              
              {Object.keys(cart).length === 0 ? (
                <div className="py-8 bg-[#0B0E14]/30 border border-dashed border-white/5 rounded-xl text-center text-slate-500 text-xs">
                  کالاهای درخواستی را از لیست روبرو انتخاب کنید.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {Object.entries(cart).map(([itemId, qty]) => {
                    const item = buffetItems.find(p => p.id === itemId);
                    if (!item) return null;
                    return (
                      <div key={itemId} className="flex justify-between items-center p-2 bg-[#0B0E14] border border-white/5 rounded-xl text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-white block">{item.name}</span>
                          <span className="text-slate-400 text-[10px] font-mono">فی: {formatCurrency(item.price)}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 bg-[#151921] p-0.5 border border-white/5 rounded-lg">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(itemId, false)}
                              className="p-1 hover:bg-white/5 text-slate-400 rounded cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-4 text-center font-bold text-xs font-mono text-white">{qty}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(itemId, true)}
                              className="p-1 hover:bg-white/5 text-slate-400 rounded cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(itemId)}
                            className="p-1 text-slate-500 hover:text-rose-450 transition-colors cursor-pointer"
                            title="حذف از پیش‌فاکتور"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 1. Customer Context Selector */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 block">مشخصات خریدار فاکتور:</span>
              
              <div className="grid grid-cols-2 gap-2 bg-[#0B0E14] p-1 border border-white/5 rounded-xl text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setClientType('walk_in');
                    if (payMethod === 'debt') setPayMethod('cash');
                  }}
                  className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    clientType === 'walk_in' ? 'bg-blue-600 text-white shadow' : 'text-slate-400'
                  }`}
                >
                  <User className="w-3.5 h-3.5 inline-block ml-1" />
                  مشتری رهگذر (نقدی/کارت)
                </button>
                <button
                  type="button"
                  onClick={() => setClientType('debtor')}
                  className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    clientType === 'debtor' ? 'bg-amber-600 text-slate-950 shadow' : 'text-slate-400'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 inline-block ml-1" />
                  دفتر نسیه (بدهکاران)
                </button>
              </div>

              {clientType === 'walk_in' ? (
                <div className="space-y-1 text-right">
                  <label className="text-[10px] text-slate-400 font-medium block">عنوان مشتری (اختیاری):</label>
                  <input
                    type="text"
                    value={customCustomerName}
                    onChange={(e) => setCustomCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0E14] border border-white/5 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    placeholder="خریدار بوفه"
                  />
                </div>
              ) : (
                <div className="space-y-1 text-right relative">
                  <label className="text-[10px] text-slate-400 font-medium block">انتخاب بدهکار حساب دفتری:</label>
                  
                  {/* Custom Debtor Dropdown Select */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsDebtorDropdownOpen(!isDebtorDropdownOpen)}
                      className="w-full px-3 py-2 bg-[#0B0E14] border border-white/5 rounded-xl text-white flex justify-between items-center text-xs text-right cursor-pointer"
                    >
                      <span>
                        {activeDebtor ? `${activeDebtor.name} (${activeDebtor.phone})` : '-- مشتری بدهکاری را انتخاب نمایید --'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </button>

                    {isDebtorDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-[#10131B] border border-white/10 rounded-xl shadow-2xl p-2.5 space-y-2">
                        <input
                          type="text"
                          placeholder="جستجو با اسم یا شماره موبایل..."
                          value={debtorSearch}
                          onChange={(e) => setDebtorSearch(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[#0B0E14] border border-white/5 rounded-lg text-white text-[11px] focus:outline-none"
                        />
                        <div className="max-h-[140px] overflow-y-auto space-y-1">
                          {filteredDebtors.length === 0 ? (
                            <div className="text-[10px] py-3 text-slate-500 text-center">پرونده‌ای با این مشخصات یافت نشد.</div>
                          ) : (
                            filteredDebtors.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => {
                                  setSelectedDebtorId(d.id);
                                  setIsDebtorDropdownOpen(false);
                                  setDebtorSearch('');
                                }}
                                className="w-full p-2 hover:bg-white/5 rounded-lg text-right text-[11px] flex justify-between items-center text-slate-200 hover:text-white"
                              >
                                <span>{d.name} <span className="text-slate-500 font-mono">({d.phone})</span></span>
                                <span className="font-mono text-amber-500 font-bold">{formatCurrency(d.balance)}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Settle Method Options */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <span className="text-xs font-bold text-slate-400 block">روش تسویه‌حساب فاکتور بوفه:</span>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setPayMethod('cash')}
                  className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    payMethod === 'cash' ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 shadow' : 'bg-[#0B0E14] text-slate-400 border border-transparent'
                  }`}
                >
                  <CircleDollarSign className="w-4 h-4" />
                  <span>نقدی صندوق</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setPayMethod('card')}
                  className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    payMethod === 'card' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow' : 'bg-[#0B0E14] text-slate-400 border border-transparent'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>کارتخوان بانک</span>
                </button>

                {clientType === 'debtor' && (
                  <button
                    type="button"
                    onClick={() => setPayMethod('debt')}
                    className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      payMethod === 'debt' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow' : 'bg-[#0B0E14] text-slate-400 border border-transparent'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>ثبت نسیه دفتری</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setPayMethod('mixed');
                    setCashAmount('');
                    setCardAmount('');
                    setDebtAmountInput('');
                  }}
                  className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    payMethod === 'mixed' ? 'bg-purple-600/10 text-purple-400 border border-purple-500/20 shadow' : 'bg-[#0B0E14] text-slate-400 border border-transparent'
                  }`}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>ترکیبی دستی</span>
                </button>
              </div>

              {payMethod === 'cash' && (
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2 animate-in fade-in duration-200 mt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-right">
                    <span className="text-[10px] text-slate-300 font-bold">تسویه کاملاً نقدی ({formatCurrency(total)})</span>

                    {/* Division Calculator */}
                    <div className="flex items-center gap-1 bg-[#0B0E14] p-1 border border-emerald-500/30 rounded-lg">
                      <div className="flex items-center gap-0.5 px-1 text-[9px] text-emerald-400 font-bold border-l border-white/10">
                        <Calculator className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>تقسیم:</span>
                      </div>
                      {(cashDivisors || [2, 3, 4]).map((divisor) => (
                        <button
                          key={divisor}
                          type="button"
                          onClick={() => setCashDivision(cashDivision === divisor ? 1 : divisor)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                            cashDivision === divisor
                              ? 'bg-emerald-500 text-black shadow-sm'
                              : 'text-emerald-300 hover:bg-emerald-500/20'
                          }`}
                        >
                          ÷{divisor}
                        </button>
                      ))}
                      <div className="flex items-center gap-0.5 pr-0.5 border-r border-white/10">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={cashDivision > 1 ? cashDivision : ''}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setCashDivision(val);
                          }}
                          placeholder="تعداد"
                          className="w-10 h-5 bg-[#151921] border border-emerald-500/40 rounded text-center text-[10px] font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
                          title="تعداد نفرات جهت تقسیم"
                        />
                      </div>
                    </div>
                  </div>

                  {cashDivision > 1 && (
                    <div className="p-2 bg-[#0B0E14] border border-emerald-500/30 rounded-lg flex items-center justify-between text-emerald-300 text-[10px] font-semibold animate-in zoom-in-95 duration-150">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">سهم هر نفر (تقسیم بر {cashDivision} نفر):</span>
                        <button
                          type="button"
                          onClick={() => setCashDivision(1)}
                          className="text-[8px] text-rose-400 hover:underline cursor-pointer"
                        >
                          (لغو)
                        </button>
                      </div>
                      <span className="font-mono text-emerald-400 font-bold">
                        {formatCurrency(Math.round(total / cashDivision))}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Card Reader Selection */}
              {(payMethod === 'card' || payMethod === 'mixed') && (
                <div className="p-3 bg-[#0B0E14]/30 border border-white/5 rounded-xl space-y-1.5 mt-2 text-right">
                  <label className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">
                    🔌 انتخاب دستگاه کارتخوان بانکی (POS):
                  </label>
                  {cardReaders.length === 0 ? (
                    <div className="text-[9px] text-amber-500 font-bold">
                      ⚠️ هیچ کارتخوانی در تنظیمات تعریف نشده؛ با نام کارتخوان پیش‌فرض ثبت خواهد شد.
                    </div>
                  ) : (
                    <select
                      value={selectedCardReaderId}
                      onChange={(e) => setSelectedCardReaderId(e.target.value)}
                      className="w-full text-[10px] px-2.5 py-1.5 bg-[#0B0E14] border border-white/5 rounded-lg text-white font-semibold cursor-pointer focus:outline-none"
                      style={{ direction: 'rtl' }}
                    >
                      {cardReaders.map((pos) => (
                        <option key={pos.id} value={pos.id}>
                          {pos.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Mixed settlement values input drawer */}
              {payMethod === 'mixed' && (
                <div className="p-3 bg-[#0B0E14]/40 border border-white/5 rounded-xl text-[11px] space-y-3 mt-2 animate-in slide-in-from-top-1">
                  <span className="text-slate-400 font-bold block">تقسیم تفصیلی مبالغ ترکیبی:</span>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 block">پرداختی نقدی صندوق:</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        className="w-full px-2 py-1 bg-[#151921] border border-white/5 rounded text-white font-mono text-center"
                      />
                      {cashAmount && !isNaN(Number(cashAmount)) && Number(cashAmount) > 0 && (
                        <span className="text-[9px] text-emerald-400 block font-mono text-center">
                          {formatCurrency(Number(cashAmount))}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 block">کارتخوان بانک (کارت):</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={cardAmount}
                        onChange={(e) => setCardAmount(e.target.value)}
                        className="w-full px-2 py-1 bg-[#151921] border border-white/5 rounded text-white font-mono text-center"
                      />
                      {cardAmount && !isNaN(Number(cardAmount)) && Number(cardAmount) > 0 && (
                        <span className="text-[9px] text-blue-400 block font-mono text-center">
                          {formatCurrency(Number(cardAmount))}
                        </span>
                      )}
                    </div>

                    {clientType === 'debtor' ? (
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 block">ثبت به حساب نسیه:</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={debtAmountInput}
                          onChange={(e) => setDebtAmountInput(e.target.value)}
                          className="w-full px-2 py-1 bg-[#12161E] border border-white/10 rounded text-amber-400 font-mono text-center"
                        />
                        {debtAmountInput && !isNaN(Number(debtAmountInput)) && Number(debtAmountInput) > 0 && (
                          <span className="text-[9px] text-amber-500 block font-mono text-center">
                            {formatCurrency(Number(debtAmountInput))}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1 opacity-40">
                        <label className="text-[9px] text-slate-500 block">نسیه (محدود به دفتر):</label>
                        <input
                          type="text"
                          disabled
                          placeholder="غیرفعال"
                          className="w-full px-2 py-1 bg-[#0A0D14] border border-transparent rounded text-center text-slate-650 cursor-not-allowed"
                        />
                      </div>
                    )}

                  </div>

                  {/* Calculated summary of mixed sum matches total */}
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                    <span>جمع قطره‌ای:</span>
                    <span className="font-mono">
                      {( (Number(cashAmount) || 0) + (Number(cardAmount) || 0) + (clientType === 'debtor' ? (Number(debtAmountInput) || 0) : 0) ).toLocaleString()} از {total.toLocaleString()} تومان
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Total display & checkout button container */}
            <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-5">
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block leading-3">مبلغ قابل پرداخت فاکتور بوفه:</span>
                <span className="text-md md:text-lg font-black text-blue-400 font-mono">
                  {formatCurrency(total)}
                </span>
              </div>

              <button
                type="submit"
                disabled={total === 0}
                className="flex-grow py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs text-white rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/10 cursor-pointer text-center"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ثبت نهایی و ثبت حسابداری فاکتور بوفه</span>
              </button>
            </div>

          </form>

        </div>

      </div>

    </div>
  );
}
