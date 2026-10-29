// Owns the connection (real or mock) and everything the screen needs from it:
// smoothed telemetry, stale detection, the light history and the last known battery level.
import { useCallback, useEffect, useRef, useState } from 'react';
import { BankConnection, Status, bleAvailable, createBankConnection } from '../ble/bankConnection';
import { Scenario, createMockConnection, mockLightHistory } from '../ble/mockConnection';
import { config } from '../config';
import { LightSample, computeStats, ema } from '../protocol/stats';
import { Telemetry } from '../protocol/telemetry';
import {
  LastReading,
  loadLastReading,
  loadLightHistory,
  prune,
  saveLastReading,
  saveLightHistory,
} from '../storage/lightHistory';

const SMOOTHED = ['batteryV', 'panelV', 'panelA', 'outA', 'lightPct'] as const;

export interface Bank {
  status: Status;
  message?: string;
  telemetry: Telemetry | null;  // smoothed
  stale: boolean;
  lastPacketAt: number | null;  // on the bank clock
  now: number;                  // bank clock (the mock runs its own)
  history: LightSample[];
  lastReading: LastReading | null;
  connect(): void;
  disconnect(): void;
  // Dev-only
  mock: boolean;
  mockForced: boolean;          // no BLE in this build (Expo Go / web)
  scenario: Scenario;
  noise: boolean;               // mock adds ±2 % jitter to show off the smoothing
  setMock(on: boolean): void;
  setScenario(s: Scenario): void;
  setNoise(on: boolean): void;
}

export function useBank(): Bank {
  const [mock, setMock] = useState(!bleAvailable);
  const [scenario, setScenario] = useState<Scenario>('charging');
  const [noise, setNoise] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>();
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [lastPacketAt, setLastPacketAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [stale, setStale] = useState(false);
  const [history, setHistory] = useState<LightSample[]>([]);
  const [lastReading, setLastReading] = useState<LastReading | null>(null);

  const conn = useRef<BankConnection | null>(null);
  const smooth = useRef<Partial<Record<(typeof SMOOTHED)[number], number>>>({});
  const lastPacketReal = useRef(0);
  const lastSavedReading = useRef(0);
  const historyRef = useRef<LightSample[]>([]);
  const readingRef = useRef<LastReading | null>(null);

  // Real mode keeps its history on the phone; mock mode makes up two days in memory.
  useEffect(() => {
    if (mock) return;
    loadLightHistory().then((h) => { historyRef.current = h; setHistory(h); });
    loadLastReading().then((r) => { readingRef.current = r; setLastReading(r); });
  }, [mock]);

  useEffect(() => {
    smooth.current = {};
    setTelemetry(null);
    setLastPacketAt(null);
    setStale(false);

    const onTelemetry = (raw: Telemetry) => {
      const c = conn.current!;
      const t = { ...raw };
      for (const k of SMOOTHED) t[k] = smooth.current[k] = ema(smooth.current[k] ?? null, raw[k]);
      const clock = c.now();
      lastPacketReal.current = Date.now();
      setTelemetry(t);
      setLastPacketAt(clock);
      setNow(clock);
      setStale(false);

      // Light sample every 30 min (of bank clock)
      const h = historyRef.current;
      if (!h.length || clock - h[h.length - 1].t >= config.lightSampleEveryMin * 60_000) {
        const next = prune([...h, { t: clock, pct: t.lightPct }], clock);
        historyRef.current = next;
        setHistory(next);
        if (!mock) saveLightHistory(next);
      }

      // Remember the battery level for the "Not connected" screen
      const s = computeStats(t);
      readingRef.current = { t: clock, soc: s.soc, energyWh: s.energyWh };
      if (!mock && Date.now() - lastSavedReading.current > 10_000) {
        lastSavedReading.current = Date.now();
        saveLastReading(readingRef.current);
      }
    };

    const onStatus = (s: Status, msg?: string) => {
      setStatus(s);
      setMessage(msg);
      if (s !== 'connected' && readingRef.current) {
        setLastReading(readingRef.current);
        if (!mock) saveLastReading(readingRef.current);
      }
    };

    const c = mock
      ? createMockConnection(scenario, noise, onTelemetry, onStatus)
      : createBankConnection(onTelemetry, onStatus);
    conn.current = c;
    if (mock) {
      const nowMs = c.now();
      historyRef.current = mockLightHistory(nowMs);
      setHistory(historyRef.current);
      // What the "Not connected" mockup shows
      const r = new Date(nowMs);
      r.setHours(20, 5, 0, 0);
      readingRef.current = null;
      setLastReading({ t: r.getTime(), soc: 0.54, energyWh: 0.54 * config.batteryWh });
    }
    setNow(c.now());
    c.connect();
    return () => { c.disconnect(); };
  }, [mock, scenario, noise]);

  // 1 Hz tick: keeps the header clock moving and spots a silent connection.
  useEffect(() => {
    const id = setInterval(() => {
      if (conn.current) setNow(conn.current.now());
      setStale(
        status === 'connected' &&
          lastPacketReal.current > 0 &&
          Date.now() - lastPacketReal.current > config.staleAfterMs,
      );
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  const connect = useCallback(() => {
    lastPacketReal.current = 0;
    conn.current?.connect();
  }, []);
  const disconnect = useCallback(() => { conn.current?.disconnect(); }, []);

  return {
    status,
    message,
    telemetry: status === 'connected' ? telemetry : null,
    stale,
    lastPacketAt,
    now,
    history,
    lastReading,
    connect,
    disconnect,
    mock,
    mockForced: !bleAvailable,
    scenario,
    noise,
    setMock: (on) => setMock(on || !bleAvailable),
    setScenario,
    setNoise,
  };
}
