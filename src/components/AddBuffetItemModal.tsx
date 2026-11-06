import React, { useState } from 'react';
import { X, Search, Plus, Minus, ShoppingCart, Check, Trash2 } from 'lucide-react';
import { System, BuffetItem } from '../types';
import { formatCurrency } from '../utils';

interface AddBuffetItemModalProps {
  system: System;
  buffetItems: BuffetItem[];
  isOpen: boolean;
  onClose: () => void;
  onAdd: (itemsSelected: { id: string; name: string; price: number; quantity: number }[]) => void;
  onRemoveAttachedItem?: (itemId: string) => void;
}

export default function AddBuffetItemModal({
  system,
  buffetItems,
  isOpen,
  onClose,
  onAdd,
  onRemoveAttachedItem,
}: AddBuffetItemModalProps) {
  const [search, setSearch] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'fridge' | 'cafe' | 'snack'>('all');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  if (!isOpen || !system.activeSession) return null;

  const session = system.activeSession;

  const filteredItems = buffetItems
    .filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategoryTab === 'all' || item.category === activeCategoryTab;
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

  const handleUpdateQty = (itemId: string, increment: boolean) => {
    const item = buffetItems.find((i) => i.id === itemId);
    if (!item) return;
    const current = quantities[itemId] || 0;
    let next = current;
    if (increment) {
      if (item.stock !== undefined) {
        next = Math.min(item.stock, current + 1);
      } else {
        next = current + 1;
      }
    } else {
      next = Math.max(0, current - 1);
    }
    setQuantities({
      ...quantities,
      [itemId]: next,
    });
  };

  const getActiveCount = (): number => {
    return (Object.values(quantities) as number[]).reduce((acc, q) => acc + q, 0);
  };

  const calculateSubtotal = () => {
    return (Object.entries(quantities) as [string, number][]).reduce((sum, [itemId, qty]) => {
      const p = buffetItems.find((i) => i.id === itemId);
      return sum + (p ? p.price * qty : 0);
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalItems = (Object.entries(quantities) as [string, number][])
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const item = buffetItems.find((i) => i.id === itemId)!;
        return {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: qty,
        };
      });

    if (finalItems.length === 0) {
      onClose();
      return;
    }

    onAdd(finalItems);
    setQuantities({});
    setSearch('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" dir="rtl">
      <div 
        className="w-full max-w-lg bg-[#151921] border border-white/5 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
        id="add-buffet-item-modal"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#0B0E14]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-tight">
            <ShoppingCart className="w-5 h-5 text-blue-400" />
            افزودن خوراکی به فاکتور - {system.name}
          </h3>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-[#0B0E14] border-b border-white/5 text-[11px]">
          <p className="text-slate-400 leading-6 mb-3">
             مورد نظر را به فاکتور مشتری فعال <strong>{session.customerName}</strong> اضافه کنید. محاسبه خودکار روی فاکتور نهایی و پایان سیستم اعمال خواهد شد.
          </p>

          {/* Currently attached items with removal option */}
          {session.buffetItems && session.buffetItems.length > 0 && (
            <div className="mb-3 p-2.5 bg-[#151921] border border-blue-500/20 rounded-xl space-y-1.5">
              <div className="flex justify-between items-center text-[10px] text-slate-300 font-bold">
                <span className="flex items-center gap-1">🍿 اقلام قبلی متصل به این سیستم ({session.buffetItems.length}):</span>
                <span className="text-amber-400 font-normal text-[9px]">حذف موارد ثبت‌شده اشتباه</span>
              </div>
              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                {session.buffetItems.map((attached) => (
                  <div key={attached.id} className="flex justify-between items-center bg-[#07090D] p-1.5 rounded-lg border border-white/5 text-[10px]">
                    <span className="text-slate-200">
                      {attached.name} <span className="text-slate-500">({attached.quantity} عدد)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-blue-400 font-bold">{formatCurrency(attached.price * attached.quantity)}</span>
                      {onRemoveAttachedItem && (
                        <button
                          type="button"
                          onClick={() => onRemoveAttachedItem(attached.id)}
                          className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded cursor-pointer transition-all"
                          title="حذف خوراکی اشتباهی و بازگشت به انبار"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="relative text-xs">
            <span className="absolute right-3 top-2.5 text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="جستجوی محصول (هایپ، چیپس و ...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-3 py-2 bg-[#151921] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs shadow-inner"
            />
          </div>

          {/* Categories Filter Pills */}
          <div className="flex flex-wrap items-center gap-1 bg-[#151921]/50 p-1 border border-white/5 rounded-lg mt-2.5">
            <button
              type="button"
              onClick={() => setActiveCategoryTab('all')}
              className={`px-2 py-1 rounded text-[9px] font-bold transition-all cursor-pointer ${
                activeCategoryTab === 'all'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              نمایش همه
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryTab('fridge')}
              className={`px-2 py-1 rounded text-[9px] font-bold transition-all cursor-pointer ${
                activeCategoryTab === 'fridge'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              🧊 یخچال
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryTab('cafe')}
              className={`px-2 py-1 rounded text-[9px] font-bold transition-all cursor-pointer ${
                activeCategoryTab === 'cafe'
                  ? 'bg-amber-600 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              ☕ کافه
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryTab('snack')}
              className={`px-2 py-1 rounded text-[9px] font-bold transition-all cursor-pointer ${
                activeCategoryTab === 'snack'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              🍿 خوردنی
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[40vh] overflow-y-auto space-y-3 text-xs">
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              محصولی با این نام در بوفه یافت نشد. می‌توانید از بخش بوفه محصول جدید تعریف کنید.
            </div>
          ) : (
            filteredItems.map((item) => {
              const qty = quantities[item.id] || 0;
              return (
                <div 
                  key={item.id} 
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    qty > 0 
                      ? 'bg-blue-500/5 border-blue-500/30' 
                      : 'bg-[#0B0E14]/40 border-white/5 hover:bg-white/5'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white block">{item.name}</span>
                      <span className="text-[7.5px] px-1 py-0.2 rounded font-bold border border-white/5 bg-[#0B0E14]">
                        {item.category === 'cafe' ? (
                          <span className="text-amber-400">كافه</span>
                        ) : item.category === 'snack' ? (
                          <span className="text-purple-400">خوردنی</span>
                        ) : (
                          <span className="text-emerald-400">یخچال</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-medium text-blue-400 font-mono">{formatCurrency(item.price)}</span>
                      {item.stock !== undefined && (
                        <span className={`text-[9px] font-mono font-semibold px-1 rounded ${
                          item.stock === 0 ? 'bg-rose-500/10 text-rose-450' : item.stock <= 3 ? 'bg-amber-500/10 text-amber-550' : 'bg-white/5 text-slate-400'
                        }`}>
                          {item.stock === 0 ? 'ناموجود' : `موجودی: ${item.stock}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity selector */}
                  <div className="flex items-center gap-3 bg-[#0B0E14] border border-white/10 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.id, false)}
                      className="p-1.5 rounded bg-[#151921] text-slate-400 hover:text-white transition-colors cursor-pointer"
                      disabled={qty === 0}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-slate-200 font-mono">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.id, true)}
                      className="p-1.5 rounded bg-[#151921] text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      disabled={item.stock !== undefined && qty >= item.stock}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer Summary */}
        <div className="p-4 border-t border-white/5 bg-[#0B0E14] flex justify-between items-center text-xs">
          <div className="text-right">
            <span className="text-slate-450 text-[10px] block">اقلام انتخاب شده: {getActiveCount()} عدد</span>
            <span className="text-blue-400 font-bold font-mono text-sm leading-none block mt-1">
              مجموع موقت بوفه: {formatCurrency(calculateSubtotal())}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={getActiveCount() === 0}
              onClick={handleSubmit}
              className={`px-5 py-2.5 font-bold rounded-xl transition-all text-xs flex items-center gap-1.5 cursor-pointer shadow-lg ${
                getActiveCount() > 0
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/10'
                  : 'bg-white/5 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>تأیید و افزودن</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-[#0B0E14] hover:bg-white/5 text-slate-400 hover:text-white rounded-xl transition-all border border-white/10 text-xs cursor-pointer"
            >
              انصراف
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
