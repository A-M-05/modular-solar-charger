// Panel → Battery → Devices, with the swappable panel's rating against the max.
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { Stats } from '../protocol/stats';
import { Telemetry } from '../protocol/telemetry';
import { color, size } from '../theme';
import { Card, DASH, Label, MINUS, Sub, Value } from './primitives';

const FLOWING_W = 0.05;

/** 2 px arrow when power flows on the link, 1 px dashed grey line when it doesn't. */
function Arrow({ flowing, tint }: { flowing: boolean; tint: string }) {
  return (
    <Svg width={36} height={12} style={styles.arrow}>
      {flowing ? (
        <>
          <Line x1={0} y1={6} x2={34} y2={6} stroke={tint} strokeWidth={2} />
          <Polyline points="28,1 34,6 28,11" fill="none" stroke={tint} strokeWidth={2} />
        </>
      ) : (
        <Line x1={0} y1={6} x2={36} y2={6} stroke={color.idle} strokeWidth={1} strokeDasharray="3 3" />
      )}
    </Svg>
  );
}

const ports = (mask: number) => {
  const n = mask.toString(2).replace(/0/g, '').length;
  return n === 0 ? 'No ports on' : n === 1 ? '1 port on' : `${n} ports on`;
};

export default function PowerFlow({ t, stats }: { t: Telemetry; stats: Stats }) {
  const solar = t.panelConnected && stats.pPanel >= FLOWING_W;
  const rating = t.panelRatingW ? `${t.panelRatingW} W · max ${t.maxRatingW}` : `max ${t.maxRatingW} W`;
  const net = Math.abs(stats.pNet).toFixed(1);
  const sign = stats.state === 'charging' ? '+' : stats.state === 'draining' ? MINUS : '';
  const word = stats.state === 'balanced' ? 'steady' : stats.state;
  return (
    <Card
      style={styles.row}
      accessible
      accessibilityLabel={`Panel ${stats.pPanel.toFixed(1)} watts in. Battery ${word} at ${net} watts. `
        + `Devices using ${stats.pOut.toFixed(1)} watts, ${ports(t.portsOn)}.`}
    >
      <View style={[styles.col, styles.panelCol]}>
        <Label>Panel</Label>
        <Value
          value={t.panelConnected ? stats.pPanel.toFixed(1) : DASH}
          unit="W"
          fontSize={size.flow}
          tint={solar ? color.accent : color.muted}
        />
        <Sub>{t.panelConnected ? rating : 'No panel'}</Sub>
      </View>
      <Arrow flowing={solar} tint={color.accent} />
      <View style={styles.col}>
        <Label>Battery</Label>
        <Value value={`${sign}${net}`} unit="W" fontSize={size.flow} />
        <Sub>{word}</Sub>
      </View>
      <Arrow flowing={stats.pOut >= FLOWING_W} tint={color.text} />
      <View style={styles.col}>
        <Label>Devices</Label>
        <Value value={stats.pOut.toFixed(1)} unit="W" fontSize={size.flow} />
        <Sub>{ports(t.portsOn)}</Sub>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  col: { flex: 1, gap: 2 },
  panelCol: { flex: 1.3 }, // fits "20 W · max 30" on one line, as in the mockup
  arrow: { marginHorizontal: 6 },
});
