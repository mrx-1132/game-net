/**
 * سرویس لایسنس سمت رابط کاربری
 *
 * - برنامه دسکتاپ: همه چیز در main process الکترون انجام می‌شود (electron/license.cjs)
 *   و این فایل فقط وضعیت را از طریق window.licenseBridge می‌گیرد. چیزی در localStorage
 *   تصمیم نمی‌گیرد.
 * - نسخه وب (بدون الکترون): مستقیم با سرور لایسنس صحبت می‌کند. این حالت ضعیف‌تر است
 *   چون مرورگر قابل اعتماد نیست؛ برای فروش از نسخه دسکتاپ استفاده کنید.
 * - پنل مدیر (admin.html): توابع Admin* با API مدیریت سرور کار می‌کنند.
 */

export type SubscriptionType = '6months' | '12months' | 'custom' | 'lifetime';

export interface LicenseUser {
  id: string;
  username: string;
  businessName: string;
  ownerName: string;
  phoneNumber: string;
  subscriptionType: SubscriptionType;
  startDateISO: string;
  endDateISO: string;
  status: 'active' | 'suspended' | 'expired';
  rawStatus?: 'active' | 'suspended';
  isExpired?: boolean;
  maxDevices?: number;
  deviceCount?: number;
  features?: { remote: boolean };
  createdAtISO?: string;
}

export type LicenseState =
  | 'loading'
  | 'active'
  | 'none'
  | 'invalid'
  | 'device_mismatch'
  | 'clock'
  | 'offline_expired'
  | 'expired'
  | 'suspended'
  | 'device_revoked'
  | 'no_public_key';

export interface LicenseStatus {
  state: LicenseState;
  message?: string;
  license?: Omit<LicenseUser, 'status'>;
  features?: { remote: boolean };
  tokenExpiresAt?: string;
  lastSync?: number | null;
}

export interface LicenseBridge {
  status: () => Promise<LicenseStatus>;
  activate: (username: string, password: string) => Promise<{ ok: boolean; message?: string; status?: LicenseStatus | string }>;
  refresh: () => Promise<{ ok: boolean; offline?: boolean; message?: string; status: LicenseStatus }>;
  logout: () => Promise<LicenseStatus>;
  onChange: (cb: (s: LicenseStatus) => void) => () => void;
}

declare global {
  interface Window {
    licenseBridge?: LicenseBridge;
  }
}

const KEYS = {
  WEB_TOKEN: 'gamenet_web_license_token_v3',
  WEB_DEVICE: 'gamenet_web_device_id_v3',
  ADMIN_TOKEN: 'gamenet_admin_token_v3',
  CUSTOM_SERVER_URL: 'gamenet_custom_license_server_url',
};

const safeGet = (store: Storage, k: string) => { try { return store.getItem(k); } catch { return null; } };
const safeSet = (store: Storage, k: string, v: string | null) => {
  try { if (v == null) store.removeItem(k); else store.setItem(k, v); } catch { /* ignore */ }
};

// ---------------------------------------------------------------------------
// Server URL
// ---------------------------------------------------------------------------
export const DEFAULT_LICENSE_API_URL: string =
  (import.meta.env.VITE_LICENSE_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  (typeof location !== 'undefined' && location.protocol.startsWith('http') ? location.origin : '');

export function getLicenseApiBaseUrl(): string {
  return safeGet(localStorage, KEYS.CUSTOM_SERVER_URL) || DEFAULT_LICENSE_API_URL;
}

export function setCustomLicenseServerUrl(url: string): void {
  safeSet(localStorage, KEYS.CUSTOM_SERVER_URL, url.trim() ? url.trim().replace(/\/+$/, '') : null);
}

async function api<T = any>(path: string, init: RequestInit = {}, token?: string | null): Promise<{ httpStatus: number; data: T }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${getLicenseApiBaseUrl()}/api${path}`, { ...init, headers: { ...headers, ...(init.headers as any) } });
  const data = await res.json().catch(() => ({}));
  return { httpStatus: res.status, data };
}

// ---------------------------------------------------------------------------
// Client (the gamenet app)
// ---------------------------------------------------------------------------
const DEV_BYPASS = import.meta.env.DEV && import.meta.env.VITE_LICENSE_DEV_BYPASS === 'true';

const DEV_STATUS: LicenseStatus = {
  state: 'active',
  license: {
    id: 'dev', username: 'dev', businessName: 'حالت توسعه (بدون لایسنس)', ownerName: '', phoneNumber: '',
    subscriptionType: 'lifetime', startDateISO: new Date().toISOString(), endDateISO: '2099-12-31T00:00:00.000Z',
  },
  features: { remote: true },
};

export function hasDesktopLicense(): boolean {
  return typeof window !== 'undefined' && !!window.licenseBridge;
}

// --- web fallback (unverified, online check on every start) ---
function webDeviceId(): string {
  let id = safeGet(localStorage, KEYS.WEB_DEVICE);
  if (!id || !/^[a-f0-9]{64}$/.test(id)) {
    const b = new Uint8Array(32);
    crypto.getRandomValues(b);
    id = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    safeSet(localStorage, KEYS.WEB_DEVICE, id);
  }
  return id;
}

function decodeWebToken(token: string | null): LicenseStatus {
  if (!token) return { state: 'none' };
  try {
    const p = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
    const license = {
      id: p.lid, username: p.usr, businessName: p.bn, ownerName: p.own || '', phoneNumber: p.ph || '',
      subscriptionType: p.plan, startDateISO: p.start, endDateISO: p.end || '2099-12-31T00:00:00.000Z',
    };
    if (Date.now() > p.exp) return { state: p.end && Date.now() > Date.parse(p.end) ? 'expired' : 'offline_expired', license };
    return { state: 'active', license, features: p.feat, tokenExpiresAt: new Date(p.exp).toISOString() };
  } catch {
    return { state: 'invalid' };
  }
}

const webStatusFromServer = (data: any): LicenseStatus | null =>
  ['expired', 'suspended', 'device_revoked'].includes(data?.status) ? { state: data.status, message: data.message } : null;

export async function getLicenseStatus(): Promise<LicenseStatus> {
  if (DEV_BYPASS) return DEV_STATUS;
  if (window.licenseBridge) return window.licenseBridge.status();
  return decodeWebToken(safeGet(localStorage, KEYS.WEB_TOKEN));
}

export async function activateLicense(username: string, password: string): Promise<{ ok: boolean; message?: string }> {
  if (window.licenseBridge) {
    const r = await window.licenseBridge.activate(username, password);
    return { ok: r.ok, message: r.message };
  }
  try {
    const { data } = await api('/license/activate', {
      method: 'POST',
      body: JSON.stringify({ username, password, deviceId: webDeviceId(), deviceName: 'مرورگر' }),
    });
    if (data.success && data.token) {
      safeSet(localStorage, KEYS.WEB_TOKEN, data.token);
      return { ok: true };
    }
    return { ok: false, message: data.message || 'فعال‌سازی ناموفق بود.' };
  } catch {
    return { ok: false, message: 'اتصال به سرور لایسنس برقرار نشد.' };
  }
}

export async function refreshLicense(): Promise<{ ok: boolean; message?: string; status: LicenseStatus }> {
  if (DEV_BYPASS) return { ok: true, status: DEV_STATUS };
  if (window.licenseBridge) return window.licenseBridge.refresh();
  const token = safeGet(localStorage, KEYS.WEB_TOKEN);
  if (!token) return { ok: false, status: { state: 'none' } };
  try {
    const { data } = await api('/license/refresh', { method: 'POST', body: JSON.stringify({ token, deviceId: webDeviceId() }) });
    if (data.success && data.token) {
      safeSet(localStorage, KEYS.WEB_TOKEN, data.token);
      return { ok: true, status: decodeWebToken(data.token) };
    }
    const blocked = webStatusFromServer(data);
    if (blocked) return { ok: false, message: data.message, status: blocked };
    if (data.status === 'invalid' || data.status === 'not_found') safeSet(localStorage, KEYS.WEB_TOKEN, null);
    return { ok: false, message: data.message, status: await getLicenseStatus() };
  } catch {
    return { ok: false, message: 'اتصال به سرور لایسنس برقرار نشد.', status: await getLicenseStatus() };
  }
}

export async function logoutLicense(): Promise<void> {
  if (window.licenseBridge) {
    await window.licenseBridge.logout();
    return;
  }
  const token = safeGet(localStorage, KEYS.WEB_TOKEN);
  if (token) {
    await api('/license/deactivate', { method: 'POST', body: JSON.stringify({ token, deviceId: webDeviceId() }) }).catch(() => {});
  }
  safeSet(localStorage, KEYS.WEB_TOKEN, null);
}

export function onLicenseChange(cb: (s: LicenseStatus) => void): () => void {
  return window.licenseBridge ? window.licenseBridge.onChange(cb) : () => {};
}

export function statusToUser(s: LicenseStatus): LicenseUser | null {
  if (!s.license) return null;
  const status: LicenseUser['status'] = s.state === 'suspended' ? 'suspended' : s.state === 'expired' ? 'expired' : 'active';
  return { ...s.license, status, features: s.features };
}

/**
 * قفل «پیشخوان توسعه‌دهنده» داخل برنامه (تنظیمات پیامک و ...).
 * فقط با نام کاربری/رمز مدیر خود برنامه باز می‌شود؛ هیچ رمز پیش‌فرض یا عمومی ندارد.
 */
export function verifyConsoleAdmin(username: string, password: string, appAdminUsername: string, appAdminPassword: string): boolean {
  if (!appAdminPassword) return false;
  return username.trim().toLowerCase() === appAdminUsername.trim().toLowerCase() && password === appAdminPassword;
}

// ---------------------------------------------------------------------------
// Admin panel (admin.html) -> license server
// ---------------------------------------------------------------------------
export function getStoredAdminToken(): string | null {
  return safeGet(sessionStorage, KEYS.ADMIN_TOKEN);
}

export function setStoredAdminToken(token: string | null): void {
  safeSet(sessionStorage, KEYS.ADMIN_TOKEN, token);
}

function adminCall<T = any>(path: string, init: RequestInit = {}) {
  return api<T>(path, init, getStoredAdminToken());
}

export async function loginAdmin(
  username: string,
  password: string,
  code?: string
): Promise<{ success: boolean; message: string; token?: string; needCode?: boolean }> {
  try {
    const { data } = await api('/admin/login', { method: 'POST', body: JSON.stringify({ username, password, code: code || undefined }) });
    return { success: !!data.success, message: data.message || '', token: data.token, needCode: !!data.needCode };
  } catch {
    return { success: false, message: 'اتصال به سرور لایسنس برقرار نشد.' };
  }
}

// ---- ورود دومرحله‌ای (TOTP) ----
export async function getAdmin2fa(): Promise<{ enabled: boolean }> {
  const { data } = await adminCall('/admin/2fa');
  return { enabled: !!data.enabled };
}

export async function startAdmin2faSetup(): Promise<{ success: boolean; message?: string; secret?: string; uri?: string }> {
  const { data } = await adminCall('/admin/2fa/setup', { method: 'POST', body: '{}' });
  return data;
}

export async function enableAdmin2fa(code: string): Promise<{ success: boolean; message: string }> {
  const { data } = await adminCall('/admin/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) });
  return data;
}

export async function disableAdmin2fa(password: string, code: string): Promise<{ success: boolean; message: string }> {
  const { data } = await adminCall('/admin/2fa/disable', { method: 'POST', body: JSON.stringify({ password, code }) });
  return data;
}

export function logoutAdmin(): void {
  setStoredAdminToken(null);
}

export async function fetchAdminLicenses(): Promise<LicenseUser[]> {
  const { httpStatus, data } = await adminCall('/admin/licenses');
  if (httpStatus === 401) throw new Error('401: نشست مدیریت منقضی شده است.');
  if (!data.success) throw new Error(data.message || 'خطا در دریافت لیست لایسنس‌ها.');
  return data.licenses;
}

export async function createAdminLicense(payload: {
  username: string;
  password: string;
  businessName: string;
  ownerName?: string;
  phoneNumber?: string;
  subscriptionType?: SubscriptionType;
  customDays?: number;
  status?: 'active' | 'suspended';
  maxDevices?: number;
  features?: { remote: boolean };
}): Promise<{ success: boolean; message: string; license?: LicenseUser }> {
  const { data } = await adminCall('/admin/licenses', { method: 'POST', body: JSON.stringify(payload) });
  return data;
}

export async function updateAdminLicense(
  id: string,
  updates: Partial<Omit<LicenseUser, 'status'>> & { status?: 'active' | 'suspended' | 'expired'; password?: string }
): Promise<{ success: boolean; message: string; license?: LicenseUser }> {
  const { data } = await adminCall(`/admin/licenses/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(updates) });
  return data;
}

export async function deleteAdminLicense(id: string): Promise<{ success: boolean; message: string }> {
  const { data } = await adminCall(`/admin/licenses/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return data;
}

export interface LicenseDevice {
  id: string;
  name: string;
  activatedAt: string;
  lastSeen: string | null;
  lastIp: string;
}

export async function fetchLicenseDevices(licenseId: string): Promise<LicenseDevice[]> {
  const { data } = await adminCall(`/admin/licenses/${encodeURIComponent(licenseId)}/devices`);
  if (!data.success) throw new Error(data.message || 'خطا در دریافت دستگاه‌ها.');
  return data.devices;
}

export async function revokeLicenseDevice(deviceId: string): Promise<{ success: boolean; message: string }> {
  const { data } = await adminCall(`/admin/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' });
  return data;
}

/** دانلود فایل بکاپ کامل (لایسنس‌ها + دستگاه‌ها) برای انتقال به سرور جدید */
export async function downloadLicenseBackup(): Promise<void> {
  const { httpStatus, data } = await adminCall('/admin/backup');
  if (httpStatus !== 200) throw new Error(data?.message || 'خطا در دریافت بکاپ.');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gamenet-licenses-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** جایگزینی کامل دیتابیس این سرور با محتوای فایل بکاپ */
export async function restoreLicenseBackup(file: File): Promise<{ success: boolean; message: string }> {
  let backup: unknown;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    return { success: false, message: 'فایل انتخاب‌شده JSON معتبر نیست.' };
  }
  const { data } = await adminCall('/admin/restore', { method: 'POST', body: JSON.stringify({ confirm: 'REPLACE_ALL', backup }) });
  return data;
}

// ---------------------------------------------------------------------------
// Online updates (admin panel)
// ---------------------------------------------------------------------------
export type UpdateTarget = { type: 'all' } | { type: 'licenses'; ids: string[] };

export interface UpdateRelease {
  version: string;
  notes: string;
  createdAt: string;
  active: boolean;
  target: UpdateTarget;
  files: Record<string, { name: string; size: number; sha512: string }>;
  downloads: number;
}

export async function fetchUpdateReleases(): Promise<UpdateRelease[]> {
  const { data } = await adminCall('/admin/updates');
  if (!data.success) throw new Error(data.message || 'خطا در دریافت لیست آپدیت‌ها.');
  return data.releases;
}

/** آپلود یک فایل نصب با نمایش درصد پیشرفت */
export function uploadUpdateFile(version: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const q = `version=${encodeURIComponent(version)}&name=${encodeURIComponent(file.name)}`;
    xhr.open('POST', `${getLicenseApiBaseUrl()}/api/admin/updates/upload?${q}`);
    xhr.setRequestHeader('Authorization', `Bearer ${getStoredAdminToken() || ''}`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let msg = '';
      try { msg = JSON.parse(xhr.responseText).message || ''; } catch { /* ignore */ }
      if (xhr.status === 200) resolve();
      else if (xhr.status === 413) reject(new Error('حجم فایل برای سرور زیاد است (تنظیم Nginx). اسکریپت نصب سرور را دوباره اجرا کنید.'));
      else reject(new Error(msg || `خطای آپلود (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('اتصال در حین آپلود قطع شد.'));
    xhr.send(file);
  });
}

export async function publishUpdate(manifest: string, signature: string, target: UpdateTarget): Promise<{ success: boolean; message: string }> {
  const { data } = await adminCall('/admin/updates', { method: 'POST', body: JSON.stringify({ manifest, signature, target }) });
  return data;
}

export async function patchUpdateRelease(version: string, patch: { active?: boolean; target?: UpdateTarget }): Promise<{ success: boolean; message: string }> {
  const { data } = await adminCall(`/admin/updates/${encodeURIComponent(version)}`, { method: 'PATCH', body: JSON.stringify(patch) });
  return data;
}

export async function deleteUpdateRelease(version: string): Promise<{ success: boolean; message: string }> {
  const { data } = await adminCall(`/admin/updates/${encodeURIComponent(version)}`, { method: 'DELETE' });
  return data;
}

// ---- اپ اندروید ریموت روی سرور (/remote.apk) ----
export interface AndroidApkInfo { originalName: string; note: string; size: number; sha256: string; uploadedAt: string; downloads: number }

export async function fetchAndroidApk(): Promise<AndroidApkInfo | null> {
  const { data } = await adminCall('/admin/android');
  return data.apk || null;
}

export function uploadAndroidApk(file: File, note: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getLicenseApiBaseUrl()}/api/admin/android/upload?name=${encodeURIComponent(file.name)}&note=${encodeURIComponent(note)}`);
    xhr.setRequestHeader('Authorization', `Bearer ${getStoredAdminToken() || ''}`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let msg = '';
      try { msg = JSON.parse(xhr.responseText).message || ''; } catch { /* ignore */ }
      if (xhr.status === 200) resolve();
      else if (xhr.status === 413) reject(new Error('حجم فایل برای سرور زیاد است. اسکریپت نصب سرور را دوباره اجرا کنید.'));
      else reject(new Error(msg || `خطای آپلود (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('اتصال در حین آپلود قطع شد.'));
    xhr.send(file);
  });
}

export async function deleteAndroidApk(): Promise<{ success: boolean; message: string }> {
  const { data } = await adminCall('/admin/android', { method: 'DELETE' });
  return data;
}
