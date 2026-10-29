// Saves light samples (every 30 min while connected) for the suggested charge time.
// Keeps today and yesterday only.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightSample, startOfDay } from '../protocol/stats';

const HISTORY_KEY = 'lightHistory.v1';
const LAST_READING_KEY = 'lastReading.v1';

/** Drop anything older than the start of yesterday. */
export function prune(samples: LightSample[], nowMs: number): LightSample[] {
  const y = new Date(startOfDay(nowMs));
  y.setDate(y.getDate() - 1);
  return samples.filter((s) => s.t >= y.getTime());
}

export async function loadLightHistory(): Promise<LightSample[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? prune(JSON.parse(raw), Date.now()) : [];
  } catch {
    return [];
  }
}

export async function saveLightHistory(samples: LightSample[]): Promise<void> {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(samples)).catch(() => {});
}

/** What the "Not connected" screen shows: the battery as it was last seen. */
export interface LastReading {
  t: number;        // ms since epoch (on the clock the app was using)
  soc: number;      // 0-1
  energyWh: number;
}

export async function loadLastReading(): Promise<LastReading | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_READING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveLastReading(r: LastReading): Promise<void> {
  await AsyncStorage.setItem(LAST_READING_KEY, JSON.stringify(r)).catch(() => {});
}
