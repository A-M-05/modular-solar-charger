// Derived statistics computed on the phone from raw telemetry (docs/SOLAR_BANK_APP_GUIDE.md §5).
import { BATTERY_WH, CHARGER_EFFICIENCY, FAST_CHARGE_W } from '../config';
import { Telemetry } from './telemetry';

// Resting-voltage -> state-of-charge table for a 4S LiFePO4 pack.
// LiFePO4 is very flat between 20-90 %, so this jumps around; coulomb counting is the better fix later.
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

/** |P_net| below this counts as balanced, so the headline doesn't flicker. */
const BALANCED_W = 0.1;

export type FlowState = 'charging' | 'draining' | 'balanced';

export interface Stats {
  soc: number;                 // 0-1
  eNowWh: number;              // energy in the battery now
  pPanel: number;              // W from the panel
  pOut: number;                // W to the output ports
  pNet: number;                // W into (+) or out of (−) the battery
  state: FlowState;
  pctPerHour: number;          // pNet as % of capacity per hour (signed)
  hoursToFull: number | null;  // null unless charging
  hoursLeft: number | null;    // null unless draining
  fastCharging: boolean;
}

export function computeStats(t: Telemetry, eta = CHARGER_EFFICIENCY): Stats {
  const soc = socFromVoltage(t.batteryV);
  const eNowWh = soc * BATTERY_WH;
  const pPanel = t.panelV * t.panelA;
  const pOut = t.batteryV * t.outA;
  const pNet = pPanel * eta - pOut;
  const state: FlowState = pNet > BALANCED_W ? 'charging' : pNet < -BALANCED_W ? 'draining' : 'balanced';
  return {
    soc,
    eNowWh,
    pPanel,
    pOut,
    pNet,
    state,
    pctPerHour: (pNet / BATTERY_WH) * 100,
    hoursToFull: state === 'charging' ? (BATTERY_WH - eNowWh) / pNet : null, // (E_max − E_now) / P_net
    hoursLeft: state === 'draining' ? eNowWh / -pNet : null,                 // E_now / (−P_net)
    fastCharging: pPanel >= FAST_CHARGE_W,
  };
}

/** Exponential moving average for smoothing noisy readings: y = αx + (1−α)y */
export function ema(prev: number | null, x: number, alpha = 0.2): number {
  return prev === null ? x : alpha * x + (1 - alpha) * prev;
}

/** "6:52 PM". Hand-rolled because Intl output varies by device (some use a narrow no-break space). */
export function formatClock(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "4 h 38 m" */
export function formatDuration(hours: number): string {
  const totalMin = Math.floor(hours * 60);
  return `${Math.floor(totalMin / 60)} h ${totalMin % 60} m`;
}

export function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 3_600_000);
}
