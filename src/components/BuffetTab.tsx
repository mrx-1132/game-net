import React, { useState } from 'react';
import { 
  Search, Archive, PlusCircle, 
  Trash2, ShieldAlert, ChevronUp, ChevronDown, Star,
  Pencil, Check, X, Lock, Eye, EyeOff, Key
} from 'lucide-react';
import { BuffetItem, UserPermissions, Operator } from '../types';
import { formatCurrency } from '../utils';

interface BuffetTabProps {
  buffetItems: BuffetItem[];
  onAddBuffetItem: (name: string, price: number, cost?: number, stock?: number, category?: 'fridge' | 'cafe' | 'snack', priority?: number) => void;
  onRecordDirectSale?: (items: { id: string; name: string; price: number; quantity: number }[], customerName: string) => void;
  onDeleteBuffetItem?: (id: string) => void;
  onUpdateBuffetItemPriority?: (id: string, newPriority: number) => void;
  onUpdateBuffetItem?: (id: string, updates: Partial<BuffetItem>) => void;
  userRole?: 'admin' | 'user';
  userPermissions?: UserPermissions;
  operators?: Operator[];
  currentOperator?: Operator | null;
  adminPassword?: string;
}

export default function BuffetTab({
  buffetItems,
  onAddBuffetItem,
  onDeleteBuffetItem,
  onUpdateBuffetItemPriority,
  onUpdateBuffetItem,
  userRole = 'user',
  userPermissions,
  operators = [],
  currentOperator,
  adminPassword = '123',
}: BuffetTabProps) {
  const canEdit = userRole === 'admin' || !!userPermissions?.allowUserEdits;
  const [search, setSearch] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'fridge' | 'cafe' | 'snack'>('all');

  // Sensitive Password Authentication Modal State
  const [sensitiveAuthModal, setSensitiveAuthModal] = useState<{
    actionTitle: string;
    onSuccess: () => void;
  } | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);

  // Add Product form states
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCost, setNewItemCost] = useState('');
  const [newItemStock, setNewItemStock] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<'fridge' | 'cafe' | 'snack'>('fridge');
  const [newItemPriority, setNewItemPriority] = useState('');
  const [formError, setFormError] = useState('');

  // Editing Product states
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<'fridge' | 'cafe' | 'snack'>('fridge');
  const [editError, setEditError] = useState('');

  const handleConfirmSensitiveAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sensitiveAuthModal) return;

    const trimmedPass = authPassword.trim();
    if (!trimmedPass) {
      setAuthError('لطفاً رمز عبور را وارد نمایید.');
      return;
    }

    const isValid = 
      (adminPassword && trimmedPass === adminPassword) ||
      (currentOperator?.password && trimmedPass === currentOperator.password) ||
      (operators && operators.some((op) => op.isActive && op.password === trimmedPass));

    if (!isValid) {
      setAuthError('رمز عبور وارد شده اشتباه است!');
      return;
    }

    sensitiveAuthModal.onSuccess();
    setSensitiveAuthModal(null);
    setAuthPassword('');
    setAuthError('');
  };

  const handleDeleteItemWithAuth = (item: BuffetItem) => {
    setSensitiveAuthModal({
      actionTitle: `پاک کردن و حذف کالای «${item.name}» از بوفه`,
      onSuccess: () => {
        if (onDeleteBuffetItem) {
          onDeleteBuffetItem(item.id);
        }
      },
    });
  };

  const handleStartEdit = (item: BuffetItem) => {
    if (!canEdit) {
      alert('ویرایش و تغییر کالاها نیازمند مجوز مدیریت است. جهت فعال‌سازی برای اپراتور، به تنظیمات عمومی > سطح دسترسی اپراتور مراجعه فرمایید.');
      return;
    }
    setEditingItemId(item.id);
    setEditPrice(String(item.price));
    setEditCost(item.cost !== undefined ? String(item.cost) : '');
    setEditStock(item.stock !== undefined ? String(item.stock) : '');
    setEditName(item.name);
    setEditCategory(item.category || 'fridge');
    setEditError('');
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditError('');
  };

  const handleSaveEdit = (itemId: string) => {
    setEditError('');
    if (!editName.trim() || !editPrice.trim()) {
      setEditError('نام محصول و قیمت فروش الزامی است.');
      return;
    }
    const priceNum = Number(editPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setEditError('قیمت فروش باید عدد مثبت باشد.');
      return;
    }
    const costNum = editCost ? Number(editCost) : undefined;
    if (costNum !== undefined && (isNaN(costNum) || costNum < 0)) {
      setEditError('هزینه خرید نامعتبر است.');
      return;
    }
    const stockNum = editStock !== '' ? Number(editStock) : undefined;
    if (stockNum !== undefined && (isNaN(stockNum) || stockNum < 0)) {
      setEditError('موجودی نامعتبر است.');
      return;
    }

    if (onUpdateBuffetItem) {
      onUpdateBuffetItem(itemId, {
        name: editName.trim(),
        price: priceNum,
        cost: costNum,
        stock: stockNum,
        category: editCategory,
      });
    }
    setEditingItemId(null);
  };

  const filteredItems = buffetItems
    .filter((i) => {
      const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategoryTab === 'all' || i.category === activeCategoryTab;
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

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!canEdit) {
      setFormError('تعریف کالا و تغییرات انبار نیازمند مجوز مدیریت است. (از تنظیمات عمومی > سطح دسترسی اپراتور قابل فعال‌سازی است)');
      return;
    }

    if (!newItemName.trim() || !newItemPrice.trim() || !newItemCost.trim()) {
      setFormError('لطفاً نام محصول، قیمت فروش و قیمت خرید (هزینه خرید) آن را وارد نمایید.');
      return;
    }

    const price = Number(newItemPrice);
    const cost = Number(newItemCost);
    const stock = newItemStock ? Number(newItemStock) : undefined;
    const priority = newItemPriority ? Number(newItemPriority) : 0;

    if (isNaN(price) || price <= 0) {
      setFormError('قیمت فروش بازی باید بزرگتر از صفر باشد.');
      return;
    }

    if (isNaN(cost) || cost < 0) {
      setFormError('هزینه خرید کالا نامعتبر است.');
      return;
    }

    if (stock !== undefined && (isNaN(stock) || stock < 0)) {
      setFormError('تعداد موجودی نامعتبر است.');
      return;
    }

    if (isNaN(priority) || priority < 0) {
      setFormError('اولویت وارد شده باید یک عدد نامنفی معتبر باشد.');
      return;
    }

    onAddBuffetItem(newItemName.trim(), price, cost, stock, newItemCategory, priority);
    
    // Reset form
    setNewItemName('');
    setNewItemPrice('');
    setNewItemCost('');
    setNewItemStock('');
    setNewItemCategory('fridge');
    setNewItemPriority('');
    setFormError('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir="rtl">
      <div className="space-y-6">
        
        {/* Top Add New Product Section */}
        <div className="p-5 bg-surface-151921 border border-white/5 rounded-2xl space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Archive className="w-4 h-4 text-blue-400" />
            افزودن خوراکی یا جنس جدید به بوفه
          </h3>

          {formError && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleCreateProduct} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 text-xs items-end">
            <div className="lg:col-span-3 space-y-1">
              <label className="text-[10px] text-slate-400 block font-medium flex items-center gap-0.5">
                نام کالا (مثال: انرژی‌زا ردبول) <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                placeholder="عنوان نوشیدنی، خوراکی یا خدمات..."
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-surface-0b0e14 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="lg:col-span-2 space-y-1">
              <label className="text-[10px] text-slate-400 block font-medium flex items-center justify-center gap-0.5">
                قیمت فروش (تومان) <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="number"
                placeholder="الزامی (مثال: 55000)"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                required
                className="w-full px-3 py-2 bg-surface-0b0e14 border border-white/10 rounded-lg text-white placeholder-slate-500 font-mono text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              {newItemPrice && !isNaN(Number(newItemPrice)) && (
                <span className="text-[9px] text-[#2563EB] block font-mono font-bold mt-1 text-center">
                  {formatCurrency(Number(newItemPrice))}
                </span>
              )}
            </div>

            <div className="lg:col-span-2 space-y-1">
              <label className="text-[10px] text-slate-400 block font-medium flex items-center justify-center gap-0.5">
                هزینه خرید (تومان) <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="number"
                placeholder="الزامی (مثال: 35000)"
                value={newItemCost}
                onChange={(e) => setNewItemCost(e.target.value)}
                required
                className="w-full px-3 py-2 bg-surface-0b0e14 border border-white/10 rounded-lg text-white placeholder-slate-500 font-mono text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              {newItemCost && !isNaN(Number(newItemCost)) && (
                <span className="text-[9px] text-emerald-400 block font-mono font-bold mt-1 text-center">
                  {formatCurrency(Number(newItemCost))}
                </span>
              )}
            </div>

            <div className="lg:col-span-1 space-y-1">
              <label className="text-[10px] text-slate-400 block font-medium">موجودی</label>
              <input
                type="number"
                placeholder="بی‌نهایت"
                value={newItemStock}
                onChange={(e) => setNewItemStock(e.target.value)}
                className="w-full px-2 py-2 bg-surface-0b0e14 border border-white/10 rounded-lg text-white placeholder-slate-600 font-mono text-center focus:outline-none"
              />
            </div>

            <div className="lg:col-span-2 space-y-1">
              <label className="text-[10px] text-slate-400 block font-medium">بخش بوفه</label>
              <select
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value as any)}
                className="w-full px-3 py-2 bg-surface-0b0e14 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs cursor-pointer"
              >
                <option value="fridge">🧊 یخچال</option>
                <option value="cafe">☕ کافه</option>
                <option value="snack">🍿 خوردنی</option>
              </select>
            </div>

            <div className="lg:col-span-1 space-y-1">
              <label className="text-[10px] text-slate-400 block font-medium" title="اولویت نمایش در لیست (اولویت بالاتر در بالای لیست قرار می‌گیرد)">اولویت</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={newItemPriority}
                onChange={(e) => setNewItemPriority(e.target.value)}
                className="w-full px-2 py-2 bg-surface-0b0e14 border border-white/10 rounded-lg text-white placeholder-slate-600 font-mono text-center focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="lg:col-span-1 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm mt-3 sm:mt-0 cursor-pointer text-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>ثبت</span>
            </button>
          </form>
        </div>

        {/* Product Cards Catalog Shelf */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">ویترین بوفه گیم‌نت</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                مدیریت موجودی، قیمت خرید و قیمت فروش خوراکی‌ها و خدمات بوفه
              </p>
            </div>

            {/* Shelf Search */}
            <div className="relative text-xs w-full sm:w-64">
              <span className="absolute right-3 top-2 text-slate-500">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="جستجوی کالا در قفسه بوفه..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-8 pl-3 py-1.5 bg-surface-151921 border border-white/10 rounded-lg text-white placeholder-slate-550 focus:outline-none text-xs"
              />
            </div>
          </div>

          {/* Category Sub-tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-surface-0b0e14/40 p-1 border border-white/5 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveCategoryTab('all')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                activeCategoryTab === 'all'
                  ? 'bg-blue-600 text-white shadow font-black'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              📥 نمایش همه
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryTab('fridge')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                activeCategoryTab === 'fridge'
                  ? 'bg-emerald-600 text-white shadow font-black'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              🧊 1. یخچال
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryTab('cafe')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                activeCategoryTab === 'cafe'
                  ? 'bg-amber-600 text-slate-950 shadow font-black'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              ☕ 2. کافه
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryTab('snack')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                activeCategoryTab === 'snack'
                  ? 'bg-purple-600 text-white shadow font-black'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              🍿 3. خوردنی
            </button>
          </div>

          {/* Catalog Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredItems.length === 0 ? (
              <div className="col-span-full text-center py-16 border border-dashed border-white/10 rounded-2xl text-slate-500 text-xs">
                محصولی در لیست بوفه ثبت نشده است یا با فیلتر هماهنگ نیست.
              </div>
            ) : (
              filteredItems.map((item) => {
                const isEditing = editingItemId === item.id;

                if (isEditing) {
                  return (
                    <div 
                      key={item.id}
                      className="p-3.5 rounded-xl border border-blue-500/70 bg-surface-121620 space-y-3 shadow-xl ring-1 ring-blue-500/30 animate-in fade-in duration-150"
                    >
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-[11px] font-bold text-blue-400 flex items-center gap-1.5">
                          <Pencil className="w-3.5 h-3.5" />
                          ویرایش کالا و تغییر قیمت
                        </span>
                        <button 
                          type="button" 
                          onClick={handleCancelEdit} 
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {editError && (
                        <div className="text-[10px] text-rose-300 bg-rose-500/15 p-2 rounded-lg border border-rose-500/30 font-medium">
                          {editError}
                        </div>
                      )}

                      <div className="space-y-2.5 text-[10px]">
                        <div>
                          <label className="text-slate-300 block mb-1 font-semibold flex items-center gap-0.5">
                            نام کالا <span className="text-rose-500 font-bold">*</span>
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            required
                            className="w-full px-2.5 py-1.5 bg-surface-080a0f border border-white/15 rounded-lg text-white text-xs font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-blue-400 font-bold flex items-center gap-0.5">
                              قیمت فروش (تومان) <span className="text-rose-500 font-bold">*</span>
                            </label>
                            {editPrice && !isNaN(Number(editPrice)) && (
                              <span className="text-[10px] text-blue-300 font-mono font-bold">
                                {formatCurrency(Number(editPrice))}
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            required
                            className="w-full px-2.5 py-1.5 bg-surface-080a0f border border-blue-500/60 rounded-lg text-blue-300 font-mono text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          {/* Quick Price Adjust Buttons */}
                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            <span className="text-[9px] text-slate-400">تغییر سریع:</span>
                            {[1000, 5000, 10000, 50000].map((amt) => (
                              <button
                                key={`plus-${amt}`}
                                type="button"
                                onClick={() => {
                                  const current = Number(editPrice) || 0;
                                  setEditPrice(String(Math.max(0, current + amt)));
                                }}
                                className="px-1.5 py-0.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 rounded text-[9px] font-mono cursor-pointer transition-colors"
                              >
                                +{amt.toLocaleString('fa-IR')}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-slate-300 block mb-1 font-medium">هزینه خرید (تومان)</label>
                            <input
                              type="number"
                              value={editCost}
                              onChange={(e) => setEditCost(e.target.value)}
                              placeholder="اختیاری"
                              className="w-full px-2.5 py-1.5 bg-surface-080a0f border border-white/15 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="text-slate-300 block mb-1 font-medium">موجودی انبار</label>
                            <input
                              type="number"
                              value={editStock}
                              onChange={(e) => setEditStock(e.target.value)}
                              placeholder="نامحدود"
                              className="w-full px-2.5 py-1.5 bg-surface-080a0f border border-white/15 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-slate-300 block mb-1 font-medium">دسته‌بندی بوفه</label>
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value as any)}
                            className="w-full px-2.5 py-1.5 bg-surface-080a0f border border-white/15 rounded-lg text-slate-200 text-xs focus:outline-none cursor-pointer"
                          >
                            <option value="fridge">🧊 یخچال</option>
                            <option value="cafe">☕ کافه</option>
                            <option value="snack">🍿 خوردنی</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(item.id)}
                          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>ذخیره قیمت</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 bg-surface-080a0f hover:bg-white/10 text-slate-300 text-xs rounded-lg border border-white/15 transition-all cursor-pointer"
                        >
                          انصراف
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={item.id}
                    className="p-3.5 rounded-xl border bg-surface-151921 border-white/10 hover:border-blue-500/30 flex flex-col justify-between transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1">
                          {(item.priority || 0) > 0 && (
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" title={`اولویت: ${item.priority}`} />
                          )}
                          <span className="text-xs font-bold text-white block leading-relaxed">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.priority && item.priority > 0 ? (
                            <span className="text-[8px] px-1 py-0.5 rounded font-black border border-amber-500/20 bg-amber-500/10 text-amber-400 shrink-0">
                              ⭐️ {item.priority}
                            </span>
                          ) : null}
                          <span className="text-[8px] px-1.5 py-0.5 rounded shrink-0 font-bold border border-white/5 bg-surface-0b0e14 text-slate-400">
                            {item.category === 'cafe' ? (
                              <span className="text-amber-400">☕ کافه</span>
                            ) : item.category === 'snack' ? (
                              <span className="text-purple-400">🍿 خوردنی</span>
                            ) : (
                              <span className="text-emerald-400">🧊 یخچال</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Price & Quick Edit Button Area */}
                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/5">
                        <div>
                          <span className="text-[9px] text-slate-400 block font-medium">قیمت فروش:</span>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item)}
                            className="text-xs font-black font-mono text-blue-400 hover:text-blue-300 block transition-colors cursor-pointer"
                            title="کلیک کنید تا قیمت تغییر کند"
                          >
                            {formatCurrency(item.price)}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="px-2 py-1 bg-blue-500/10 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                          title="تغییر سریع قیمت محصول"
                        >
                          <Pencil className="w-3 h-3 text-blue-400" />
                          <span>تغییر قیمت</span>
                        </button>
                      </div>

                      {item.stock !== undefined && (
                        <div className="flex items-center gap-1 text-[10px] font-mono pt-0.5">
                          <span className="text-slate-400">موجودی:</span>
                          <span className={`font-bold ${item.stock === 0 ? 'text-rose-400' : item.stock <= 3 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
                            {item.stock === 0 ? '❌ ناموجود' : `${item.stock} عدد`}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2.5 flex items-center justify-between gap-2 border-t border-white/10 mt-3 text-xs">
                      <div className="flex items-center gap-1">
                        {onDeleteBuffetItem && (
                          <button
                            type="button"
                            onClick={() => handleDeleteItemWithAuth(item)}
                            className="p-1.5 hover:bg-rose-500/15 hover:text-rose-400 text-slate-400 rounded-lg transition-colors cursor-pointer"
                            title="حذف کالا"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {onUpdateBuffetItemPriority && (
                        <div className="flex items-center gap-1 bg-surface-0b0e14 border border-white/10 rounded-lg p-0.5 text-slate-400" title="اولویت نمایش">
                          <button
                            type="button"
                            onClick={() => onUpdateBuffetItemPriority(item.id, Math.max(0, (item.priority || 0) - 1))}
                            className="p-1 hover:bg-white/5 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer"
                            title="کاهش اولویت"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                          <span 
                            className={`px-1 font-mono text-[9px] font-bold select-none flex items-center gap-0.5 ${
                              (item.priority || 0) > 0 ? 'text-amber-400 font-extrabold' : 'text-slate-500'
                            }`}
                          >
                            {(item.priority || 0) > 0 && <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />}
                            {item.priority || 0}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateBuffetItemPriority(item.id, (item.priority || 0) + 1)}
                            className="p-1 hover:bg-white/5 text-slate-400 hover:text-emerald-400 rounded transition-colors cursor-pointer"
                            title="افزایش اولویت"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Sensitive Password Modal for Buffet Tab */}
      {sensitiveAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in" style={{ direction: 'rtl' }}>
          <div className="bg-surface-121620 border border-amber-500/40 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl p-6 space-y-5 relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                <span>تأیید تغییرات حساس (ورود رمز عبور)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSensitiveAuthModal(null);
                  setAuthPassword('');
                  setAuthError('');
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1 text-right">
              <p className="text-xs font-bold text-amber-300">
                {sensitiveAuthModal.actionTitle}
              </p>
              <p className="text-[10.5px] text-slate-300 leading-relaxed mt-1">
                این عملیات جزو تغییرات حساس سیستم است. جهت ادامه لطفاً رمز عبور اپراتور شیفت یا مدیریت را وارد کنید.
              </p>
            </div>

            {authError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2 font-bold text-right">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmSensitiveAuth} className="space-y-4 text-right">
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1.5">رمز عبور اپراتور یا مدیر کل:</label>
                <div className="relative">
                  <input
                    type={showAuthPassword ? "text" : "password"}
                    value={authPassword}
                    onChange={(e) => {
                      setAuthPassword(e.target.value);
                      setAuthError('');
                    }}
                    className="w-full bg-surface-080a0f border border-white/10 focus:border-amber-500 rounded-xl px-3 py-2.5 pl-10 text-xs text-white font-mono focus:outline-none"
                    placeholder="رمز عبور را وارد کنید..."
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthPassword(!showAuthPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-1"
                  >
                    {showAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-950/20 flex items-center justify-center gap-1.5"
                >
                  <Key className="w-4 h-4" />
                  <span>تأیید و اجرای عملیات</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSensitiveAuthModal(null);
                    setAuthPassword('');
                    setAuthError('');
                  }}
                  className="px-4 py-2.5 bg-surface-080a0f hover:bg-white/10 text-slate-300 text-xs rounded-xl border border-white/10 transition-all cursor-pointer font-bold"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

