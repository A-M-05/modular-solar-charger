// Fake power bank for building the UI without hardware (works in Expo Go and on a laptop).
// Each scenario starts its own clock at the time the mockups show, so the screen should
// read exactly like the design (e.g. charging at 2:14 PM).
import { BankConnection, Status } from './bankConnection';
import { LightSample } from '../protocol/stats';
import { Telemetry } from '../protocol/telemetry';

export type Scenario = 'charging' | 'draining' | 'balanced' | 'stale' | 'overRating';
export const SCENARIOS: Scenario[] = ['charging', 'draining', 'balanced', 'stale', 'overRating'];

interface ScenarioSpec {
  clock: [number, number];  // hour, minute the mock clock starts at
  batteryV: number;
  panelV: number;
  panelW: number;
  outW: number;
  lightPct: number;
  panelRatingW: number;
  portsOn: number;
  stopAfterS?: number;      // stop emitting (to test the stale state)
}

// 13.1733 V → 62 % and 13.1467 V → 54 % on the LiFePO4 table (both display as in the mockups).
const SPECS: Record<Scenario, ScenarioSpec> = {
  charging: {
    clock: [14, 14], batteryV: 13.1 + 0.22 / 3, panelV: 18, panelW: 9.4, outW: 3.1,
    lightPct: 71, panelRatingW: 20, portsOn: 0b011,
  },
  draining: {
    clock: [20, 5], batteryV: 13.1 + 0.14 / 3, panelV: 0, panelW: 0, outW: 7.4,
    lightPct: 0, panelRatingW: 20, portsOn: 0b111,
  },
  balanced: {
    clock: [16, 20], batteryV: 13.2, panelV: 17, panelW: 4.5, outW: 4.05,
    lightPct: 34, panelRatingW: 20, portsOn: 0b001,
  },
  stale: {
    clock: [14, 14], batteryV: 13.1 + 0.22 / 3, panelV: 18, panelW: 9.4, outW: 3.1,
    lightPct: 71, panelRatingW: 20, portsOn: 0b011, stopAfterS: 5,
  },
  overRating: {
    clock: [12, 40], batteryV: 13.25, panelV: 20, panelW: 22, outW: 2,
    lightPct: 88, panelRatingW: 40, portsOn: 0b001,
  },
};

const MAX_RATING_W = 30;
const FAST_W = 15;

/** ±pct random noise, so the smoothing has something to do. */
const jitter = (x: number, pct = 2) => x * (1 + ((Math.random() * 2 - 1) * pct) / 100);

export function createMockConnection(
  scenario: Scenario,
  noise: boolean,
  onTelemetry: (t: Telemetry) => void,
  onStatus: (s: Status, msg?: string) => void,
): BankConnection {
  let timer: ReturnType<typeof setInterval> | null = null;
  const spec = SPECS[scenario];
  const noisy = (x: number) => (noise ? jitter(x) : x);
  const realStart = Date.now();
  const clockStart = new Date();
  clockStart.setHours(spec.clock[0], spec.clock[1], 0, 0);

  return {
    now: () => clockStart.getTime() + (Date.now() - realStart),
    async connect() {
      onStatus('scanning');
      await new Promise((r) => setTimeout(r, 600));
      onStatus('connected');
      const connectedAt = Date.now();
      timer = setInterval(() => {
        const sec = (Date.now() - connectedAt) / 1000;
        if (spec.stopAfterS && sec > spec.stopAfterS) return;
        const panelW = noisy(spec.panelW);
        const outW = noisy(spec.outW);
        const batteryV = spec.batteryV + (noise ? (Math.random() - 0.5) * 0.001 : 0); // ±0.5 mV (SoC is very sensitive to V)
        onTelemetry({
          batteryV,
          panelV: spec.panelV,
          panelA: spec.panelV > 0 ? panelW / spec.panelV : 0,
          outA: outW / batteryV,
          lightPct: Math.min(100, noisy(spec.lightPct)),
          panelConnected: true,
          fastCharging: panelW >= FAST_W,
          overRating: spec.panelRatingW > MAX_RATING_W,
          panelRatingW: spec.panelRatingW,
          maxRatingW: MAX_RATING_W,
          portsOn: spec.portsOn,
          uptimeS: sec,
        });
      }, 200);
    },
    async disconnect() {
      if (timer) clearInterval(timer);
      timer = null;
      onStatus('idle');
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Fake light history so the suggestion card has something to show.

// Clear-sky bell curve: peaks at 90 % at 1:10 PM and crosses 50 % at 10:40 AM and 3:40 PM.
const PEAK = 90;
const NOON = 13 + 10 / 60;
const SIGMA2 = (2.5 * 2.5) / (2 * Math.log(PEAK / 50));
const clearSky = (h: number) => PEAK * Math.exp(-((h - NOON) ** 2) / (2 * SIGMA2));

// Today: a cloud passes from 10:50 to 11:40 and a thin one around 2 PM.
function cloudyToday(h: number): number {
  let x = clearSky(h);
  if (h > 10 + 45 / 60 && h < 11 + 40 / 60) x *= 0.65;
  if (h > 13.85 && h < 14.6) x *= 0.85;
  return x;
}

/** 10-minute samples, 5 AM – 9 PM yesterday and 5 AM – now today. */
export function mockLightHistory(nowMs: number): LightSample[] {
  const out: LightSample[] = [];
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const round = (x: number) => Math.round(x * 10) / 10; // same precision as the packet
  for (let m = 5 * 60; m <= 21 * 60; m += 10) {
    const y = new Date(yesterday);
    y.setHours(0, m, 0, 0);
    out.push({ t: y.getTime(), pct: round(clearSky(m / 60)) });
    const t = new Date(today);
    t.setHours(0, m, 0, 0);
    if (t.getTime() <= nowMs) out.push({ t: t.getTime(), pct: round(cloudyToday(m / 60)) });
  }
  return out;
}

/** A clear-sky forecast for the mock: 10-minute samples today and tomorrow, 5 AM – 9 PM. */
export function mockForecast(dayStart: number): LightSample[] {
  const out: LightSample[] = [];
  for (const offset of [0, 1]) {
    for (let m = 5 * 60; m <= 21 * 60; m += 10) {
      const d = new Date(dayStart);
      d.setDate(d.getDate() + offset);
      d.setHours(0, m, 0, 0);
      out.push({ t: d.getTime(), pct: Math.round(clearSky(m / 60) * 10) / 10 });
    }
  }
  return out;
}
