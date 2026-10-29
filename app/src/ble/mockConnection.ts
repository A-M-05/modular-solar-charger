// Fake power bank for building the UI without hardware (works in Expo Go and on a laptop).
// The charging and draining scenarios reproduce the mockups in docs/ui/ exactly.
import { BankConnection, Status } from './bankConnection';
import { Sample } from '../protocol/stats';
import { Telemetry } from '../protocol/telemetry';
import { MAX_PANEL_W } from '../config';

export type Scenario = 'charging' | 'draining' | 'balanced' | 'stale' | 'overRating';
export const SCENARIOS: Scenario[] = ['charging', 'draining', 'balanced', 'stale', 'overRating'];

// The mockups assume no charger losses (9.4 W in = 6.3 W to battery + 3.1 W out).
// ponytail: mock-only η = 1; drop it once the mockups are redrawn with η = 0.9.
export const MOCK_EFFICIENCY = 1;

const base: Telemetry = {
  version: 2, panelConnected: true, fastCharging: false, overRating: false,
  batteryV: 13, panelV: 0, panelA: 0, outA: 0, lightPct: 0,
  panelRatingW: 20, maxRatingW: MAX_PANEL_W, portsOn: 0, uptimeS: 0,
};

// Battery voltages are picked so the SoC table gives the mockup's 62 % / 47.6 Wh and 54 % / 41.5 Wh
// while still displaying as "13.2 V" and "13.1 V".
const charging: Partial<Telemetry> = {
  batteryV: 13.1732, panelV: 18.8, panelA: 0.5, outA: 3.1 / 13.1732, lightPct: 71, portsOn: 0b011,
};
const values: Record<Scenario, Partial<Telemetry>> = {
  charging,
  draining:   { batteryV: 13.147, outA: 7.4 / 13.147, portsOn: 0b111 },
  balanced:   { batteryV: 13.15, panelV: 18, panelA: 0.2, outA: 3.6 / 13.15, lightPct: 30, portsOn: 0b001 },
  stale:      charging,
  overRating: { batteryV: 13.25, panelV: 20, panelA: 1.6, outA: 3.1 / 13.25, lightPct: 90, portsOn: 0b011,
                panelRatingW: 40, overRating: true, fastCharging: true },
};

/** Wall-clock time each scenario pretends it is, so the screen matches docs/ui/ (charging 2:14 PM, draining 8:05 PM). */
export const MOCK_CLOCK: Record<Scenario, [number, number]> = {
  charging: [14, 14], draining: [20, 5], balanced: [9, 30], stale: [14, 14], overRating: [13, 0],
};

// Light history every 30 min from 5:30 AM to 8:30 PM, traced from the chart in docs/ui/.
// Both days cross 50 % at 10:40 AM and 3:40 PM, so the suggested window matches the mockups.
const halfHours = (pcts: number[]): Sample[] => pcts.map((pct, i) => ({ min: 330 + i * 30, pct }));
export const MOCK_HISTORY = {
  yesterday: halfHours([0, 1, 2, 4, 7, 10, 15, 21, 28, 36, 46, 58, 68, 77, 84, 89, 88, 82, 74, 64, 54, 42, 32, 23, 16, 10, 6, 3, 1, 0, 0]),
  today: halfHours([0, 1, 2, 4, 7, 10, 15, 21, 28, 36, 46, 58, 51, 83, 88, 90, 89, 76, 70, 66, 54, 42, 33, 25, 17, 11, 6, 3, 1, 0, 0]),
};

export function mockTelemetry(scenario: Scenario): Telemetry {
  return { ...base, ...values[scenario] };
}

// ±0.5 %: enough to see the smoothing work while the screen still reads the mockup's exact numbers
// (the guide's ±2 % moves the first decimal and the finish time by a few minutes).
const noise = (x: number) => x * (1 + (Math.random() - 0.5) * 0.01);

export function createMockConnection(
  onTelemetry: (t: Telemetry) => void,
  onStatus: (s: Status, msg?: string) => void,
  scenario: Scenario,
): BankConnection {
  let timer: ReturnType<typeof setInterval> | null = null;
  let first = true;
  const start = Date.now();

  return {
    async connect() {
      onStatus('connected', `Mock: ${scenario}`);
      timer = setInterval(() => {
        const sec = (Date.now() - start) / 1000;
        if (scenario === 'stale' && sec > 5) return; // stays "connected" but goes quiet
        const t = mockTelemetry(scenario);
        // First packet is exact: smoothing starts from it, so it sets what the screen settles on.
        const n = first ? (x: number) => x : noise;
        first = false;
        onTelemetry({
          ...t,
          panelA: n(t.panelA),
          outA: n(t.outA),
          lightPct: Math.min(100, n(t.lightPct)),
          uptimeS: sec,
        });
      }, 200);
    },
    async disconnect() {
      if (timer) clearInterval(timer);
      onStatus('idle');
    },
  };
}
