// Hourly solar forecast from Open-Meteo (free, no API key): https://open-meteo.com
// Turned into the same { t, pct } samples the light history uses, so stats.ts treats both alike.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config';
import { LightSample } from '../protocol/stats';

const CACHE_KEY = 'forecast.v1';

export interface Forecast {
  fetchedAt: number;      // ms since epoch
  lat: number;
  lon: number;
  samples: LightSample[];
}

interface OpenMeteoResponse {
  hourly?: { time?: number[]; shortwave_radiation?: (number | null)[] };
}

/**
 * Open-Meteo's hourly shortwave_radiation (W/m²) is the average over the hour BEFORE each
 * timestamp, so each value is placed at the middle of that hour. 1000 W/m² = 100 % of full sun.
 */
export function parseOpenMeteo(json: OpenMeteoResponse): LightSample[] {
  const times = json.hourly?.time ?? [];
  const rad = json.hourly?.shortwave_radiation ?? [];
  const out: LightSample[] = [];
  times.forEach((t, i) => {
    const r = rad[i];
    if (typeof r !== 'number') return;
    out.push({ t: t * 1000 - 30 * 60_000, pct: Math.min(100, Math.max(0, (r / config.fullSunWm2) * 100)) });
  });
  return out;
}

export async function fetchForecast(lat: number, lon: number): Promise<Forecast> {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${lat}&longitude=${lon}` +
    '&hourly=shortwave_radiation&timeformat=unixtime&forecast_days=2&timezone=auto';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Forecast request failed (${res.status})`);
  const samples = parseOpenMeteo(await res.json());
  if (!samples.length) throw new Error('Forecast had no data');
  const f = { fetchedAt: Date.now(), lat, lon, samples };
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(f)).catch(() => {});
  return f;
}

export async function loadCachedForecast(): Promise<Forecast | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
