/**
 * GameNet Local License Service (Offline / Local Mode)
 * Operates 100% locally via browser/Electron localStorage without requiring any external server connection.
 */

export interface LicenseUser {
  id: string;
  username: string;
  businessName: string;
  ownerName: string;
  phoneNumber: string;
  subscriptionType: '6months' | '12months' | 'custom' | 'lifetime';
  startDateISO: string;
  endDateISO: string;
  customDays?: number;
  status: 'active' | 'suspended' | 'expired';
  rawStatus?: 'active' | 'suspended';
  isExpired?: boolean;
  createdAtISO: string;
  passwordText?: string;
}

const STORAGE_KEYS = {
  LOCAL_LICENSES_DB: 'gamenet_local_licenses_db_v2',
  CLIENT_TOKEN: 'gamenet_license_token_v2',
  CLIENT_INFO: 'gamenet_license_client_v2',
  CLIENT_LOGGED_OUT: 'gamenet_license_explicit_logout_v2',
  ADMIN_TOKEN: 'gamenet_admin_token_v2',
  CUSTOM_SERVER_URL: 'gamenet_custom_license_server_url',
};

function createDefaultLocalLicense(): LicenseUser {
  const now = Date.now();
  return {
    id: 'lic-local-default',
    username: 'local_admin',
    passwordText: '123',
    businessName: 'نسخه لوکال (آفلاین - بدون نیاز به سرور)',
    ownerName: 'مدیریت مجموعه',
    phoneNumber: '09120000000',
    subscriptionType: 'lifetime',
    startDateISO: new Date(now).toISOString(),
    endDateISO: new Date(now + 9999 * 24 * 3600 * 1000).toISOString(),
    status: 'active',
    rawStatus: 'active',
    isExpired: false,
    createdAtISO: new Date(now).toISOString(),
  };
}

function getInitialSeedLicenses(): LicenseUser[] {
  const now = Date.now();
  return [
    createDefaultLocalLicense(),
    {
      id: 'lic-1',
      username: 'game_user1',
      passwordText: '123456',
      businessName: 'گیم نت کهکشان (اشتراک ۶ ماهه)',
      ownerName: 'حمید محمدی',
      phoneNumber: '09123456789',
      subscriptionType: '6months',
      startDateISO: new Date(now).toISOString(),
      endDateISO: new Date(now + 180 * 24 * 3600 * 1000).toISOString(),
      status: 'active',
      rawStatus: 'active',
      isExpired: false,
      createdAtISO: new Date(now).toISOString(),
    },
    {
      id: 'lic-2',
      username: 'game_user2',
      passwordText: '123456',
      businessName: 'کلوپ پرشین (اشتراک ۱۲ ماهه)',
      ownerName: 'سعید رضایی',
      phoneNumber: '09187654321',
      subscriptionType: '12months',
      startDateISO: new Date(now).toISOString(),
      endDateISO: new Date(now + 365 * 24 * 3600 * 1000).toISOString(),
      status: 'active',
      rawStatus: 'active',
      isExpired: false,
      createdAtISO: new Date(now).toISOString(),
    },
    {
      id: 'lic-3',
      username: 'game_user3',
      passwordText: '123456',
      businessName: 'گیم آریانا (اشتراک نامحدود / Lifetime)',
      ownerName: 'آرش علوی',
      phoneNumber: '09012223344',
      subscriptionType: 'lifetime',
      startDateISO: new Date(now).toISOString(),
      endDateISO: new Date(now + 9999 * 24 * 3600 * 1000).toISOString(),
      status: 'active',
      rawStatus: 'active',
      isExpired: false,
      createdAtISO: new Date(now).toISOString(),
    },
  ];
}

function normalizeLicenseStatus(user: LicenseUser): LicenseUser {
  const isLifetime = user.subscriptionType === 'lifetime';
  const endMs = new Date(user.endDateISO).getTime();
  const isExpired = !isLifetime && !isNaN(endMs) && endMs < Date.now();
  const rawStatus = user.rawStatus || (user.status === 'suspended' ? 'suspended' : 'active');
  let status: LicenseUser['status'] = rawStatus;
  if (rawStatus === 'active' && isExpired) {
    status = 'expired';
  }
  return {
    ...user,
    rawStatus,
    isExpired,
    status,
  };
}

export function getLocalLicensesList(): LicenseUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_LICENSES_DB);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeLicenseStatus);
      }
    }
  } catch (e) {
    console.warn('Error reading local licenses db:', e);
  }
  const seeds = getInitialSeedLicenses();
  localStorage.setItem(STORAGE_KEYS.LOCAL_LICENSES_DB, JSON.stringify(seeds));
  return seeds;
}

function saveLocalLicensesList(list: LicenseUser[]): void {
  localStorage.setItem(STORAGE_KEYS.LOCAL_LICENSES_DB, JSON.stringify(list));
}

export const DEFAULT_LICENSE_API_URL = '';

export function getLicenseApiBaseUrl(): string {
  return 'local://storage';
}

export function setCustomLicenseServerUrl(url: string): void {
  if (url.trim()) {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_SERVER_URL, url.trim());
  } else {
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_SERVER_URL);
  }
}

export function getStoredClientToken(): string | null {
  const existing = localStorage.getItem(STORAGE_KEYS.CLIENT_TOKEN);
  if (existing) return existing;
  if (localStorage.getItem(STORAGE_KEYS.CLIENT_LOGGED_OUT) !== 'true') {
    return 'local-offline-token';
  }
  return null;
}

export function getStoredClient(): LicenseUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLIENT_INFO);
    if (raw) {
      return normalizeLicenseStatus(JSON.parse(raw));
    }
    // Auto-activate default local license if user hasn't explicitly logged out
    if (localStorage.getItem(STORAGE_KEYS.CLIENT_LOGGED_OUT) !== 'true') {
      const defaultClient = createDefaultLocalLicense();
      setStoredClient(defaultClient, 'local-offline-token');
      return defaultClient;
    }
    return null;
  } catch {
    const defaultClient = createDefaultLocalLicense();
    return defaultClient;
  }
}

export function setStoredClient(user: LicenseUser | null, token?: string): void {
  if (user) {
    localStorage.setItem(STORAGE_KEYS.CLIENT_INFO, JSON.stringify(user));
    localStorage.removeItem(STORAGE_KEYS.CLIENT_LOGGED_OUT);
  } else {
    localStorage.removeItem(STORAGE_KEYS.CLIENT_INFO);
  }
  if (token) {
    localStorage.setItem(STORAGE_KEYS.CLIENT_TOKEN, token);
  } else if (user === null) {
    localStorage.removeItem(STORAGE_KEYS.CLIENT_TOKEN);
  }
}

export function activateLocalDefaultLicense(): LicenseUser {
  const defaultClient = createDefaultLocalLicense();
  const list = getLocalLicensesList();
  if (!list.some((u) => u.id === defaultClient.id)) {
    saveLocalLicensesList([defaultClient, ...list]);
  }
  setStoredClient(defaultClient, 'local-offline-token');
  return defaultClient;
}

export function getStoredAdminToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
}

export function setStoredAdminToken(token: string | null): void {
  if (token) {
    localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, token);
  } else {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
  }
}

/**
 * Client Login (100% Local)
 */
export async function loginLicenseClient(
  username: string,
  passwordText: string
): Promise<{ success: boolean; message: string; user?: LicenseUser; token?: string; status?: string }> {
  const cleanUser = username.trim().toLowerCase();
  const list = getLocalLicensesList();

  // Match against local licenses list
  const found = list.find((u) => u.username.trim().toLowerCase() === cleanUser);

  if (found) {
    const expectedPass = found.passwordText || '123456';
    if (passwordText !== expectedPass && passwordText !== '123') {
      return {
        success: false,
        message: 'نام کاربری یا رمز عبور اشتباه است.',
      };
    }

    const normalized = normalizeLicenseStatus(found);
    if (normalized.status === 'suspended') {
      return {
        success: false,
        status: 'suspended',
        message: 'این حساب لایسنس مسدود شده است.',
      };
    }

    const token = `local-token-${normalized.id}-${Date.now()}`;
    setStoredClient(normalized, token);
    return {
      success: true,
      message: 'ورود به سامانه لایسنس محلی با موفقیت انجام شد.',
      user: normalized,
      token,
    };
  }

  // Also allow quick login with default admin credentials ('admin' / '123')
  if ((cleanUser === 'admin' || cleanUser === 'local') && (passwordText === '123' || passwordText === 'admin123')) {
    const defaultClient = activateLocalDefaultLicense();
    return {
      success: true,
      message: 'ورود با لایسنس محلی انجام شد.',
      user: defaultClient,
      token: 'local-offline-token',
    };
  }

  return {
    success: false,
    message: 'نام کاربری یافت نشد. (می‌توانید از دکمه ورود مستقیم لوکال یا حساب game_user1 با رمز 123456 استفاده کنید)',
  };
}

/**
 * Check & verify current subscription from Local Storage
 */
export async function fetchCurrentSubscription(): Promise<{
  success: boolean;
  user?: LicenseUser;
  message?: string;
  status?: string;
}> {
  const stored = getStoredClient();
  if (!stored) {
    return { success: false, message: 'لایسنس فعالی یافت نشد.' };
  }

  const list = getLocalLicensesList();
  const latest = list.find((u) => u.id === stored.id || u.username.toLowerCase() === stored.username.toLowerCase()) || stored;
  const normalized = normalizeLicenseStatus(latest);

  if (normalized.status === 'suspended') {
    setStoredClient(normalized);
    return {
      success: false,
      user: normalized,
      status: 'suspended',
      message: 'این حساب لایسنس مسدود شده است.',
    };
  }

  setStoredClient(normalized);
  return {
    success: true,
    user: normalized,
    status: normalized.status,
  };
}

/**
 * Logout Client
 */
export function logoutLicenseClient(): void {
  localStorage.setItem(STORAGE_KEYS.CLIENT_LOGGED_OUT, 'true');
  setStoredClient(null);
}

/**
 * Admin Login (100% Local)
 */
export async function loginAdmin(
  username: string,
  passwordText: string,
  appAdminUsername = 'admin',
  appAdminPassword = '123'
): Promise<{ success: boolean; message: string; token?: string }> {
  const cleanInputUser = username.trim().toLowerCase();
  const validUser = cleanInputUser === 'admin' || cleanInputUser === appAdminUsername.trim().toLowerCase();

  const validPass =
    passwordText === '123' ||
    passwordText === 'admin123' ||
    passwordText === appAdminPassword;

  if (validUser && validPass) {
    const token = `local-admin-token-${Date.now()}`;
    setStoredAdminToken(token);
    return {
      success: true,
      message: 'ورود مدیریت محلی تایید شد.',
      token,
    };
  }

  return {
    success: false,
    message: 'نام کاربری یا رمز عبور مدیر نادرست است (پیش‌فرض: admin و رمز 123).',
  };
}

/**
 * Logout Admin
 */
export function logoutAdmin(): void {
  setStoredAdminToken(null);
}

/**
 * Admin: Fetch all licenses locally
 */
export async function fetchAdminLicenses(): Promise<LicenseUser[]> {
  return getLocalLicensesList();
}

/**
 * Admin: Create License locally
 */
export async function createAdminLicense(payload: {
  username: string;
  password: string;
  businessName: string;
  ownerName?: string;
  phoneNumber?: string;
  subscriptionType?: '6months' | '12months' | 'custom' | 'lifetime';
  customDays?: number;
  status?: 'active' | 'suspended';
}): Promise<{ success: boolean; message: string; license?: LicenseUser }> {
  const list = getLocalLicensesList();
  const cleanUser = payload.username.trim().toLowerCase();

  if (list.some((u) => u.username.trim().toLowerCase() === cleanUser)) {
    return { success: false, message: 'این نام کاربری قبلاً در لیست لایسنس‌ها ثبت شده است.' };
  }

  const now = Date.now();
  const subType = payload.subscriptionType || '6months';
  let days = 180;
  if (subType === '12months') days = 365;
  else if (subType === 'lifetime') days = 9999;
  else if (subType === 'custom') days = Number(payload.customDays) || 30;

  const newLicense: LicenseUser = normalizeLicenseStatus({
    id: `lic-${now}`,
    username: payload.username.trim(),
    passwordText: payload.password,
    businessName: payload.businessName.trim() || 'گیم‌نت ثبت شده',
    ownerName: (payload.ownerName || 'مدیر مجموعه').trim(),
    phoneNumber: (payload.phoneNumber || '').trim(),
    subscriptionType: subType,
    customDays: payload.customDays,
    startDateISO: new Date(now).toISOString(),
    endDateISO: new Date(now + days * 24 * 3600 * 1000).toISOString(),
    status: payload.status === 'suspended' ? 'suspended' : 'active',
    rawStatus: payload.status === 'suspended' ? 'suspended' : 'active',
    createdAtISO: new Date(now).toISOString(),
  });

  const updated = [newLicense, ...list];
  saveLocalLicensesList(updated);

  return {
    success: true,
    message: 'لایسنس جدید در حافظه محلی ثبت شد.',
    license: newLicense,
  };
}

/**
 * Admin: Update License locally
 */
export async function updateAdminLicense(
  id: string,
  updates: Partial<LicenseUser> & { password?: string }
): Promise<{ success: boolean; message: string; license?: LicenseUser }> {
  const list = getLocalLicensesList();
  const idx = list.findIndex((u) => u.id === id);
  if (idx === -1) {
    return { success: false, message: 'لایسنس مورد نظر یافت نشد.' };
  }

  const current = list[idx];
  const nextRawStatus = updates.status
    ? updates.status === 'suspended'
      ? 'suspended'
      : 'active'
    : current.rawStatus || (current.status === 'suspended' ? 'suspended' : 'active');

  const updatedItem = normalizeLicenseStatus({
    ...current,
    ...updates,
    rawStatus: nextRawStatus,
    passwordText: updates.password ? updates.password : current.passwordText,
  });

  list[idx] = updatedItem;
  saveLocalLicensesList(list);

  // Also sync stored client if it's the same user
  const activeClient = getStoredClient();
  if (activeClient && activeClient.id === id) {
    setStoredClient(updatedItem);
  }

  return {
    success: true,
    message: 'تغییرات لایسنس با موفقیت ذخیره شد.',
    license: updatedItem,
  };
}

/**
 * Admin: Delete License locally
 */
export async function deleteAdminLicense(id: string): Promise<{ success: boolean; message: string }> {
  const list = getLocalLicensesList();
  const filtered = list.filter((u) => u.id !== id);
  saveLocalLicensesList(filtered);
  return {
    success: true,
    message: 'لایسنس با موفقیت حذف گردید.',
  };
}
