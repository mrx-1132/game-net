import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// رفع باگ فوکوس در Electron/ویندوز: بعد از هر alert/confirm/prompt فوکوس پنجره را برمی‌گردانیم
(() => {
  const refocus = () => {
    try { (window as any).appBridge?.refocus?.(); } catch { /* ignore */ }
  };
  const origAlert = window.alert.bind(window);
  const origConfirm = window.confirm.bind(window);
  const origPrompt = window.prompt.bind(window);
  window.alert = (msg?: any) => { origAlert(msg); refocus(); };
  window.confirm = (msg?: string) => { const r = origConfirm(msg); refocus(); return r; };
  window.prompt = (msg?: string, def?: string) => { const r = origPrompt(msg, def); refocus(); return r; };
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
