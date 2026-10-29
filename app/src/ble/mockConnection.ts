// Fake power bank for building the UI without hardware (works in Expo Go and on a laptop).
// The charging and draining scenarios reproduce the mockups in docs/ui/ exactly.
import { BankConnection, Status } from './bankConnection';
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

export function mockTelemetry(scenario: Scenario): Telemetry {
  return { ...base, ...values[scenario] };
}

const noise = (x: number) => x * (1 + (Math.random() - 0.5) * 0.04); // ±2 %

export function createMockConnection(
  onTelemetry: (t: Telemetry) => void,
  onStatus: (s: Status, msg?: string) => void,
  scenario: Scenario,
): BankConnection {
  let timer: ReturnType<typeof setInterval> | null = null;
  const start = Date.now();

  return {
    async connect() {
      onStatus('connected', `Mock: ${scenario}`);
      timer = setInterval(() => {
        const sec = (Date.now() - start) / 1000;
        if (scenario === 'stale' && sec > 5) return; // stays "connected" but goes quiet
        const t = mockTelemetry(scenario);
        onTelemetry({
          ...t,
          panelA: noise(t.panelA),
          outA: noise(t.outA),
          lightPct: Math.min(100, noise(t.lightPct)),
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
