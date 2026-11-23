// صدای آلارم پایان وقت: چند تُن آماده + صدای شخصی‌سازی‌شده کاربر (فایل آپلودی)
// انتخاب کاربر در localStorage ذخیره می‌شود تا بین اجراها بماند.

export type AlarmSoundId = 'chime' | 'bell' | 'beep' | 'urgent' | 'custom';

export interface AlarmSoundOption {
  id: AlarmSoundId;
  name: string;
}

export const ALARM_SOUND_OPTIONS: AlarmSoundOption[] = [
  { id: 'chime', name: 'زنگ پیش‌فرض (چایم)' },
  { id: 'bell', name: 'زنگ مدرسه' },
  { id: 'beep', name: 'بیپ کوتاه' },
  { id: 'urgent', name: 'آلارم فوری' },
  { id: 'custom', name: 'صدای شخصی (فایل من)' },
];

const STORAGE_KEY = 'alarmSoundId';
const CUSTOM_DATA_KEY = 'alarmCustomSoundData';
const VOLUME_KEY = 'alarmVolume';

/** بلندی صدا بین 0 تا 100 (پیش‌فرض 100) */
export function getStoredAlarmVolume(): number {
  try {
    const v = parseInt(localStorage.getItem(VOLUME_KEY) || '', 10);
    if (!isNaN(v) && v >= 0 && v <= 100) return v;
  } catch { /* ignore */ }
  return 100;
}

export function storeAlarmVolume(vol: number) {
  try { localStorage.setItem(VOLUME_KEY, String(Math.max(0, Math.min(100, Math.round(vol))))); } catch { /* ignore */ }
}

export function getStoredAlarmSoundId(): AlarmSoundId {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as AlarmSoundId | null;
    if (v && ALARM_SOUND_OPTIONS.some((o) => o.id === v)) return v;
  } catch { /* ignore */ }
  return 'chime';
}

export function storeAlarmSoundId(id: AlarmSoundId) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
}

export function getStoredCustomSoundData(): string | null {
  try { return localStorage.getItem(CUSTOM_DATA_KEY); } catch { return null; }
}

export function storeCustomSoundData(dataUrl: string | null) {
  try {
    if (dataUrl) localStorage.setItem(CUSTOM_DATA_KEY, dataUrl);
    else localStorage.removeItem(CUSTOM_DATA_KEY);
  } catch { /* ignore */ }
}

/** صدای آلارم را با تنظیم انتخابی و بلندی دلخواه پخش می‌کند (vol 0..100، پیش‌فرض ذخیره‌شده). */
export function playAlarmSound(id: AlarmSoundId = getStoredAlarmSoundId(), customDataUrl: string | null = getStoredCustomSoundData(), volume?: number) {
  const vol = Math.max(0, Math.min(1, (volume ?? getStoredAlarmVolume()) / 100));
  if (vol <= 0) return; // بی‌صدا
  try {
    if (id === 'custom' && customDataUrl) {
      const audio = new Audio(customDataUrl);
      audio.volume = vol;
      audio.play().catch((e) => console.error('Custom alarm playback failed', e));
      return;
    }
    if (id === 'custom' && !customDataUrl) {
      id = 'chime'; // فایل شخصی موجود نیست؛ به پیش‌فرض برگرد
    }
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const t0 = ctx.currentTime;

    const tone = (freq: number, start: number, dur: number, volTone: number, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0 + start);
      gain.gain.setValueAtTime(volTone * vol, t0 + start);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur);
    };

    switch (id) {
      case 'bell': // دو ضرب زنگ با هارمونیک
        tone(880, 0, 0.5, 0.2);
        tone(1760, 0, 0.4, 0.08);
        tone(880, 0.6, 0.5, 0.2);
        tone(1760, 0.6, 0.4, 0.08);
        break;
      case 'beep': // سه بیپ کوتاه
        for (let i = 0; i < 3; i++) tone(1000, i * 0.25, 0.12, 0.25, 'square');
        break;
      case 'urgent': // آلارم فوری: تناوب سریع دوتایی
        for (let i = 0; i < 4; i++) {
          tone(1200, i * 0.18, 0.08, 0.3, 'sawtooth');
          tone(900, i * 0.18 + 0.09, 0.08, 0.3, 'sawtooth');
        }
        break;
      case 'chime':
      default:
        tone(783.99, 0, 0.4, 0.25); // G5
        tone(1046.50, 0.15, 0.45, 0.25); // C6
        break;
    }
    setTimeout(() => { ctx.close().catch(() => {}); }, 3000);
  } catch (e) {
    console.error('Alarm sound failed to play', e);
  }
}
