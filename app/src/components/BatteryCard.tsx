import { StyleSheet, View } from 'react-native';
import { BATTERY_WH } from '../config';
import { formatClock } from '../protocol/stats';
import { color, radius, size } from '../theme';
import { Card, Label, Value } from './primitives';

type Props = {
  soc: number;
  eNowWh: number;
  batteryV: number;
  lastReadingAt?: Date | null; // set when offline: the values are greyed and dated
};

export default function BatteryCard({ soc, eNowWh, batteryV, lastReadingAt }: Props) {
  const offline = lastReadingAt != null;
  const pct = Math.round(soc * 100);
  const wh = `${eNowWh.toFixed(1)} of ${BATTERY_WH.toFixed(1)} Wh`;
  return (
    <Card
      accessible
      accessibilityLabel={`Battery ${pct} percent, ${eNowWh.toFixed(1)} of ${BATTERY_WH.toFixed(1)} watt-hours`
        + (offline ? `, last reading ${formatClock(lastReadingAt)}` : '')}
    >
      <View style={styles.top}>
        <Label>Battery level</Label>
        <Label>{offline ? `Last reading ${formatClock(lastReadingAt)}` : `${batteryV.toFixed(1)} V`}</Label>
      </View>
      <View style={styles.value}>
        <Value value={String(pct)} unit="%" fontSize={size.battery} tint={offline ? color.muted : color.text} />
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: offline ? color.idle : color.text }]} />
      </View>
      <Label>{offline ? `${wh} · may have changed since` : wh}</Label>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { marginTop: 4 },
  track: { height: 8, borderRadius: radius.bar, backgroundColor: color.raised, overflow: 'hidden', marginTop: 12, marginBottom: 8 },
  fill: { height: '100%', borderRadius: radius.bar },
});
