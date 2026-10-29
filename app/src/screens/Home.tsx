// Picks the screen state and lays out the cards. See SOLAR_BANK_APP_GUIDE.md §7.
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BatteryCard from '../components/BatteryCard';
import Header, { Liveness } from '../components/Header';
import Headline from '../components/Headline';
import PowerFlow from '../components/PowerFlow';
import RatesGrid from '../components/RatesGrid';
import SuggestionCard from '../components/SuggestionCard';
import { SCENARIOS } from '../ble/mockConnection';
import { config } from '../config';
import { Bank, useBank } from '../hooks/useBank';
import { useForecast } from '../hooks/useForecast';
import { useReduceMotion } from '../hooks/useReduceMotion';
import {
  computeStats,
  formatClock,
  headline,
  startOfDay,
  suggestFromForecast,
  suggestWindow,
} from '../protocol/stats';
import { color, font, radius, size, space } from '../theme';

const OFFLINE_HINT = 'Turn the bank on and keep your phone within a few metres of it.';

export default function Home() {
  const bank = useBank();
  const reduceMotion = useReduceMotion();
  const [devMenu, setDevMenu] = useState(false);
  const forecast = useForecast(bank.mock, startOfDay(bank.now));

  const t = bank.telemetry;
  const now = new Date(bank.now);
  const s = t ? computeStats(t) : null;
  const liveness: Liveness = !t ? 'offline' : bank.stale ? 'stale' : 'live';
  const stampTime = formatClock(liveness === 'stale' && bank.lastPacketAt ? new Date(bank.lastPacketAt) : now);
  const busy = bank.status === 'scanning' || bank.status === 'connecting' || (bank.status === 'connected' && !t);

  const head = s ? headline(s, now) : { title: 'Not connected', subline: OFFLINE_HINT };
  const stateKey = s ? s.state : 'offline';

  // Forecast first; the bank's own light history when there's no forecast
  const fromForecast = forecast.samples ? suggestFromForecast(forecast.samples, now) : null;
  const suggestion =
    fromForecast && fromForecast.kind !== 'none' ? fromForecast : suggestWindow(bank.history, now);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.page}>
        <Header liveness={liveness} time={stampTime} onLongPressTitle={() => setDevMenu(true)} />

        {bank.status === 'error' && (
          <View style={styles.error}>
            <Text style={styles.errorText}>{bank.message ?? 'Something went wrong with Bluetooth.'}</Text>
            <Pressable onPress={bank.connect} accessibilityRole="button" hitSlop={8} style={styles.retry}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        )}

        <Headline title={head.title} subline={head.subline} stateKey={stateKey} reduceMotion={reduceMotion} />

        {t && s ? (
          <>
            <BatteryCard
              soc={s.soc}
              energyWh={s.energyWh}
              capacityWh={s.capacityWh}
              voltage={t.batteryV}
              reduceMotion={reduceMotion}
            />
            <PowerFlow t={t} s={s} />
            <RatesGrid t={t} s={s} />
            <SuggestionCard
              suggestion={suggestion}
              history={bank.history}
              forecast={forecast.samples}
              now={bank.now}
              liveLight={t.lightPct}
              onUseLocation={forecast.status === 'needsLocation' ? forecast.requestLocation : undefined}
            />
          </>
        ) : (
          <>
            {bank.status !== 'error' && (
              <Pressable
                style={[styles.button, busy && styles.buttonBusy]}
                onPress={bank.connect}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy, busy }}
              >
                <Text style={styles.buttonText}>{busy ? 'Looking for Solar Bank…' : 'Connect to Solar Bank'}</Text>
              </Pressable>
            )}
            {bank.lastReading && (
              <BatteryCard
                soc={bank.lastReading.soc}
                energyWh={bank.lastReading.energyWh}
                capacityWh={config.batteryWh}
                lastReadingAt={formatClock(new Date(bank.lastReading.t))}
                reduceMotion={reduceMotion}
              />
            )}
            <RatesGrid />
          </>
        )}
      </ScrollView>
      <DevMenu bank={bank} visible={devMenu} onClose={() => setDevMenu(false)} />
    </SafeAreaView>
  );
}

/** Long-press "Solar Bank" to open. Lets you design every state without hardware. */
function DevMenu({ bank, visible, onClose }: { bank: Bank; visible: boolean; onClose: () => void }) {
  const connected = bank.status === 'connected';
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [visible]);
  if (!visible) return null;
  // A plain overlay rather than <Modal>, so it stays inside the phone frame in the web preview
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close developer menu">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>Developer</Text>
          <View style={styles.sheetRow}>
            <Text style={styles.sheetText}>
              Mock data{bank.mockForced ? ' (no Bluetooth in this build)' : ''}
            </Text>
            <Switch value={bank.mock} onValueChange={bank.setMock} disabled={bank.mockForced} />
          </View>
          {bank.mock && (
            <View style={styles.sheetRow}>
              <Text style={styles.sheetText}>Random noise (±2 %)</Text>
              <Switch value={bank.noise} onValueChange={bank.setNoise} />
            </View>
          )}
          {bank.mock &&
            SCENARIOS.map((sc) => (
              <Pressable
                key={sc}
                style={styles.sheetRow}
                onPress={() => bank.setScenario(sc)}
                accessibilityRole="button"
                accessibilityState={{ selected: bank.scenario === sc }}
              >
                <Text style={[styles.sheetText, bank.scenario === sc && styles.selected]}>{sc}</Text>
                {bank.scenario === sc && <Text style={styles.sheetText}>{'✓'}</Text>}
              </Pressable>
            ))}
          <Pressable
            style={styles.sheetRow}
            onPress={connected ? bank.disconnect : bank.connect}
            accessibilityRole="button"
          >
            <Text style={styles.sheetText}>{connected ? 'Disconnect' : 'Connect'}</Text>
          </Pressable>
          <Pressable style={styles.sheetRow} onPress={onClose} accessibilityRole="button">
            <Text style={[styles.sheetText, styles.selected]}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.ground },
  // maxWidth keeps the phone layout when previewed in a wide browser window
  page: {
    paddingHorizontal: space.margin,
    paddingBottom: 32,
    gap: space.gap,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  error: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 12 },
  errorText: { fontFamily: font.regular, fontSize: size.body, color: color.text, flexShrink: 1 },
  retry: { minHeight: 44, justifyContent: 'center' },
  retryText: { fontFamily: font.semibold, fontSize: size.body, color: color.text },
  button: {
    height: 48,
    borderRadius: radius.control,
    backgroundColor: color.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  buttonBusy: { backgroundColor: color.muted },
  buttonText: { fontFamily: font.medium, fontSize: 16, color: color.surface },
  scrim: { flex: 1, backgroundColor: 'rgba(10,10,10,0.3)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: space.cardPad,
    paddingBottom: 32,
  },
  sheetTitle: { fontFamily: font.semibold, fontSize: size.appName, color: color.text, marginBottom: 4 },
  sheetRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  sheetText: { fontFamily: font.regular, fontSize: size.body, color: color.text },
  selected: { fontFamily: font.semibold },
});
