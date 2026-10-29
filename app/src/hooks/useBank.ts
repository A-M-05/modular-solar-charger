// Connection + smoothing + stale detection for the Home screen.
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { BankConnection, Status, createBankConnection } from '../ble/bankConnection';
import { MOCK_CLOCK, MOCK_EFFICIENCY, MOCK_HISTORY, Scenario, createMockConnection } from '../ble/mockConnection';
import { CHARGER_EFFICIENCY } from '../config';
import { ema } from '../protocol/stats';
import { Telemetry } from '../protocol/telemetry';
import { LightEntry, addSample, loadHistory, saveHistory, splitDays } from '../storage/lightHistory';

const STALE_MS = 3000;
const SMOOTHED = ['batteryV', 'panelV', 'panelA', 'outA', 'lightPct'] as const;

/** Web has no Bluetooth, so it always uses the mock. */
export const MOCK_ONLY = Platform.OS === 'web';

export function useBank() {
  const [useMock, setUseMock] = useState(__DEV__ || MOCK_ONLY);
  const [scenario, setScenario] = useState<Scenario>('charging');
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState<string>();
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [lastAt, setLastAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const smooth = useRef<Record<string, number | null>>({});
  const conn = useRef<BankConnection | null>(null);
  const connected = useRef(false);
  const [lightLog, setLightLog] = useState<LightEntry[]>([]);
  const lightLogRef = useRef<LightEntry[] | null>(null); // null until loaded, so we never overwrite saved history

  useEffect(() => {
    loadHistory().then((h) => { lightLogRef.current = h; setLightLog(h); });
  }, []);

  // The mock pretends it's the time in the mockups; the clock still ticks from there.
  const clock = useRef<() => Date>(() => new Date());
  useEffect(() => {
    if (!useMock) { clock.current = () => new Date(); return; }
    const [h, m] = MOCK_CLOCK[scenario];
    const base = new Date();
    base.setHours(h, m, 0, 0);
    const start = Date.now();
    clock.current = () => new Date(base.getTime() + Date.now() - start);
    setNow(clock.current());
  }, [useMock, scenario]);

  useEffect(() => {
    const id = setInterval(() => setNow(clock.current()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    smooth.current = {};
    const onT = (x: Telemetry) => {
      const s = { ...x };
      for (const k of SMOOTHED) s[k] = smooth.current[k] = ema(smooth.current[k] ?? null, x[k]);
      setTelemetry(s);
      setLastAt(clock.current());
      if (!useMock && lightLogRef.current) {
        const next = addSample(lightLogRef.current, s.lightPct, Date.now()); // every 30 min while connected
        if (next !== lightLogRef.current) {
          lightLogRef.current = next;
          setLightLog(next);
          saveHistory(next);
        }
      }
    };
    const onS = (s: Status, m?: string) => {
      connected.current = s === 'connected';
      setStatus(s);
      setMsg(m);
    };
    const c = useMock ? createMockConnection(onT, onS, scenario) : createBankConnection(onT, onS);
    conn.current = c;
    if (connected.current && useMock) c.connect(); // switching scenarios keeps the mock connected
    return () => {
      const was = connected.current;
      c.disconnect();
      connected.current = was;
    };
  }, [useMock, scenario]);

  const isConnected = status === 'connected';
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const history = useMock
    ? { today: MOCK_HISTORY.today.filter((x) => x.min <= nowMin), yesterday: MOCK_HISTORY.yesterday }
    : splitDays(lightLog, now.getTime());

  return {
    status,
    msg,
    telemetry,
    lastAt,
    now,
    stale: isConnected && lastAt !== null && now.getTime() - lastAt.getTime() > STALE_MS,
    efficiency: useMock ? MOCK_EFFICIENCY : CHARGER_EFFICIENCY,
    history,
    connect: () => conn.current?.connect(),
    disconnect: () => { connected.current = false; return conn.current?.disconnect(); },
    mock: { useMock, setUseMock, scenario, setScenario },
  };
}
