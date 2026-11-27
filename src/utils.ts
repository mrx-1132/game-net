import { ActiveSession, RateConfig } from './types';
import { encryptBackup } from './backupCrypto';

/**
 * Helper to convert Persian or Arabic digits to Latin/English digits
 */
export function toLatinDigits(str: string | number): string {
  if (str === null || str === undefined) return '';
  const s = str.toString();
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return s
    .replace(/[۰-۹]/g, (d) => persianDigits.indexOf(d).toString())
    .replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString());
}

/**
 * Convert numbers to Farsi digits (No longer doing this since the user requested all Latin digits)
 */
export function toPersianDigits(num: number | string): string {
  return toLatinDigits(num);
}

/**
 * Formats currency values in Tomans cleanly
 */
export function formatCurrency(amount: number, usePersianDigits = false): string {
  const formatted = amount.toLocaleString('en-US');
  const result = `${formatted} تومان`;
  return usePersianDigits ? toPersianDigits(result) : result;
}

/**
 * Format duration in milliseconds to HH:MM:SS
 */
export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (num: number) => num.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Calculate the active session's duration (excluding pause times)
 * and the currently accumulated gameplay cost based on specified rate configurations
 */
export function getSessionMetrics(
  session: ActiveSession,
  rates: RateConfig,
  currentTimeMs: number = Date.now()
): {
  elapsedMs: number;
  durationMinutes: number;
  gamePlayCost: number;
  buffetCost: number;
  extraServicesCost: number;
  totalCost: number;
} {
  let elapsedMs = session.totalPausedMs;

  if (session.pausedTime) {
    // Currently paused: elapsed duration is up to the paused time
    const pausedTimeMs = new Date(session.pausedTime).getTime();
    const startTimeMs = new Date(session.startTime).getTime();
    elapsedMs = pausedTimeMs - startTimeMs - session.totalPausedMs;
  } else {
    // Active / running: elapsed duration is up to the current time
    const startTimeMs = new Date(session.startTime).getTime();
    elapsedMs = currentTimeMs - startTimeMs - session.totalPausedMs;
  }

  if (elapsedMs < 0) elapsedMs = 0;

  // زمان سپری‌شده روی سیستم‌های قبلی (مثلاً پس از جابجایی مشتری) باید ادامه یابد
  const prevElapsedMs = session.previousElapsedMs || 0;
  if (prevElapsedMs > 0) {
    elapsedMs += prevElapsedMs;
  }

  const durationMinutes = elapsedMs > 0 ? Math.ceil(elapsedMs / 60000) : 0;

  // Calculate gameplay cost based on completed 1-minute blocks
  // Do not show or calculate cost until the entire session reaches at least one minute
  const completedMinutes = Math.floor(elapsedMs / 60000);
  const billedMinutesBefore = Math.floor(prevElapsedMs / 60000);
  let gamePlayCost = session.previousGamePlayCost || 0;

  if (completedMinutes > billedMinutesBefore) {
    const changes = session.playerCountChanges || [{ playersCount: session.playersCount, atElapsedMs: 0 }];
    
    for (let m = billedMinutesBefore + 1; m <= completedMinutes; m++) {
      const t = m * 60000;
      // Find the player count at the end of this minute block
      let blockPlayersCount: 1 | 2 | 3 | 4 = changes[0]?.playersCount || 1;
      for (const change of changes) {
        if (change.atElapsedMs < t) {
          blockPlayersCount = change.playersCount;
        } else {
          break;
        }
      }

      // Determine hourly rate for this block
      let hourlyRate = rates.hourlyRate1P;
      if (blockPlayersCount === 2) hourlyRate = rates.hourlyRate2P;
      if (blockPlayersCount === 3) hourlyRate = rates.hourlyRate3P;
      if (blockPlayersCount === 4) hourlyRate = rates.hourlyRate4P;

      gamePlayCost += Math.round(hourlyRate / 60);
    }
  }

  // Buffet cost
  const buffetCost = session.buffetItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Extra services & equipment cost
  const extraServicesCost = session.extraServices?.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  ) || 0;

  return {
    elapsedMs,
    durationMinutes,
    gamePlayCost,
    buffetCost,
    extraServicesCost,
    totalCost: gamePlayCost + buffetCost + extraServicesCost,
  };
}

/**
 * Format date nicely in Persian style
 */
let _faDateTimeFmt: Intl.DateTimeFormat | null = null;
function getFaDateTimeFmt(): Intl.DateTimeFormat {
  if (!_faDateTimeFmt) {
    _faDateTimeFmt = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return _faDateTimeFmt;
}

export function formatDatePersian(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return toLatinDigits(String(dateStr));
    }
    const formatted = getFaDateTimeFmt().format(d);
    return toLatinDigits(formatted);
  } catch (e) {
    return toLatinDigits(String(dateStr));
  }
}

export interface GameplaySegment {
  playersCount: 1 | 2 | 3 | 4;
  minutes: number;
  hourlyRate: number;
  cost: number;
}

export function getGameplaySegments(
  session: ActiveSession,
  rates: RateConfig,
  elapsedMs: number
): GameplaySegment[] {
  const completedMinutes = Math.floor(elapsedMs / 60000);
  if (completedMinutes < 1) return [];

  const changes = session.playerCountChanges || [{ playersCount: session.playersCount, atElapsedMs: 0 }];
  const segments: GameplaySegment[] = [];

  for (let m = 1; m <= completedMinutes; m++) {
    const t = m * 60000;
    
    // Find who was active at this block's end
    let blockPlayersCount: 1 | 2 | 3 | 4 = changes[0]?.playersCount || 1;
    for (const change of changes) {
      if (change.atElapsedMs < t) {
        blockPlayersCount = change.playersCount;
      } else {
        break;
      }
    }

    let hourlyRate = rates.hourlyRate1P;
    if (blockPlayersCount === 2) hourlyRate = rates.hourlyRate2P;
    if (blockPlayersCount === 3) hourlyRate = rates.hourlyRate3P;
    if (blockPlayersCount === 4) hourlyRate = rates.hourlyRate4P;

    const blockCost = Math.round(hourlyRate / 60);

    const lastSeg = segments[segments.length - 1];
    if (lastSeg && lastSeg.playersCount === blockPlayersCount) {
      lastSeg.minutes += 1;
      lastSeg.cost += blockCost;
    } else {
      segments.push({
        playersCount: blockPlayersCount,
        minutes: 1,
        hourlyRate,
        cost: blockCost
      });
    }
  }

  return segments;
}

/**
 * Serializes a backup payload. When the payload carries the system admin password the whole file is
 * encrypted with it (AES-GCM), so opening the file elsewhere shows nothing readable.
 */
export async function serializeBackupPayload(payload: any): Promise<string> {
  const secret = payload && typeof payload.adminPassword === 'string' ? payload.adminPassword : '';
  if (!secret) return JSON.stringify(payload, null, 2);
  return JSON.stringify(await encryptBackup(payload, secret));
}

/**
 * Automatically triggers browser download of the full database state as a (encrypted) .db file
 */
export async function downloadDatabaseBackupPayload(payload: any, filenamePrefix = 'gamenet_backup') {
  try {
    const dateStr = new Date().toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-');
    const safeDateStr = toLatinDigits(dateStr);

    const jsonString = await serializeBackupPayload(payload);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${filenamePrefix}_${safeDateStr}.db`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error auto downloading DB file:', err);
  }
}

/**
 * SHA-256 Hash helper using Web Crypto API with synchronous fallback
 */
export async function sha256Hash(text: string): Promise<string> {
  if (!text) return '';
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(text);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn('SubtleCrypto unavailable, using fallback hash', e);
  }

  // Fallback FNV-1a / DJB2 inspired 64-character deterministic pseudo-hash
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const raw = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return 'hash_' + raw.toString(16).padStart(16, '0') + text.length.toString(16);
}

/**
 * Verifies if a plain text password matches a stored hash or plain password (for backward compatibility)
 */
export async function verifyPasswordHash(plainInput: string, storedHashOrPlain: string): Promise<boolean> {
  if (!plainInput || !storedHashOrPlain) return false;
  if (plainInput === storedHashOrPlain) return true;
  const computed = await sha256Hash(plainInput);
  return computed.toLowerCase() === storedHashOrPlain.toLowerCase();
}
