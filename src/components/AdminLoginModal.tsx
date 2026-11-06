import React, { useState } from 'react';
import { X, Lock, User, Check, AlertCircle, ShieldCheck } from 'lucide-react';
import { Operator } from '../types';
import { verifyPasswordHash } from '../utils';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
  onOperatorLoginSuccess?: (operator: Operator) => void;
  adminPassword?: string;
  adminUsername?: string;
  operators?: Operator[];
  isMandatory?: boolean;
}

export default function AdminLoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
  onOperatorLoginSuccess,
  adminPassword = '123',
  adminUsername = 'admin',
  operators = [],
  isMandatory = false,
}: AdminLoginModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const inputUser = username.trim();
    const inputPass = password;

    // 1. Check Admin Credentials (supports plain text & SHA-256 hash)
    if (inputUser === adminUsername) {
      const isAdminPassValid = await verifyPasswordHash(inputPass, adminPassword);
      if (isAdminPassValid) {
        onLoginSuccess();
        setUsername('');
        setPassword('');
        onClose();
        return;
      }
    }

    // 2. Check Operator Credentials (supports plain text & SHA-256 hash)
    for (const op of operators) {
      if (op.username.trim().toLowerCase() === inputUser.toLowerCase()) {
        const isOpPassValid = await verifyPasswordHash(inputPass, op.password || '');
        if (isOpPassValid) {
          if (!op.isActive) {
            setError(`حساب کاربری اپراتور «${op.name}» غیرفعال گردیده است.`);
            return;
          }
          if (onOperatorLoginSuccess) {
            onOperatorLoginSuccess(op);
          }
          setUsername('');
          setPassword('');
          onClose();
          return;
        }
      }
    }

    setError('نام کاربری یا رمز عبور وارد شده صحیح نمی‌باشد.');
  };

  const isDemo = adminPassword === '123' && adminUsername === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
      <div 
        className="w-full max-w-sm bg-[#151921] border border-white/5 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 text-xs"
        id="admin-login-modal"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#0B0E14]">
          <h3 className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-tight">
            <Lock className="w-4 h-4 text-blue-500 animate-pulse" />
            <span>{isMandatory ? 'احراز هویت اجباری اپراتور / مدیریت' : 'ورود مدیر سیستم / اپراتور شیفت'}</span>
          </h3>
          {!isMandatory && (
            <button 
              type="button" 
              onClick={onClose}
              className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          {isMandatory && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              ورود اجباری
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-[10px] text-slate-400 leading-relaxed text-center bg-blue-500/5 p-3 rounded-lg border border-blue-500/10 mb-2 font-sans">
            {isMandatory 
              ? 'ورود به سامانه قفل می‌باشد. لطفاً نام‌کاربری و رمز عبور اپراتور یا مدیریت کل را وارد نمایید.'
              : 'لطفاً نام کاربری و رمز عبور (مدیریت کل یا اپراتور تعریف‌شده) را جهت احراز هویت وارد کنید.'}
          </p>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] rounded-lg flex items-start gap-2 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span>نام کاربری</span>
            </label>
            <input
              type="text"
              required
              placeholder="نام کاربری مدیریت یا اپراتور"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-[#0B0E14] border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-blue-400" />
              <span>رمز عبور</span>
            </label>
            <input
              type="password"
              required
              placeholder="رمز عبور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#0B0E14] border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-mono"
            />
          </div>

          <div className="flex gap-3 pt-3 border-t border-white/5 text-xs">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer shadow-lg shadow-blue-500/10"
            >
              <Check className="w-4 h-4" />
              <span>تأیید و شروع به کار</span>
            </button>
            {!isMandatory && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-[#0B0E14] hover:bg-white/5 text-slate-400 font-semibold rounded-xl border border-white/10 transition-all cursor-pointer"
              >
                انصراف
              </button>
            )}
          </div>

          {isDemo && (
            <div className="text-[9px] text-slate-500 text-center pt-2">
              مدیریت کل دمو: <span className="font-mono text-slate-400 font-bold">admin</span> / <span className="font-mono text-slate-400 font-bold">123</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
