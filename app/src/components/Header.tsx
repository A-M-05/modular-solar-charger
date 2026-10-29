// "Solar Bank" + Live/Offline stamp. Long-press the title for the dev menu.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, font, size, tabular } from '../theme';

export type Liveness = 'live' | 'stale' | 'offline';

export default function Header({
  liveness,
  time,
  onLongPressTitle,
}: {
  liveness: Liveness;
  time: string;
  onLongPressTitle?: () => void;
}) {
  const stamp =
    liveness === 'live' ? `Live · ${time}` : liveness === 'stale' ? `Last update ${time}` : 'Offline';
  return (
    <View style={styles.row}>
      <Pressable onLongPress={onLongPressTitle} delayLongPress={600} accessibilityRole="header">
        <Text style={styles.title}>Solar Bank</Text>
      </Pressable>
      <View style={styles.stamp} accessible accessibilityLabel={stamp}>
        <View style={[styles.dot, { backgroundColor: liveness === 'live' ? color.positive : color.idle }]} />
        <Text style={[styles.stampText, tabular]}>{stamp}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: font.semibold, fontSize: size.appName, color: color.text },
  stamp: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  stampText: { fontFamily: font.regular, fontSize: size.small, color: color.muted },
});
