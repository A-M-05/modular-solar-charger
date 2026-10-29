// Every number the screen shows that isn't read straight off the packet.
// Pure functions only (no React) so they're easy to unit test. See SOLAR_BANK_APP_GUIDE.md §5.
import { Config, config as defaultConfig } from '../config';
import { Telemetry } from './telemetry';

// ---------------------------------------------------------------------------------------------
// Battery level (§5.2)

// Resting-voltage -> state-of-charge table for 4S LiFePO4.
// ⚠ Very flat between 20–90 %, so this jumps around. Better later: coulomb counting.
const SOC_TABLE: [number, number][] = [
  [10.0, 0], [12.0, 0.09], [12.8, 0.17], [12.9, 0.2], [13.0, 0.3],
  [13.1, 0.4], [13.2, 0.7], [13.3, 0.9], [13.4, 0.99], [13.6, 1],
];

export function socFromVoltage(v: number): number {
  if (v <= SOC_TABLE[0][0]) return 0;
  for (let i = 1; i < SOC_TABLE.length; i++) {
    const [v1, s1] = SOC_TABLE[i];
    if (v <= v1) {
      const [v0, s0] = SOC_TABLE[i - 1];
      return s0 + ((v - v0) / (v1 - v0)) * (s1 - s0);
    }
  }
  return 1;
}

/** Exponential moving average for smoothing noisy readings: y = αx + (1−α)y */
export function ema(prev: number | null, x: number, alpha = defaultConfig.emaAlpha): number {
  return prev === null ? x : alpha * x + (1 - alpha) * prev;
}

// ---------------------------------------------------------------------------------------------
// Power, rates and times (§5.1, §5.3, §5.4)

export type FlowState = 'charging' | 'draining' | 'balanced';

export interface Stats {
  soc: number;                     // 0-1
  energyWh: number;                // E_now
  capacityWh: number;
  panelW: number;                  // P_panel
  outW: number;                    // P_out
  netW: number;                    // P_net = P_panel·η − P_out
  state: FlowState;
  hoursToFull: number | null;      // null unless charging
  hoursLeft: number | null;        // null unless draining
  pctPerHour: number;              // |P_net| / capacity · 100
  fastCharging: boolean;
}

export function computeStats(t: Telemetry, cfg: Config = defaultConfig): Stats {
  const soc = socFromVoltage(t.batteryV);
  const capacityWh = cfg.batteryWh;
  const energyWh = soc * capacityWh;
  const panelW = Math.max(0, t.panelV * t.panelA);
  const outW = Math.max(0, t.batteryV * t.outA);
  const netW = panelW * cfg.efficiency - outW;
  const state: FlowState =
    netW > cfg.balancedW ? 'charging' : netW < -cfg.balancedW ? 'draining' : 'balanced';
  return {
    soc,
    energyWh,
    capacityWh,
    panelW,
    outW,
    netW,
    state,
    hoursToFull: state === 'charging' ? (capacityWh - energyWh) / netW : null,
    hoursLeft: state === 'draining' ? energyWh / -netW : null,
    pctPerHour: (Math.abs(netW) / capacityWh) * 100,
    fastCharging: t.fastCharging || panelW >= cfg.fastChargeW,
  };
}

// ---------------------------------------------------------------------------------------------
// Formatting

export const MINUS = '−';
export const DASH = '—';

/** 18:52 -> "6:52 PM" (formatted by hand so every platform/locale renders the same). */
export function formatClock(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** 278 -> "4 h 38 m" */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return m ? `${h} h ${m} m` : `${h} h`;
  return `${m} m`;
}

/** Fixed decimals with a real minus sign: -7.4 -> "−7.4" */
export function formatNumber(x: number, decimals = 1, signed = false): string {
  const s = Math.abs(x).toFixed(decimals);
  if (Number(s) === 0) return s;
  return x < 0 ? MINUS + s : signed ? `+${s}` : s;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "6:52 PM", or "Thu 6:52 PM" when it's more than a day away. */
function formatEta(now: Date, minutes: number): string {
  const at = new Date(now.getTime() + Math.round(minutes) * 60_000);
  const clock = formatClock(at);
  return minutes >= 24 * 60 ? `${WEEKDAYS[at.getDay()]} ${clock}` : clock;
}

export interface Headline {
  title: string;
  subline: string;
}

/** The screen's answer: "Full by 6:52 PM" / "Lasts until 1:41 AM" / "Holding steady". */
export function headline(s: Stats, now: Date): Headline {
  const w = formatNumber(Math.abs(s.netW));
  if (s.state === 'charging') {
    if (s.soc >= 0.995) return { title: 'Fully charged', subline: 'The panel is covering the output' };
    const min = s.hoursToFull! * 60;
    return {
      title: `Full by ${formatEta(now, min)}`,
      subline: `Charging at ${w} W, ${formatDuration(min)} to go at this rate`,
    };
  }
  if (s.state === 'draining') {
    if (s.soc <= 0.005) return { title: 'Battery empty', subline: 'Put the panel in the sun to charge' };
    const min = s.hoursLeft! * 60;
    return {
      title: `Lasts until ${formatEta(now, min)}`,
      subline: `Draining at ${w} W, ${formatDuration(min)} left at this rate`,
    };
  }
  return { title: 'Holding steady', subline: 'The panel matches what your devices use' };
}

// ---------------------------------------------------------------------------------------------
// Suggested charge time (§5.5)
// Main source: the solar forecast (weather/forecast.ts). Fallback when there's no forecast
// (no location permission / offline): the bank's own light history, assuming tomorrow ≈ yesterday.

export interface LightSample {
  t: number;    // ms since epoch
  pct: number;  // 0-100 % of full sun
}

export type Basis = 'forecast' | 'today' | 'yesterday';

export type Suggestion =
  | { kind: 'none' }
  | { kind: 'noStrong'; basis: Basis }
  | {
      kind: 'before' | 'inside' | 'after';
      basis: Basis;
      start: Date;          // window start, placed on the day it applies to
      end: Date;
      minutesLeft: number;  // only meaningful when inside
      weak: boolean;        // cloudy day: the sunniest stretch, but below strongLightPct
    };

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Same wall-clock time on another day (DST-safe). */
function onDay(t: number, dayStart: number): Date {
  const src = new Date(t);
  const d = new Date(dayStart);
  d.setHours(src.getHours(), src.getMinutes(), 0, 0);
  return d;
}

export function samplesForDay(samples: LightSample[], dayStart: number): LightSample[] {
  const next = new Date(dayStart);
  next.setDate(next.getDate() + 1);
  return samples
    .filter((s) => s.t >= dayStart && s.t < next.getTime())
    .sort((a, b) => a.t - b.t);
}

/**
 * The longest stretch where light stayed ≥ threshold. Crossing times are linearly
 * interpolated between samples, and dips shorter than maxGapMin don't split a stretch.
 */
export function longestStrongRun(
  day: LightSample[],
  threshold: number,
  maxGapMin: number,
): { start: number; end: number } | null {
  const runs: { start: number; end: number }[] = [];
  let start: number | null = null;
  const cross = (a: LightSample, b: LightSample) =>
    a.t + ((threshold - a.pct) / (b.pct - a.pct)) * (b.t - a.t);

  day.forEach((s, i) => {
    const prev = day[i - 1];
    if (s.pct >= threshold && start === null) start = prev ? cross(prev, s) : s.t;
    if (s.pct < threshold && start !== null) {
      runs.push({ start, end: cross(prev, s) });
      start = null;
    }
  });
  if (start !== null) runs.push({ start, end: day[day.length - 1].t });

  const merged: { start: number; end: number }[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && r.start - last.end < maxGapMin * 60_000) last.end = r.end;
    else merged.push({ ...r });
  }
  let best: { start: number; end: number } | null = null;
  for (const r of merged) if (!best || r.end - r.start > best.end - best.start) best = r;
  return best;
}

/** Which day's samples the suggestion is based on: today once the day is over, else yesterday. */
export function basisDay(
  samples: LightSample[],
  now: Date,
  cfg: Config = defaultConfig,
): { basis: Basis; day: LightSample[] } | null {
  const today = startOfDay(now.getTime());
  const todaySamples = samplesForDay(samples, today);
  if (now.getHours() >= cfg.dayCompleteHour && todaySamples.length >= cfg.minSamplesPerDay) {
    return { basis: 'today', day: todaySamples };
  }
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  const ySamples = samplesForDay(samples, y.getTime());
  if (ySamples.length >= cfg.minSamplesPerDay) return { basis: 'yesterday', day: ySamples };
  return null;
}

export function suggestWindow(
  samples: LightSample[],
  now: Date,
  cfg: Config = defaultConfig,
): Suggestion {
  const b = basisDay(samples, now, cfg);
  if (!b) return { kind: 'none' };
  const run = longestStrongRun(b.day, cfg.strongLightPct, cfg.suggestionMaxGapMin);
  if (!run) return { kind: 'noStrong', basis: b.basis };

  const round = (t: number) => Math.round(t / 60_000) * 60_000;
  const today = startOfDay(now.getTime());
  let start = onDay(round(run.start), today);
  let end = onDay(round(run.end), today);
  const t = now.getTime();
  const w = { basis: b.basis, weak: false };
  if (t < start.getTime()) return { kind: 'before', ...w, start, end, minutesLeft: 0 };
  if (t < end.getTime()) {
    const minutesLeft = (end.getTime() - t) / 60_000;
    return { kind: 'inside', ...w, start, end, minutesLeft };
  }
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  start = onDay(start.getTime(), tomorrow.getTime());
  end = onDay(end.getTime(), tomorrow.getTime());
  return { kind: 'after', ...w, start, end, minutesLeft: 0 };
}

/**
 * Best stretch of a forecast day: light ≥ strongLightPct, or on a cloudy day the stretch
 * near its peak (marked weak). Null when the day never gets useful sun.
 */
export function bestForecastRun(
  day: LightSample[],
  cfg: Config = defaultConfig,
): { start: number; end: number; weak: boolean } | null {
  const strong = longestStrongRun(day, cfg.strongLightPct, cfg.suggestionMaxGapMin);
  if (strong) return { ...strong, weak: false };
  const peak = day.reduce((m, s) => Math.max(m, s.pct), 0);
  if (peak < cfg.minUsefulSunPct) return null;
  const run = longestStrongRun(day, peak * cfg.weakDayFractionOfPeak, cfg.suggestionMaxGapMin);
  return run && { ...run, weak: true };
}

/** Today's window while it's still ahead or running, otherwise tomorrow's. */
export function suggestFromForecast(
  forecast: LightSample[],
  now: Date,
  cfg: Config = defaultConfig,
): Suggestion {
  // Forecasts are hourly, so minute precision would be fake
  const round5 = (t: number) => new Date(Math.round(t / 300_000) * 300_000);
  const t = now.getTime();
  const today = startOfDay(t);
  const todayRun = bestForecastRun(samplesForDay(forecast, today), cfg);
  if (todayRun) {
    const start = round5(todayRun.start);
    const end = round5(todayRun.end);
    const w = { basis: 'forecast' as const, weak: todayRun.weak, start, end };
    if (t < start.getTime()) return { kind: 'before', ...w, minutesLeft: 0 };
    if (t < end.getTime()) return { kind: 'inside', ...w, minutesLeft: (end.getTime() - t) / 60_000 };
  }
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = samplesForDay(forecast, tomorrow.getTime());
  if (!tomorrowDay.length) return { kind: 'none' };
  const run = bestForecastRun(tomorrowDay, cfg);
  if (!run) return { kind: 'noStrong', basis: 'forecast' };
  return {
    kind: 'after', basis: 'forecast', weak: run.weak,
    start: round5(run.start), end: round5(run.end), minutesLeft: 0,
  };
}

export function suggestionText(s: Suggestion, cfg: Config = defaultConfig): Headline {
  const strong = `above ${cfg.strongLightPct} %`;
  if (s.kind !== 'none' && s.basis === 'forecast') return forecastText(s);
  switch (s.kind) {
    case 'none':
      return { title: 'Not enough data yet', subline: 'Check back tomorrow.' };
    case 'noStrong':
      return {
        title: `No strong sun ${s.basis}`,
        subline: `Light never stayed ${strong}. Charge whenever the panel gets sun.`,
      };
    case 'inside':
      return {
        title: `Now until ${formatClock(s.end)}`,
        subline: `${formatDuration(s.minutesLeft)} of strong light left, based on ${s.basis}`,
      };
    case 'before':
    case 'after':
      return {
        title: `${s.kind === 'before' ? 'Today' : 'Tomorrow'}, ${formatClock(s.start)} – ${formatClock(s.end)}`,
        subline: `When light stayed ${strong} ${s.basis}`,
      };
  }
}

function forecastText(s: Exclude<Suggestion, { kind: 'none' }>): Headline {
  if (s.kind === 'noStrong') {
    return { title: 'No sun in the forecast', subline: 'Too cloudy to charge much today or tomorrow.' };
  }
  const range = `${formatClock(s.start)} \u2013 ${formatClock(s.end)}`;
  const day = s.kind === 'after' ? 'tomorrow' : 'today';
  if (s.kind === 'inside') {
    const left = formatDuration(s.minutesLeft);
    return {
      title: `Now until ${formatClock(s.end)}`,
      subline: s.weak
        ? `Sunniest part of a cloudy day, ${left} left`
        : `${left} of strong sun left in today\u2019s forecast`,
    };
  }
  return {
    title: `${s.kind === 'before' ? 'Today' : 'Tomorrow'}, ${range}`,
    subline: s.weak
      ? `Cloudy ${day}, so charging will be slow`
      : `Strongest sun in ${day}\u2019s forecast`,
  };
}
