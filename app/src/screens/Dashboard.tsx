// Interim screen showing v2 data. Gets replaced by Home.tsx + components (guide §6–7).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { BankConnection, Status, createBankConnection } from '../ble/bankConnection';
import { MOCK_EFFICIENCY, SCENARIOS, Scenario, createMockConnection } from '../ble/mockConnection';
import { CHARGER_EFFICIENCY, FAST_CHARGE_W } from '../config';
import { addHours, computeStats, ema, formatClock, formatDuration } from '../protocol/stats';
import { Telemetry } from '../protocol/telemetry';

const SMOOTHED = ['batteryV', 'panelV', 'panelA', 'outA'] as const;
const countBits = (n: number) => n.toString(2).replace(/0/g, '').length;

export default function Dashboard() {
  const [useMock, setUseMock] = useState(true);
  const [scenario, setScenario] = useState<Scenario>('charging');
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState<string>();
  const [t, setT] = useState<Telemetry | null>(null);
  const smooth = useRef<Record<string, number | null>>({});
  const conn = useRef<BankConnection | null>(null);

  useEffect(() => {
    smooth.current = {};
    const onT = (x: Telemetry) => {
      const s = { ...x };
      for (const k of SMOOTHED) s[k] = smooth.current[k] = ema(smooth.current[k] ?? null, x[k]);
      setT(s);
    };
    const onS = (s: Status, m?: string) => { setStatus(s); setMsg(m); };
    conn.current = useMock ? createMockConnection(onT, onS, scenario) : createBankConnection(onT, onS);
    return () => { conn.current?.disconnect(); };
  }, [useMock, scenario]);

  const stats = useMemo(() => (t ? computeStats(t, useMock ? MOCK_EFFICIENCY : CHARGER_EFFICIENCY) : null), [t, useMock]);
  const connected = status === 'connected';
  const now = new Date();
  const headline = !stats ? null
    : stats.hoursToFull !== null ? `Full by ${formatClock(addHours(now, stats.hoursToFull))}`
    : stats.hoursLeft !== null ? `Lasts until ${formatClock(addHours(now, stats.hoursLeft))}`
    : 'Holding steady';

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Solar Bank</Text>

      {__DEV__ && (
        <>
          <View style={styles.row}>
            <Text>Mock data</Text>
            <Switch value={useMock} onValueChange={setUseMock} disabled={connected} />
          </View>
          {useMock && (
            <View style={[styles.row, styles.wrap]}>
              {SCENARIOS.map((s) => (
                <Pressable key={s} style={[styles.chip, scenario === s && styles.chipOn]} onPress={() => setScenario(s)}>
                  <Text style={scenario === s ? styles.chipOnText : undefined}>{s}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      <Pressable
        style={[styles.button, connected && styles.buttonAlt]}
        onPress={() => (connected ? conn.current?.disconnect() : conn.current?.connect())}
      >
        <Text style={styles.buttonText}>{connected ? 'Disconnect' : 'Connect to Solar Bank'}</Text>
      </Pressable>
      <Text style={styles.status}>{status}{msg ? ` · ${msg}` : ''}</Text>

      {t && stats && (
        <>
          <Text style={styles.headline}>{headline}</Text>
          {(stats.hoursToFull ?? stats.hoursLeft) !== null && (
            <Text style={styles.status}>{formatDuration((stats.hoursToFull ?? stats.hoursLeft)!)} at this rate</Text>
          )}
          <View style={styles.grid}>
            <Tile label="Battery" value={`${Math.round(stats.soc * 100)}%`}
              sub={`${t.batteryV.toFixed(1)} V · ${stats.eNowWh.toFixed(1)} Wh`} />
            <Tile label="Panel" value={`${stats.pPanel.toFixed(1)} W`}
              sub={`${t.panelRatingW} W · max ${t.maxRatingW}`} />
            <Tile label="Battery flow" value={`${stats.pNet >= 0 ? '+' : '−'}${Math.abs(stats.pNet).toFixed(1)} W`}
              sub={`${stats.pctPerHour.toFixed(1)} % per hour`} />
            <Tile label="Devices" value={`${stats.pOut.toFixed(1)} W`} sub={`${countBits(t.portsOn)} ports on`} />
            <Tile label="Light level" value={`${Math.round(t.lightPct)}%`} sub="of full sun" />
            <Tile label="Fast charging" value={stats.fastCharging ? 'On' : 'Off'} sub={`Needs ${FAST_CHARGE_W} W in`} />
          </View>
          {t.overRating && <Text style={styles.status}>This panel is above the {t.maxRatingW} W limit</Text>}
        </>
      )}
    </ScrollView>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      {sub && <Text style={styles.tileSub}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 60, gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  headline: { fontSize: 24, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexWrap: 'wrap' },
  button: { backgroundColor: '#1f6feb', padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonAlt: { backgroundColor: '#6e7781' },
  buttonText: { color: 'white', fontWeight: '600' },
  status: { color: '#6e7781' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', backgroundColor: '#f2f4f7', borderRadius: 12, padding: 14 },
  tileLabel: { color: '#6e7781', fontSize: 13 },
  tileValue: { fontSize: 24, fontWeight: '700', marginTop: 4, fontVariant: ['tabular-nums'] },
  tileSub: { color: '#6e7781', marginTop: 2 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#e4e7eb' },
  chipOn: { backgroundColor: '#1f6feb' },
  chipOnText: { color: 'white' },
});
