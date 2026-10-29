// Web-only preview: draws an iPhone-sized frame (390×844) around the app in a wide browser
// window, so the UI can be reviewed at phone size without DevTools. Phones never see this.
import { ReactNode, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { font } from '../theme';

const SCREEN_W = 390;
const SCREEN_H = 844;
const BEZEL = 12;
const STATUS_H = 54;

function clock(): string {
  const d = new Date();
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function PhoneFrame({ children }: { children: ReactNode }) {
  const win = useWindowDimensions();
  const [time, setTime] = useState(clock);
  useEffect(() => {
    const id = setInterval(() => setTime(clock()), 10_000);
    return () => clearInterval(id);
  }, []);

  // Only in a browser that's wider than a phone
  if (Platform.OS !== 'web' || win.width < 600) return <>{children}</>;

  const scale = Math.min(1, (win.height - 32) / (SCREEN_H + BEZEL * 2));
  return (
    <View style={styles.page}>
      <View style={[styles.bezel, { transform: [{ scale }] }]}>
        <View style={styles.screen}>
          <View style={styles.status}>
            <Text style={styles.time}>{time}</Text>
            <View style={styles.island} />
            <View style={styles.battery}>
              <View style={styles.batteryFill} />
            </View>
          </View>
          <View style={styles.app}>{children}</View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#1c1c1e', alignItems: 'center', justifyContent: 'center' },
  bezel: {
    width: SCREEN_W + BEZEL * 2,
    height: SCREEN_H + BEZEL * 2,
    padding: BEZEL,
    borderRadius: 60,
    backgroundColor: '#0a0a0a',
    borderWidth: 2,
    borderColor: '#3a3a3c',
  },
  screen: { flex: 1, borderRadius: 48, overflow: 'hidden', backgroundColor: '#f2f4f7' },
  status: {
    height: STATUS_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 34,
  },
  time: { fontFamily: font.semibold, fontSize: 16, color: '#0a0a0a', width: 60 },
  island: { width: 120, height: 34, borderRadius: 17, backgroundColor: '#000' },
  battery: {
    width: 26,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#0a0a0a',
    padding: 1,
    marginLeft: 34,
  },
  batteryFill: { flex: 1, width: '80%', borderRadius: 1.5, backgroundColor: '#0a0a0a' },
  app: { flex: 1 },
});
