import React, { useState } from 'react';
import { X, Sparkles, Plus, Minus, Gamepad2, Volume2, ShieldAlert, Zap, HelpCircle, Trash2 } from 'lucide-react';
import { System, SessionBuffetItem, ExtraServicePreset } from '../types';
import { formatCurrency } from '../utils';

interface AddExtraServiceModalProps {
  system: System;
  isOpen: boolean;
  onClose: () => void;
  onAdd: (servicesSelected: { id: string; name: string; price: number; quantity: number }[]) => void;
  extraServicePresets?: ExtraServicePreset[];
  onRemoveAttachedItem?: (itemId: string) => void;
}

interface ServicePreset {
  id: string;
  name: string;
  price: number;
  description: string;
  icon: React.ReactNode;
  category: 'equipment' | 'damage' | 'vip';
}

const DEFAULT_PRESETS_DATA: ExtraServicePreset[] = [
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

export default function AddExtraServiceModal({
  system,
  isOpen,
  onClose,
  onAdd,
  extraServicePresets,
  onRemoveAttachedItem,
}: AddExtraServiceModalProps) {
  const [activeCategory, setActiveCategory] = useState<'all' | 'equipment' | 'damage' | 'vip'>('all');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [error, setError] = useState('');

  if (!isOpen || !system.activeSession) return null;

  const session = system.activeSession;

  const sourcePresets = (extraServicePresets && extraServicePresets.length > 0)
    ? extraServicePresets
    : DEFAULT_PRESETS_DATA;

  const getIconForPreset = (item: ExtraServicePreset) => {
    if (item.category === 'damage') {
      return <ShieldAlert className="w-5 h-5 text-rose-400" />;
    }
    if (item.category === 'vip') {
      return <Sparkles className="w-5 h-5 text-amber-400" />;
    }
    if (item.name.includes('هدفون') || item.name.includes('هدست')) {
      return <Volume2 className="w-5 h-5 text-emerald-400" />;
    }
    if (item.name.includes('فرمان') || item.name.includes('شبیه‌ساز')) {
      return <Zap className="w-5 h-5 text-indigo-400" />;
    }
    return <Gamepad2 className="w-5 h-5 text-blue-400" />;
  };

  const presets: ServicePreset[] = sourcePresets.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    description: item.description,
    icon: getIconForPreset(item),
    category: item.category,
  }));

  const filteredPresets = presets.filter(
    (p) => activeCategory === 'all' || p.category === activeCategory
  );

  const handleUpdateQty = (presetId: string, increment: boolean) => {
    const current = quantities[presetId] || 0;
    let next = current;
    if (increment) {
      next = current + 1;
    } else {
      next = Math.max(0, current - 1);
    }
    setQuantities({
      ...quantities,
      [presetId]: next,
    });
  };

  const getActiveCount = (): number => {
    const presetSum = (Object.values(quantities) as number[]).reduce((acc: number, q: number) => acc + q, 0);
    return presetSum + (customName.trim().length > 0 && Number(customPrice) > 0 ? 1 : 0);
  };

  const calculateSubtotal = () => {
    const presetSubtotal = Object.entries(quantities).reduce((sum: number, [presetId, qty]) => {
      const p = presets.find((i) => i.id === presetId);
      const qtyNum = qty as number;
      return sum + (p ? p.price * qtyNum : 0);
    }, 0);

    const customSubtotal = (Number(customPrice) || 0) * (Number(customQty) || 1);
    return presetSubtotal + (customName ? customSubtotal : 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const finalItems: { id: string; name: string; price: number; quantity: number }[] = [];

    // Process presets
    Object.entries(quantities).forEach(([presetId, qty]) => {
      const qtyNum = qty as number;
      if (qtyNum > 0) {
        const preset = presets.find((p) => p.id === presetId)!;
        finalItems.push({
          id: preset.id,
          name: preset.name,
          price: preset.price,
          quantity: qtyNum,
        });
      }
    });

    // Process custom service
    if (customName.trim()) {
      const priceVal = Number(customPrice);
      const qtyVal = Number(customQty) || 1;

      if (isNaN(priceVal) || priceVal < 0) {
        setError('مبلغ خدمت جانبی نامعتبر است.');
        return;
      }

      finalItems.push({
        id: `srv-custom-${Date.now()}`,
        name: customName.trim(),
        price: priceVal,
        quantity: qtyVal,
      });
    }

    if (finalItems.length === 0) {
      onClose();
      return;
    }

    onAdd(finalItems);
    setQuantities({});
    setCustomName('');
    setCustomPrice('');
    setCustomQty('1');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" dir="rtl">
      <div 
        className="w-full max-w-lg bg-[#151921] border border-white/5 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 text-right"
        id="add-extra-service-modal"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#0B0E14]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-tight font-sans">
            <Sparkles className="w-5 h-5 text-amber-400" />
            ثبت خدمات جانبی و جریمه خسارت - {system.name}
          </h3>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
          {/* Scrollable Content */}
          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            <p className="text-[11px] text-slate-400 leading-6">
              خدمات جانبی، کرایه وسایل اضافه (هدست، دسته)، هزینه‌های متفرقه یا جریمه‌های جزیی (مانند افتادن دسته یا هدفون) را به فاکتور مشتری فعال <strong>{session.customerName}</strong> اضافه کنید. این مبالغ روی مجموع صورت‌حساب لحظه‌ای و نهایی سیستم اعمال خواهند شد.
            </p>

            {/* Currently attached services */}
            {session.extraServices && session.extraServices.length > 0 && (
              <div className="space-y-2 bg-[#0B0E14]/80 p-3 rounded-xl border border-amber-500/20">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                  ✨ خدمات و تجهیزات فعال روی این حساب ({session.extraServices.length})
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {session.extraServices.map((eItem) => (
                    <div key={eItem.id} className="flex items-center justify-between bg-[#151921] px-2.5 py-1.5 rounded-lg border border-white/5 text-xs text-slate-200">
                      <div className="flex items-center gap-2">
                        {onRemoveAttachedItem && (
                          <button
                            type="button"
                            onClick={() => onRemoveAttachedItem(eItem.id)}
                            className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded transition-colors cursor-pointer"
                            title="حذف این مورد از حساب"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span>{eItem.name} <span className="text-slate-400 text-[10px]">({eItem.quantity} عدد)</span></span>
                      </div>
                      <span className="font-mono text-amber-400 font-bold">{formatCurrency(eItem.price * eItem.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Presets Categories Filter */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                🛠️ دسته‌بندی خدمات و تجهیزات کلوب
              </span>
              <div className="flex flex-wrap items-center gap-1.5 bg-[#0B0E14]/60 p-1 border border-white/5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    activeCategory === 'all'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  همه موارد
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('equipment')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    activeCategory === 'equipment'
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  🎮 کرایه لوازم اضافه
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('damage')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    activeCategory === 'damage'
                      ? 'bg-rose-600/20 text-rose-400 border border-rose-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  ⚠️ خسارت و جرایم
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('vip')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    activeCategory === 'vip'
                      ? 'bg-purple-600/20 text-purple-400 border border-purple-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  ✨ سرویس اتاق VIP
                </button>
              </div>
            </div>

            {/* Grid of Presets */}
            <div className="grid grid-cols-1 gap-2">
              {filteredPresets.map((p) => {
                const count = quantities[p.id] || 0;
                return (
                  <div 
                    key={p.id}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                      count > 0 
                        ? 'bg-[#1D2029]/70 border-amber-500/30' 
                        : 'bg-[#0B0E14]/40 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-900 border border-white/5 rounded-xl shrink-0">
                        {p.icon}
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-white block">{p.name}</span>
                        <span className="text-[10px] text-slate-400 block font-light">{p.description}</span>
                        <span className="text-[10px] text-amber-400 font-mono font-medium block">{formatCurrency(p.price)}</span>
                      </div>
                    </div>

                    {/* Quantity selectors */}
                    <div className="flex items-center gap-1.5 bg-black/20 p-1 border border-white/5 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(p.id, false)}
                        className="w-7 h-7 bg-slate-800/40 hover:bg-slate-800/80 rounded-lg text-slate-300 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center font-mono text-xs font-bold text-white select-none">
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(p.id, true)}
                        className="w-7 h-7 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg flex items-center justify-center transition-all cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="h-px bg-white/5"></div>

            {/* Custom Extra Charge Section */}
            <div className="space-y-3 bg-[#0B0E14]/30 border border-white/5 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                ✍️ ثبت خدمت یا هزینه اختصاصی (دلخواه)
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 block">عنوان خدمت یا هزینه:</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="مثال: اجاره پچ اضافی بازی"
                    className="w-full bg-[#050608] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none focus:border-blue-500 font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 block">مبلغ به تومان:</label>
                  <input
                    type="number"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="مثال: 15000"
                    min="0"
                    dir="ltr"
                    className="w-full bg-[#050608] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none focus:border-blue-500 font-mono text-right"
                  />
                </div>
              </div>

              {customName.trim() && (
                <div className="flex items-center gap-2 justify-end pt-1">
                  <span className="text-[10px] text-slate-400">تعداد:</span>
                  <div className="relative w-20">
                    <input
                      type="number"
                      value={customQty}
                      onChange={(e) => setCustomQty(e.target.value)}
                      min="1"
                      className="w-full bg-[#050608] border border-white/10 rounded-lg px-2 py-1 text-center text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/25 p-2 rounded-lg text-center font-bold">
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Modal Footer / Summary Action Block */}
          <div className="p-4 border-t border-white/5 bg-[#0B0E14] flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-right">
              <HelpCircle className="w-4 h-4 text-slate-500 hidden md:block" />
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 block">تعداد اقلام انتخابی: {getActiveCount()} مورد</span>
                <span className="text-xs text-slate-200 block">
                  مبلغ اضافه شونده: <strong className="text-amber-400 font-mono text-sm">{formatCurrency(calculateSubtotal())}</strong>
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={getActiveCount() === 0}
              className={`w-full md:w-auto px-6 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                getActiveCount() > 0
                  ? 'bg-amber-500 text-slate-950 cursor-pointer shadow-lg shadow-amber-500/10 hover:bg-amber-400 active:scale-98'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>افزودن به فاکتور مشتری</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
