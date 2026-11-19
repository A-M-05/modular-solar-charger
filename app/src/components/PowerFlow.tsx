// Panel → Battery → Devices, plus warnings from the bank's flags.
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { config } from '../config';
import { Stats, formatNumber } from '../protocol/stats';
import { Telemetry } from '../protocol/telemetry';
import { color, font, size } from '../theme';
import { Card, Label, Small, Value } from './ui';

export default function PowerFlow({ t, s }: { t: Telemetry; s: Stats }) {
  const sunIn = s.panelW > config.idleW;
  const out = s.outW > config.idleW;
  const panelSub = t.charging || sunIn ? `${config.panelRatedW} W panel` : 'No panel';
  const deviceSub = out ? `${formatNumber(t.deviceV)} V · ${formatNumber(t.deviceA, 2)} A` : 'Nothing plugged in';
  const batteryWord = s.state === 'balanced' ? 'steady' : s.state;
  const net = s.state === 'balanced' ? 0 : s.netW;

  const notices: string[] = [];
  if (t.pdFailure) notices.push('Fast-charge handshake with your device failed. Try another cable.');
  if (t.lowBattery) notices.push('Battery low. Put the panel in the sun.');

  const a11y =
    `Panel ${formatNumber(s.panelW)} watts in, ${panelSub}. ` +
    `Battery ${s.state} at ${formatNumber(Math.abs(net))} watts. ` +
    `Devices ${formatNumber(s.outW)} watts, ${deviceSub}. ` +
    notices.join(' ');

  return (
    <Card accessible accessibilityLabel={a11y}>
      <View style={styles.row}>
        <Column label="Panel" value={formatNumber(s.panelW)} tint={sunIn ? color.accent : color.muted} sub={panelSub} />
        <Arrow on={sunIn} stroke={color.accent} />
        <Column label="Battery" value={formatNumber(net, 1, true)} sub={batteryWord} />
        <Arrow on={out} stroke={color.text} />
        <Column label="Devices" value={formatNumber(s.outW)} sub={deviceSub} />
      </View>
      {notices.map((n) => (
        <Text key={n} style={styles.notice}>{n}</Text>
      ))}
    </Card>
  );
}

function Column({ label, value, sub, tint }: { label: string; value: string; sub: string; tint?: string }) {
  return (
    <View style={styles.col}>
      <Label>{label}</Label>
      <Value value={value} unit="W" fontSize={size.flow} tint={tint} style={styles.value} />
      <Small>{sub}</Small>
    </View>
  );
}

/** 2 px line with a chevron when power flows; 1 px dashed grey line when it doesn't. */
function Arrow({ on, stroke }: { on: boolean; stroke: string }) {
  return (
    <View style={styles.arrow}>
      <Svg width={34} height={14}>
        {on ? (
          <>
            <Line x1={1} y1={7} x2={32} y2={7} stroke={stroke} strokeWidth={2} />
            <Polyline points="26,2 32,7 26,12" fill="none" stroke={stroke} strokeWidth={2} />
          </>
        ) : (
          <Line x1={1} y1={7} x2={33} y2={7} stroke={color.control} strokeWidth={1} strokeDasharray="3 3" />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  col: { flexShrink: 1, gap: 2 },
  value: { marginVertical: 2 },
  arrow: { width: 40, alignItems: 'center', paddingTop: 26 },
  notice: { marginTop: 12, fontFamily: font.regular, fontSize: size.label, color: color.accent },
});
