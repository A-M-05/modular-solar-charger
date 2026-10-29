// Light readings saved on the phone for the suggested charge time (guide §5.5).
// Every 30 min while connected, keep { time, light % }. Keep yesterday and today.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sample } from '../protocol/stats';

export interface LightEntry { t: number; pct: number } // epoch ms, % of full sun

const KEY = 'lightHistory.v1';
export const RECORD_EVERY_MS = 30 * 60_000;

const startOfDay = (ms: number, daysBack = 0) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysBack);
  return d.getTime();
};

/** Adds a reading if the last one is 30+ min old, and drops anything older than yesterday. Same array if nothing changed. */
export function addSample(entries: LightEntry[], pct: number, now: number): LightEntry[] {
  const last = entries[entries.length - 1];
  if (last && now - last.t < RECORD_EVERY_MS) return entries;
  const keepFrom = startOfDay(now, 1);
  return [...entries.filter((e) => e.t >= keepFrom), { t: now, pct: Math.round(pct * 10) / 10 }];
}

/** Splits saved readings into today's and yesterday's, as minutes of the day. */
export function splitDays(entries: LightEntry[], now: number): { today: Sample[]; yesterday: Sample[] } {
  const today = startOfDay(now);
  const yesterday = startOfDay(now, 1);
  const toSample = (e: LightEntry, dayStart: number): Sample => ({ min: Math.round((e.t - dayStart) / 60_000), pct: e.pct });
  return {
    today: entries.filter((e) => e.t >= today && e.t <= now).map((e) => toSample(e, today)),
    yesterday: entries.filter((e) => e.t >= yesterday && e.t < today).map((e) => toSample(e, yesterday)),
  };
}

export async function loadHistory(): Promise<LightEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((e) => typeof e?.t === 'number' && typeof e?.pct === 'number') : [];
  } catch {
    return []; // corrupt or unreadable: start fresh rather than crash the screen
  }
}

export async function saveHistory(entries: LightEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Could not save light history', e); // losing a sample only delays the suggestion
  }
}
