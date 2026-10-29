// Gets the phone's location (only after the user taps "Use my location" once) and keeps an
// hourly solar forecast for it. Falls back to the cached forecast when offline.
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { mockForecast } from '../ble/mockConnection';
import { config } from '../config';
import { LightSample } from '../protocol/stats';
import { fetchForecast, loadCachedForecast } from '../weather/forecast';

export type ForecastStatus = 'ok' | 'loading' | 'needsLocation' | 'denied' | 'error';

export interface ForecastState {
  samples: LightSample[] | null;
  status: ForecastStatus;
  requestLocation(): void;
}

/** mockDay = start of the mock clock's day; only used in mock mode. */
export function useForecast(mock: boolean, mockDay: number): ForecastState {
  const [samples, setSamples] = useState<LightSample[] | null>(null);
  const [status, setStatus] = useState<ForecastStatus>('loading');

  const load = useCallback(async (ask: boolean) => {
    setStatus('loading');
    // Show the cached forecast straight away; replace it if it's old.
    const cached = await loadCachedForecast();
    if (cached) setSamples(cached.samples);
    const fresh = cached && Date.now() - cached.fetchedAt < config.forecastRefreshMin * 60_000;
    if (fresh) return setStatus('ok');

    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && ask) perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        if (cached) return setStatus('ok');
        return setStatus(perm.canAskAgain ? 'needsLocation' : 'denied');
      }
      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
      // ~1 km is plenty for weather and keeps the exact location off the network
      const round = (x: number) => Math.round(x * 100) / 100;
      const f = await fetchForecast(round(pos.coords.latitude), round(pos.coords.longitude));
      setSamples(f.samples);
      setStatus('ok');
    } catch {
      setStatus(cached ? 'ok' : 'error');
    }
  }, []);

  useEffect(() => {
    if (mock) {
      setSamples(mockForecast(mockDay));
      setStatus('ok');
      return;
    }
    load(false);
    const id = setInterval(() => load(false), config.forecastRefreshMin * 60_000);
    return () => clearInterval(id);
  }, [mock, mock ? mockDay : 0, load]);

  return { samples, status, requestLocation: () => load(true) };
}
