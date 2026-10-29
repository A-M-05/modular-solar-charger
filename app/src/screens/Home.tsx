// Picks the state (charging / draining / balanced / not connected) and lays out the cards (guide §7).
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCENARIOS } from '../ble/mockConnection';
import BatteryCard from '../components/BatteryCard';
import Header from '../components/Header';
import Headline from '../components/Headline';
import PowerFlow from '../components/PowerFlow';
import RatesGrid, { RatesGridOffline } from '../components/RatesGrid';
import SuggestionCard from '../components/SuggestionCard';
import { MOCK_ONLY, useBank } from '../hooks/useBank';
import { Stats, addHours, computeStats, formatClock, formatDuration, suggestWindow } from '../protocol/stats';
import { color, font, radius, size, space } from '../theme';

const NOT_CONNECTED_HINT = 'Turn the bank on and keep your phone within a few metres of it.';

/** Holds the shown finish time until the estimate moves by 2+ minutes, so noise doesn't make it flicker. */
function useSteadyTime(target: Date | null, key: string): Date | null {
  const ref = useRef<{ key: string; at: Date } | null>(null);
  if (!target) return (ref.current = null);
  const prev = ref.current;
  if (!prev || prev.key !== key || Math.abs(prev.at.getTime() - target.getTime()) >= 120_000) {
    ref.current = { key, at: target };
  }
  return ref.current!.at;
}

function headline(stats: Stats | null, finish: Date | null, now: Date): [string, string] {
  if (!stats) return ['Connecting…', 'Waiting for the first reading.'];
  const left = finish ? formatDuration((finish.getTime() - now.getTime()) / 3_600_000) : '';
  if (stats.state === 'charging' && finish) {
    return [`Full by ${formatClock(finish)}`, `Charging at ${stats.pNet.toFixed(1)} W, ${left} to go at this rate`];
  }
  if (stats.state === 'draining' && finish) {
    return [`Lasts until ${formatClock(finish)}`, `Draining at ${(-stats.pNet).toFixed(1)} W, ${left} left at this rate`];
  }
  return ['Holding steady', `Sun matches the ${stats.pOut.toFixed(1)} W output`];
}

export default function Home() {
  const bank = useBank();
  const insets = useSafeAreaInsets();
  const [devOpen, setDevOpen] = useState(false);
  const { telemetry: t, now, status } = bank;
  const live = status === 'connected';
  const busy = status === 'scanning' || status === 'connecting';
  const stats = t ? computeStats(t, bank.efficiency) : null;
  const hours = live ? stats?.hoursToFull ?? stats?.hoursLeft ?? null : null;
  const finish = useSteadyTime(hours === null ? null : addHours(now, hours), stats?.state ?? '');
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const [title, sub] = live
    ? headline(stats, finish, now)
    : ['Not connected', status === 'error' && bank.msg ? bank.msg : NOT_CONNECTED_HINT];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.top}>
          <Header live={live} stale={bank.stale} now={now} lastAt={bank.lastAt} onLongPress={() => setDevOpen((o) => !o)} />
          <Headline title={title} sub={sub} />
        </View>

        {devOpen && (
          <View style={styles.dev}>
            <Text style={styles.devTitle}>Developer</Text>
            {!MOCK_ONLY && (
              <View style={styles.devRow}>
                <Text style={styles.devText}>Mock data</Text>
                <Switch value={bank.mock.useMock} onValueChange={bank.mock.setUseMock} disabled={live} />
              </View>
            )}
            {bank.mock.useMock && (
              <View style={[styles.devRow, styles.wrap]}>
                {SCENARIOS.map((s) => {
                  const on = bank.mock.scenario === s;
                  return (
                    <Pressable key={s} style={[styles.chip, on && styles.chipOn]} onPress={() => bank.mock.setScenario(s)}
                      accessibilityRole="button" accessibilityState={{ selected: on }}>
                      <Text style={[styles.devText, on && styles.chipOnText]}>{s}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {live && (
              <Pressable style={styles.chip} onPress={bank.disconnect} accessibilityRole="button">
                <Text style={styles.devText}>Disconnect</Text>
              </Pressable>
            )}
          </View>
        )}

        {!live && (
          <Pressable
            style={[styles.button, busy && styles.buttonBusy]}
            disabled={busy}
            onPress={bank.connect}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>
              {busy ? 'Looking for Solar Bank…' : status === 'error' ? 'Try again' : 'Connect to Solar Bank'}
            </Text>
          </Pressable>
        )}

        {!live && (
          <>
            {t && stats && (
              <BatteryCard soc={stats.soc} eNowWh={stats.eNowWh} batteryV={t.batteryV} lastReadingAt={bank.lastAt} />
            )}
            <RatesGridOffline />
          </>
        )}

        {live && t && stats && (
          <>
            <BatteryCard soc={stats.soc} eNowWh={stats.eNowWh} batteryV={t.batteryV} />
            <PowerFlow t={t} stats={stats} />
            {t.overRating && (
              <Text style={styles.notice}>This panel is above the {t.maxRatingW} W limit</Text>
            )}
            <RatesGrid t={t} stats={stats} />
            <SuggestionCard
              suggestion={suggestWindow(nowMin, bank.history.today, bank.history.yesterday)}
              today={[...bank.history.today, { min: nowMin, pct: t.lightPct }]}
              yesterday={bank.history.yesterday}
              nowMin={nowMin}
            />
          </>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ground },
  page: { paddingHorizontal: space.margin, gap: space.gap, width: '100%', maxWidth: 480, alignSelf: 'center' },
  top: { gap: 4, marginBottom: 4 },
  button: {
    minHeight: 48, borderRadius: radius.control, backgroundColor: color.text,
    alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 8,
  },
  buttonBusy: { backgroundColor: color.muted },
  buttonText: { fontFamily: font.medium, fontSize: size.button, color: color.surface },
  notice: { fontFamily: font.regular, fontSize: size.label, color: color.accent },
  dev: { borderWidth: 1, borderColor: color.border, borderRadius: radius.card, padding: space.cardPad, gap: 8 },
  devTitle: { fontFamily: font.semibold, fontSize: size.label, color: color.muted },
  devRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexWrap: 'wrap' },
  devText: { fontFamily: font.regular, fontSize: size.body, color: color.text },
  chip: {
    minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 14,
    borderRadius: radius.control, backgroundColor: color.raised,
  },
  chipOn: { backgroundColor: color.text },
  chipOnText: { color: color.surface },
});
