import { DailyWorkingDayBackup } from '../types';

export interface TelegramSendResult {
  success: boolean;
  error?: string;
}

/**
 * Send a message to Telegram using Bot API
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string,
  apiEndpoint = 'https://api.telegram.org'
): Promise<TelegramSendResult> {
  try {
    const cleanToken = (botToken || '').trim();
    const cleanChatId = (chatId || '').trim();

    if (!cleanToken) {
      return { success: false, error: 'توکن ربات تلگرام وارد نشده است.' };
    }
    if (!cleanChatId) {
      return { success: false, error: 'شناسه چت (Chat ID) وارد نشده است.' };
    }

    const base = (apiEndpoint || '').trim().replace(/\/+$/, '') || 'https://api.telegram.org';
    const url = `${base}/bot${cleanToken}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    if (data && data.ok) {
      return { success: true };
    } else {
      return {
        success: false,
        error: data?.description || 'خطا در ارسال پیام به تلگرام (بررسی توکن و Chat ID)',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'عدم امکان برقراری ارتباط با سرور تلگرام (بررسی اینترنت یا فیلترینگ)',
    };
  }
}

/**
 * Formats a clean Persian daily financial report for Telegram
 */
export function formatDailyFinancialTelegramReport(
  backup: DailyWorkingDayBackup,
  clubName = 'کلوب و گیم‌نت'
): string {
  const dateStr = backup.workingDatePersian || new Date().toLocaleDateString('fa-IR');
  const closedDate = backup.closedAt ? new Date(backup.closedAt) : new Date();
  const timeStr = !isNaN(closedDate.getTime())
    ? closedDate.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
    : '-';

  const totalSessionsCount = (backup.history || []).length;
  const totalDirectSalesCount = (backup.directSales || []).length;
  const totalBuffetSum = (backup.totalSessionBuffetCost || 0) + (backup.totalDirectBuffetSales || 0);

  return `
🎮 <b>گزارش اتمام روز کاری و بستن صندوق</b>
━━━━━━━━━━━━━━━━━━
🏢 <b>مجموعه:</b> ${clubName}
📅 <b>روز کاری:</b> <code>${dateStr}</code>
⏰ <b>زمان ثبت:</b> <code>${timeStr}</code>
👤 <b>ثبت‌کننده:</b> ${backup.closedBy === 'admin' ? 'مدیر سیستم' : 'اپراتور شیفت'}
${backup.notes ? `📝 <b>یادداشت شیفت:</b> <i>${backup.notes}</i>\n` : ''}
━━━━━━━━━━━━━━━━━━
💰 <b>درآمد ناخالص کل:</b> <code>${(backup.totalGrossRevenue || 0).toLocaleString('fa-IR')} تومان</code>

💵 <b>دریافتی نقد صندوق:</b> <code>${(backup.paidCashAmount || 0).toLocaleString('fa-IR')} تومان</code>
💳 <b>تراکنش کارتخوان (POS):</b> <code>${(backup.paidCardAmount || 0).toLocaleString('fa-IR')} تومان</code>
📒 <b>نسیه و مانده دفتری:</b> <code>${(backup.debtAccumulatedAmount || 0).toLocaleString('fa-IR')} تومان</code>
━━━━━━━━━━━━━━━━━━
🕹 <b>کارکرد گیم‌پلی سیستم‌ها:</b> <code>${(backup.totalGameplayRevenue || 0).toLocaleString('fa-IR')} تومان</code>
☕ <b>فروش کل بوفه:</b> <code>${totalBuffetSum.toLocaleString('fa-IR')} تومان</code>
📋 <b>تعداد فاکتورهای بازی:</b> <code>${totalSessionsCount.toLocaleString('fa-IR')} مورد</code>
🛍 <b>تعداد فروش آزاد بوفه:</b> <code>${totalDirectSalesCount.toLocaleString('fa-IR')} مورد</code>
━━━━━━━━━━━━━━━━━━
💾 <i>نسخه پشتیبان روزانه (.db) با موفقیت در سیستم بایگانی شد.</i>
`.trim();
}
