// Every hardware/product assumption lives here. Change values once the team confirms them.
// See SOLAR_BANK_APP_GUIDE.md §1.

export const config = {
  // 4S LiFePO4, 12.8 V nominal, 6 Ah
  batteryWh: 76.8,
  // Max panel rating the controller accepts (W). The bank also reports it, this is the fallback.
  maxPanelW: 30,
  // Panel input at or above this counts as fast charging (W)
  fastChargeW: 15,
  // Charger efficiency, used until the hardware measures battery current directly
  efficiency: 0.9,
  // |P_net| below this is shown as "Holding steady" (W)
  balancedW: 0.1,
  // Below this a power value counts as "no power flowing" (W)
  idleW: 0.05,
  // Light ≥ this (% of full sun) counts as "strong light" for the suggested charge time
  strongLightPct: 50,
  // Forecast: on a cloudy day with nothing above strongLightPct, suggest the stretch above
  // this fraction of the day's peak instead (as long as the peak reaches minUsefulSunPct)
  weakDayFractionOfPeak: 0.7,
  minUsefulSunPct: 15,
  // Forecast radiation that counts as 100 % of full sun (W/m²)
  fullSunWm2: 1000,
  // Re-fetch the forecast after this long (minutes)
  forecastRefreshMin: 60,
  // Dips below strongLightPct shorter than this don't split the suggested window (minutes)
  suggestionMaxGapMin: 60,
  // Today counts as a full day for suggestions once the clock passes this hour (local, 0-23)
  dayCompleteHour: 19,
  // A day needs at least this many light samples to be used for suggestions
  minSamplesPerDay: 8,
  // How often to save a light sample while connected (minutes)
  lightSampleEveryMin: 30,
  // Smoothing factor for V, I and light readings: y = αx + (1−α)y
  emaAlpha: 0.2,
  // No packet for this long while connected → "stale" (ms)
  staleAfterMs: 3000,
  // Give up scanning after this long (ms)
  scanTimeoutMs: 15000,
};

export type Config = typeof config;
