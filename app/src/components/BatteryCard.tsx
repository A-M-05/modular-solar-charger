// Battery level: big %, an 8 px bar and the energy left. Greyed out when showing an old reading.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { formatNumber } from '../protocol/stats';
import { color, radius, size } from '../theme';
import { Card, Label, Small, Value } from './ui';

export default function BatteryCard({
  soc,
  energyWh,
  capacityWh,
  voltage,
  lastReadingAt,
  reduceMotion,
}: {
  soc: number;
  energyWh: number;
  capacityWh: number;
  voltage?: number;
  lastReadingAt?: string;   // set → greyed "Last reading 8:05 PM" version
  reduceMotion: boolean;
}) {
  const old = lastReadingAt !== undefined;
  const pct = Math.round(soc * 100);
  const wh = `${formatNumber(energyWh)} of ${formatNumber(capacityWh)} Wh`;
  const label = `Battery ${pct} percent, ${formatNumber(energyWh)} of ${formatNumber(capacityWh)} watt-hours`;

  return (
    <Card accessible accessibilityLabel={old ? `${label}, last reading ${lastReadingAt}` : label}>
      <View style={styles.top}>
        <Label>Battery level</Label>
        <Small style={styles.right}>
          {old ? `Last reading ${lastReadingAt}` : voltage !== undefined ? `${voltage.toFixed(1)} V` : ''}
        </Small>
      </View>
      <Value value={String(pct)} unit="%" fontSize={size.battery} tint={old ? color.muted : color.text} />
      <Bar soc={soc} fill={old ? color.idle : color.text} reduceMotion={reduceMotion} />
      <Small>{old ? `${wh} · may have changed since` : wh}</Small>
    </Card>
  );
}

/**
 * A full-width fill slid left by (1 − SoC) inside a clipped track, so the width change
 * can run on the native driver. Animates only for changes of ≥ 1 %.
 */
function Bar({ soc, fill, reduceMotion }: { soc: number; fill: string; reduceMotion: boolean }) {
  const [width, setWidth] = useState(0);
  const shown = useRef(soc);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!width) return;
    const target = -(1 - Math.min(1, Math.max(0, soc))) * width;
    const big = Math.abs(soc - shown.current) >= 0.01;
    shown.current = soc;
    if (big && !reduceMotion) {
      Animated.timing(x, {
        toValue: target,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      x.setValue(target);
    }
  }, [soc, width, reduceMotion]);

  return (
    <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Animated.View style={[styles.fill, { backgroundColor: fill, transform: [{ translateX: x }] }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  right: { flexShrink: 1, textAlign: 'right' },
  track: {
    height: 8,
    borderRadius: radius.bar,
    backgroundColor: color.raised,
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 10,
  },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: radius.bar },
});
