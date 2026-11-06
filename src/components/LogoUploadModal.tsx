import React, { useState, useRef } from 'react';
import { X, Upload, Trash2, Image, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';

interface LogoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLogo?: string;
  onSaveLogo: (logoDataUrl: string | undefined) => void;
  userRole?: 'admin' | 'user';
}

export default function LogoUploadModal({
  isOpen,
  onClose,
  currentLogo,
  onSaveLogo,
  userRole = 'user',
}: LogoUploadModalProps) {
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentLogo);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    setSuccessMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation 1: Supported image extensions/formats
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    const lowerName = file.name.toLowerCase();
    const hasValidExt = /\.(png|jpe?g|webp|svg)$/i.test(lowerName);

    if (!validTypes.includes(file.type) && !hasValidExt) {
      setErrorMsg('فرمت فایل نامعتبر است. فقط پسوندهای تصویری PNG، JPG، WEBP یا SVG مجاز هستند.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validation 2: File size (limit to 1.5MB for snappy localStorage performance)
    if (file.size > 1.5 * 1024 * 1024) {
      setErrorMsg('حجم تصویر بیش از حد مجاز است. لطفاً لوگویی با حجم کمتر از ۱.۵ مگابایت انتخاب کنید.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Process file & dimension check
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const resultDataUrl = readerEvent.target?.result as string;

      // Check aspect ratio and dimensions using Image object
      const img = new window.Image();
      img.onload = () => {
        const width = img.width;
        const height = img.height;

        // Ratio verification: square or close to 1:1 ratio (0.75 to 1.33)
        const ratio = width / height;
        if (ratio < 0.6 || ratio > 1.6) {
          setErrorMsg(
            `نسبت ابعاد تصویر انتخابی (${width}x${height}) با کادر لوگو (۱:۱ مربعی) همخوانی ندارد. لطفاً تصویر لوگوی مربعی انتخاب فرمایید.`
          );
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        setPreviewUrl(resultDataUrl);
        setSuccessMsg('تصویر با موفقیت بارگذاری و تایید شد. برای ذخیره روی دکمه ذخیره کلیک کنید.');
      };

      img.onerror = () => {
        setErrorMsg('خطا در پردازش فایل تصویر. لطفاً تصویر دیگری انتخاب کنید.');
        if (fileInputRef.current) fileInputRef.current.value = '';
      };

      img.src = resultDataUrl;
    };

    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (userRole !== 'admin') {
      setErrorMsg('تغییر لوگو فقط توسط مدیریت کل سیستم امکان‌پذیر است.');
      return;
    }
    onSaveLogo(previewUrl);
    setSuccessMsg('لوگوی سامانه با موفقیت ثبت و ذخیره شد.');
    setTimeout(() => {
      onClose();
    }, 800);
  };

  const handleResetToDefault = () => {
    if (userRole !== 'admin') {
      setErrorMsg('تغییر لوگو فقط توسط مدیریت کل سیستم امکان‌پذیر است.');
      return;
    }
    setPreviewUrl(undefined);
    onSaveLogo(undefined);
    setSuccessMsg('لوگو به حالت پیش‌فرض سامانه بازگردانی شد.');
    setTimeout(() => {
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-md bg-[#151921] border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150 text-right text-xs">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#0B0E14]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Image className="w-4 h-4 text-blue-400" />
            <span>تغییر و بارگذاری لوگوی سامانه</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {userRole !== 'admin' ? (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
              <span>فقط کاربر «مدیریت کل» مجوز تعویض لوگوی اصلی سامانه را دارد.</span>
            </div>
          ) : (
            <>
              {/* Preview Box with exact frame matching standard logo */}
              <div className="p-4 bg-[#0B0E14] border border-white/5 rounded-xl flex flex-col items-center justify-center gap-3">
                <span className="text-[10.5px] text-slate-400 font-medium">پیش‌نمایش در ابعاد استاندارد هدر:</span>
                
                <div className="flex items-center gap-3 p-3 bg-[#0F1219] rounded-xl border border-white/10">
                  {previewUrl ? (
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/30 shrink-0 border border-white/10">
                      <img
                        src={previewUrl}
                        alt="لوگوی سفارشی"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="w-11 h-11 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-900/30 shrink-0 flex items-center justify-center">
                      <Image className="w-6 h-6 stroke-[2]" />
                    </div>
                  )}
                  <div className="text-right">
                    <div className="text-white text-xs font-black">گیم‌نت و باشگاه بازی</div>
                    <div className="text-[9px] text-slate-400 font-mono">اندازه هماهنگ هدر (44x44 پیکسل)</div>
                  </div>
                </div>
              </div>

              {/* Upload Specifications Info */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-1 text-blue-300 text-[10px]">
                <div className="font-bold flex items-center gap-1 text-blue-200">
                  <span>شرایط و استانداردهای لوگو:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 opacity-90 leading-relaxed">
                  <li><strong>پسوندهای مجاز:</strong> PNG، JPG، JPEG، WEBP یا SVG</li>
                  <li><strong>ابعاد و نسبت:</strong> ترجیحاً مربعی ۱:۱ (مثلاً 256x256 یا 512x512 پیکسل)</li>
                  <li><strong>حجم مجاز:</strong> حداکثر ۱.۵ مگابایت جهت سرعت اجرای بالا</li>
                </ul>
              </div>

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                className="hidden"
              />

              {/* File selection triggers */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-blue-900/30"
                >
                  <Upload className="w-4 h-4" />
                  <span>انتخاب فایل تصویر لوگو</span>
                </button>

                {previewUrl && (
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="px-3 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                    title="حذف لوگوی اختصاصی و بازگشت به آیکون پیش‌فرض"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>پیش‌فرض</span>
                  </button>
                )}
              </div>

              {/* Feedback messages */}
              {errorMsg && (
                <div className="p-2.5 bg-rose-500/15 border border-rose-500/25 text-rose-300 text-[10px] rounded-lg leading-relaxed flex items-start gap-1.5 font-medium">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[10px] rounded-lg flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0B0E14] border-t border-white/5 flex gap-2 justify-end">
          {userRole === 'admin' && (
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/30"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>ثبت و اعمال لوگو</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl border border-white/10 transition-all cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}
