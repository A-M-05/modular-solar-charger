import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { CarConnection, Status, createCarConnection } from '../ble/carConnection';
import { createMockConnection } from '../ble/mockConnection';
import { computeStats, ema } from '../protocol/stats';
import { DriveMode, Telemetry } from '../protocol/telemetry';

const fmtHours = (h: number | null) =>
  h === null ? '—' : h > 99 ? '>99 h' : `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min`;

export default function Dashboard() {
  const [useMock, setUseMock] = useState(true);
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState<string>();
  const [t, setT] = useState<Telemetry | null>(null);
  const smoothV = useRef<number | null>(null);
  const conn = useRef<CarConnection | null>(null);

  useEffect(() => {
    const onT = (x: Telemetry) => {
      smoothV.current = ema(smoothV.current, x.batteryV);
      setT({ ...x, batteryV: smoothV.current });
    };
    const onS = (s: Status, m?: string) => { setStatus(s); setMsg(m); };
    conn.current = useMock ? createMockConnection(onT, onS) : createCarConnection(onT, onS);
    return () => { conn.current?.disconnect(); };
  }, [useMock]);

  const stats = useMemo(() => (t ? computeStats(t) : null), [t]);
  const connected = status === 'connected';

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Solar RC Car</Text>

      <View style={styles.row}>
        <Text>Mock data</Text>
        <Switch value={useMock} onValueChange={setUseMock} disabled={connected} />
      </View>

      <Pressable
        style={[styles.button, connected && styles.buttonAlt]}
        onPress={() => (connected ? conn.current?.disconnect() : conn.current?.connect())}
      >
        <Text style={styles.buttonText}>{connected ? 'Disconnect' : 'Connect to car'}</Text>
      </Pressable>
      <Text style={styles.status}>{status}{msg ? ` · ${msg}` : ''}</Text>

      {t && stats && (
        <>
          <View style={styles.grid}>
            <Tile label="Battery" value={`${Math.round(stats.soc * 100)}%`} sub={`${t.batteryV.toFixed(2)} V`} />
            <Tile label="Solar in" value={`${stats.pIn.toFixed(2)} W`} sub={`${t.panelA.toFixed(2)} A`} />
            <Tile label="Using" value={`${stats.pOut.toFixed(2)} W`} sub={`${t.loadA.toFixed(2)} A`} />
            <Tile
              label={stats.hoursToFull !== null ? 'Time to full' : 'Time left'}
              value={fmtHours(stats.hoursToFull ?? stats.hoursLeft)}
            />
          </View>

          <Text style={styles.section}>Light sensors</Text>
          {t.light.map((l, i) => (
            <View key={i} style={styles.barRow}>
              <Text style={styles.barLabel}>{['Front L', 'Front R', 'Back L', 'Back R'][i]}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(l / 4095) * 100}%` }]} />
              </View>
            </View>
          ))}

          <Text style={styles.section}>Mode</Text>
          <View style={styles.row}>
            {[DriveMode.Manual, DriveMode.Auto].map((m) => (
              <Pressable
                key={m}
                style={[styles.chip, t.mode === m && styles.chipOn]}
                onPress={() => conn.current?.setMode(m)}
              >
                <Text style={t.mode === m ? styles.chipOnText : undefined}>
                  {m === DriveMode.Manual ? 'Manual' : 'Auto (seek light)'}
                </Text>
              </Pressable>
            ))}
          </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  button: { backgroundColor: '#1f6feb', padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonAlt: { backgroundColor: '#6e7781' },
  buttonText: { color: 'white', fontWeight: '600' },
  status: { color: '#6e7781' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', backgroundColor: '#f2f4f7', borderRadius: 12, padding: 14 },
  tileLabel: { color: '#6e7781', fontSize: 13 },
  tileValue: { fontSize: 24, fontWeight: '700', marginTop: 4 },
  tileSub: { color: '#6e7781', marginTop: 2 },
  section: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 60, color: '#6e7781' },
  barTrack: { flex: 1, height: 12, backgroundColor: '#e4e7eb', borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#e3a008' },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#e4e7eb' },
  chipOn: { backgroundColor: '#1f6feb' },
  chipOnText: { color: 'white' },
});
