import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatClock } from '../protocol/stats';
import { color, font, size } from '../theme';

type Props = {
  live: boolean;
  stale: boolean;
  now: Date;
  lastAt: Date | null;
  onLongPress: () => void; // opens the dev panel
};

export default function Header({ live, stale, now, lastAt, onLongPress }: Props) {
  const text = !live ? 'Offline' : stale && lastAt ? `Last update ${formatClock(lastAt)}` : `Live · ${formatClock(now)}`;
  const on = live && !stale;
  return (
    <View style={styles.header}>
      <Pressable onLongPress={onLongPress} accessibilityRole="header">
        <Text style={styles.name}>Solar Bank</Text>
      </Pressable>
      <View style={styles.status} accessible accessibilityLabel={text}>
        <View style={[styles.dot, { backgroundColor: on ? color.positive : color.idle }]} />
        <Text style={styles.statusText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontFamily: font.semibold, fontSize: size.appName, color: color.text },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: font.regular, fontSize: size.small, color: color.muted, fontVariant: ['tabular-nums'] },
});
