/**
 * SMS.ir API Integration Service
 * Official Documentation: https://app.sms.ir/developer/help/likeToLike
 * Base API: https://api.sms.ir/v1
 * Header: x-api-key
 */

export const DEFAULT_SMS_API_KEY = 'pBA7mhPzUHUCPzUqqVvU321gWgTIytTh4RCWdsL65RC3Zi0D';

export interface SmsSendResult {
  success: boolean;
  message: string;
  data?: any;
  packId?: number;
  messageIds?: (number | null)[];
  cost?: number;
}

export interface LikeToLikeSendParams {
  lineNumber?: string | number;
  mobiles: string[];
  messageTexts: string[];
  sendDateTime?: number | null;
  apiKey?: string;
}

export function getSmsApiKey(): string {
  return localStorage.getItem('gamenet_sms_api_key') || DEFAULT_SMS_API_KEY;
}

export function setSmsApiKey(apiKey: string): void {
  localStorage.setItem('gamenet_sms_api_key', apiKey.trim());
}

export function getSmsLineNumber(): string {
  return localStorage.getItem('gamenet_sms_line_number') || '';
}

export function setSmsLineNumber(line: string): void {
  localStorage.setItem('gamenet_sms_line_number', line.trim());
}

/**
 * Format Iranian mobile number to standard 09xxxxxxxxx format
 */
export function normalizeIranianMobile(mobile: string): string {
  let cleaned = String(mobile || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[+\-]/g, '');

  if (cleaned.startsWith('0098')) {
    cleaned = '0' + cleaned.substring(4);
  } else if (cleaned.startsWith('98')) {
    cleaned = '0' + cleaned.substring(2);
  }

  if (!cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '0' + cleaned;
  }

  return cleaned.replace(/\D/g, '');
}

/**
 * Helper to call SMS.ir API endpoints:
 * Tries local server proxy first to avoid browser CORS/Preflight blocks,
 * and falls back to direct API if proxy is unavailable.
 */
async function callSmsApi(
  endpoint: string,
  options: {
    method?: string;
    apiKey: string;
    body?: any;
  }
): Promise<{ ok: boolean; status: number; data: any }> {
  const method = options.method || 'GET';
  const headers: Record<string, string> = {
    'x-api-key': options.apiKey,
    'Accept': 'application/json',
  };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const jsonBody = options.body ? JSON.stringify(options.body) : undefined;

  // 1. Try local Vite proxy first (bypasses browser CORS restrictions)
  try {
    const proxyUrl = `/api/sms-ir${endpoint}`;
    const res = await fetch(proxyUrl, {
      method,
      headers,
      body: jsonBody,
    });
    const parsed = await res.json().catch(() => null);
    if (res.status !== 404 && res.status !== 502) {
      return { ok: res.ok, status: res.status, data: parsed };
    }
  } catch {
    // Proxy not reachable, proceed to direct call
  }

  // 2. Direct call to https://api.sms.ir/v1 (Electron / Native)
  const directUrl = `https://api.sms.ir/v1${endpoint}`;
  const directRes = await fetch(directUrl, {
    method,
    headers,
    body: jsonBody,
  });
  const parsedDirect = await directRes.json().catch(() => null);
  return { ok: directRes.ok, status: directRes.status, data: parsedDirect };
}

/**
 * Get account credit from sms.ir
 */
export async function getSmsCredit(apiKey?: string): Promise<{ success: boolean; credit: number; message: string }> {
  const key = (apiKey || getSmsApiKey() || '').trim();
  if (!key) {
    return { success: false, credit: 0, message: 'کلید API پیامک تنظیم نشده است.' };
  }

  try {
    const result = await callSmsApi('/credit', {
      method: 'GET',
      apiKey: key,
    });

    const data = result.data;
    if (result.ok && data && (data.status === 1 || data.status === 100)) {
      const creditVal = typeof data.data === 'number' ? data.data : Number(data.data) || 0;
      return { 
        success: true, 
        credit: creditVal, 
        message: `اعتبار حساب SMS.ir با موفقیت دریافت شد: ${creditVal.toLocaleString('fa-IR')} پیامک/ریال` 
      };
    } else {
      const errMsg = data?.message || data?.data || `کد وضعیت ${result.status}`;
      return { success: false, credit: 0, message: `خطا در دریافت اعتبار: ${errMsg}` };
    }
  } catch (err: any) {
    return { 
      success: false, 
      credit: 0, 
      message: `خطای ارتباط با سامانه SMS.ir: ${err?.message || err}` 
    };
  }
}

/**
 * Fetch active line numbers registered under user's SMS.ir account
 */
export async function getSmsLines(apiKey?: string): Promise<string[]> {
  const key = (apiKey || getSmsApiKey() || '').trim();
  if (!key) return [];

  try {
    const result = await callSmsApi('/line', {
      method: 'GET',
      apiKey: key,
    });

    if (result.ok && result.data && (result.data.status === 1 || result.data.status === 100)) {
      if (Array.isArray(result.data.data)) {
        return result.data.data.map((item: any) => String(item.lineNumber || item)).filter(Boolean);
      }
    }
  } catch (e) {
    console.error('Error fetching SMS.ir line numbers:', e);
  }
  return [];
}

/**
 * Send SMS using sms.ir LikeToLike API (ارسال نظیر به نظیر)
 * Official Documentation: https://app.sms.ir/developer/help/likeToLike
 * Endpoint: POST https://api.sms.ir/v1/send/likeToLike
 *
 * Payload:
 * {
 *   "lineNumber": 30004505000017,
 *   "mobiles": ["09120000000"],
 *   "messageTexts": ["متن پیامک نظیر به نظیر"],
 *   "sendDateTime": null
 * }
 */
export async function sendLikeToLikeSms(params: LikeToLikeSendParams): Promise<SmsSendResult> {
  const key = (params.apiKey || getSmsApiKey() || '').trim();
  if (!key) {
    return { success: false, message: 'کلید وب‌سرویس SMS.ir (API Key) مشخص نشده است.' };
  }

  // 1. Format and validate mobile numbers
  const rawMobiles = Array.isArray(params.mobiles) ? params.mobiles : [params.mobiles];
  const formattedMobiles = rawMobiles
    .map(m => normalizeIranianMobile(m))
    .filter(m => m.length >= 10);

  if (formattedMobiles.length === 0) {
    return { success: false, message: 'شماره موبایل گیرنده پیامک خالی یا نامعتبر است (مثال: 09123456789).' };
  }

  if (formattedMobiles.length > 100) {
    return { success: false, message: 'طبق مستندات SMS.ir، حداکثر تعداد شماره‌ها در هر ارسال نظیر به نظیر ۱۰۰ شماره است.' };
  }

  // 2. Format and validate message texts
  let texts = Array.isArray(params.messageTexts) ? [...params.messageTexts] : [params.messageTexts];
  texts = texts.map(t => String(t || '').trim()).filter(Boolean);

  if (texts.length === 0) {
    return { success: false, message: 'متن پیامک نمی‌تواند خالی باشد.' };
  }

  // If a single text was passed for multiple recipients, duplicate it so lengths match
  if (texts.length === 1 && formattedMobiles.length > 1) {
    texts = Array(formattedMobiles.length).fill(texts[0]);
  } else if (texts.length !== formattedMobiles.length) {
    return {
      success: false,
      message: `تعداد شماره‌های موبایل (${formattedMobiles.length}) با تعداد متن‌های پیامک (${texts.length}) برابر نیست.`
    };
  }

  // 3. Resolve and format LineNumber
  let lineStr = String(params.lineNumber || getSmsLineNumber() || '').trim();

  // If line is empty or placeholder '30000000', fetch active lines from SMS.ir account
  if (!lineStr || lineStr === '30000000') {
    const activeLines = await getSmsLines(key);
    if (activeLines.length > 0) {
      lineStr = activeLines[0];
      setSmsLineNumber(lineStr);
    }
  }

  const numericLineDigits = lineStr.replace(/\D/g, '');
  if (!numericLineDigits) {
    return { 
      success: false, 
      message: 'شماره خط فرستنده SMS.ir مشخص نشده است. لطفاً شماره خط اختصاصی خود را در تنظیمات وارد نمایید.' 
    };
  }

  // In SMS.ir API, lineNumber is Long integer
  const lineNumberVal = Number(numericLineDigits);

  // 4. Construct payload matching https://app.sms.ir/developer/help/likeToLike
  const payload: any = {
    lineNumber: lineNumberVal,
    mobiles: formattedMobiles,
    messageTexts: texts,
  };

  if (typeof params.sendDateTime === 'number' && params.sendDateTime > 0) {
    payload.sendDateTime = params.sendDateTime;
  }

  try {
    const apiResult = await callSmsApi('/send/likeToLike', {
      method: 'POST',
      apiKey: key,
      body: payload,
    });

    const data = apiResult.data;

    if (apiResult.ok && data && (data.status === 1 || data.status === 100)) {
      const packId = data.data?.packId;
      const messageIds: (number | null)[] = data.data?.messageIds || [];
      const cost = data.data?.cost;

      const blacklistedCount = messageIds.filter(id => id === 0).length;
      const invalidCount = messageIds.filter(id => id === null || id === undefined).length;
      const sentCount = messageIds.filter(id => typeof id === 'number' && id > 0).length;

      let msg = `پیامک با موفقیت از طریق متد نظیر به نظیر (likeToLike) ارسال شد. شناسه بسته: ${packId || '-'}`;
      if (sentCount > 0) {
        msg += ` (${sentCount} پیام موفق)`;
      }
      if (blacklistedCount > 0) {
        msg += ` | توجه: ${blacklistedCount} شماره در لیست سیاه تبلیغاتی مخابرات قرار دارند.`;
      }
      if (invalidCount > 0) {
        msg += ` | توجه: ${invalidCount} شماره نامعتبر یا رد شده توسط اپراتور.`;
      }

      return {
        success: true,
        message: msg,
        data: data.data,
        packId,
        messageIds,
        cost
      };
    }

    // Handle error codes from SMS.ir API
    const statusCode = data?.status || apiResult.status;
    let detailMsg = data?.message || '';

    if (statusCode === 101) {
      detailMsg = `شماره خط ${numericLineDigits} نامعتبر است یا در پنل شما برای ارسال متنی مجاز نیست. لطفاً شماره خط اختصاصی فعال خود در پنل sms.ir را وارد نمایید.`;
    } else if (statusCode === 10) {
      detailMsg = 'کلید وب‌سرویس (API Key) سامانه SMS.ir نامعتبر یا منقضی شده است.';
    } else if (statusCode === 107) {
      detailMsg = 'لیست شماره‌های موبایل خالی یا نامعتبر است.';
    } else if (statusCode === 108) {
      detailMsg = 'لیست متن‌های پیامک خالی است.';
    } else if (statusCode === 109) {
      detailMsg = 'تعداد شماره‌های موبایل با تعداد متن‌های ارسالی برابر نیست.';
    } else if (statusCode === 102) {
      detailMsg = 'اعتبار ریالی/پیامکی حساب شما در SMS.ir کافی نمی‌باشد.';
    }

    return {
      success: false,
      message: `خطای سامانه SMS.ir (کد ${statusCode}): ${detailMsg || 'پاسخ ناموفق از وب‌سرویس'}`
    };

  } catch (err: any) {
    return {
      success: false,
      message: `خطای اتصال به وب‌سرویس پیامکی SMS.ir: ${err?.message || err}`
    };
  }
}

/**
 * Send general direct text SMS via LikeToLike API
 */
export async function sendDirectSms(
  mobile: string,
  messageText: string,
  lineNumberCustom?: string,
  apiKey?: string
): Promise<SmsSendResult> {
  return sendLikeToLikeSms({
    mobiles: [mobile],
    messageTexts: [messageText],
    lineNumber: lineNumberCustom,
    apiKey
  });
}

/**
 * Send SMS pattern / verification code via sms.ir
 * Endpoint: POST https://api.sms.ir/v1/send/verify
 */
export async function sendPatternSms(
  mobile: string,
  templateId: number,
  parameters: { name: string; value: string }[],
  apiKey?: string
): Promise<SmsSendResult> {
  const key = (apiKey || getSmsApiKey() || '').trim();
  if (!key) {
    return { success: false, message: 'کلید API پیامک یافت نشد.' };
  }

  const formattedMobile = normalizeIranianMobile(mobile);

  try {
    const result = await callSmsApi('/send/verify', {
      method: 'POST',
      apiKey: key,
      body: {
        mobile: formattedMobile,
        templateId,
        parameters
      }
    });

    const data = result.data;

    if (result.ok && data && (data.status === 1 || data.status === 100)) {
      return { 
        success: true, 
        message: 'پیامک پترن با موفقیت به سامانه SMS.ir ارسال شد.', 
        data: data.data 
      };
    } else {
      const errMsg = data?.message || (data?.data ? JSON.stringify(data.data) : `کد خطا ${result.status}`);
      return { success: false, message: `خطای SMS.ir: ${errMsg}` };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `خطا در ارسال پیامک پترن: ${err?.message || err}`
    };
  }
}
