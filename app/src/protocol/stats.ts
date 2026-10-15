// Derived statistics computed on the phone from raw telemetry.
import { Telemetry } from './telemetry';

// 2S LiPo (OVONIC 2200 mAh 7.4 V)
export const PACK_WH = 2.2 * 7.4; // ≈ 16.3 Wh

// Resting-voltage -> state-of-charge table for a 2S pack (approximate; tune with real data)
const SOC_TABLE: [number, number][] = [
  [6.6, 0], [7.2, 0.1], [7.4, 0.3], [7.6, 0.5], [7.8, 0.65], [8.0, 0.8], [8.2, 0.92], [8.4, 1],
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

export interface Stats {
  soc: number;         // 0-1
  pIn: number;         // W from solar
  pOut: number;        // W used
  hoursToFull: number | null;  // null if not charging
  hoursLeft: number | null;    // null if not draining
}

export function computeStats(t: Telemetry): Stats {
  const soc = socFromVoltage(t.batteryV);
  const pIn = t.batteryV * t.panelA;   // P = V·I
  const pOut = t.batteryV * t.loadA;
  const net = pIn - pOut;
  const eNow = soc * PACK_WH;
  return {
    soc,
    pIn,
    pOut,
    hoursToFull: net > 0.05 ? (PACK_WH - eNow) / net : null, // t_full = (E_max − E_now)/(P_in − P_out)
    hoursLeft: net < -0.05 ? eNow / -net : null,              // t_left = E_now/(P_out − P_in)
  };
}

/** Exponential moving average for smoothing noisy readings: y = αx + (1−α)y */
export function ema(prev: number | null, x: number, alpha = 0.2): number {
  return prev === null ? x : alpha * x + (1 - alpha) * prev;
}
