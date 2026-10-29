// Panel → Battery → Devices. Shows off the swappable panel: its rating against the max rating.
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { config } from '../config';
import { Stats, formatNumber } from '../protocol/stats';
import { Telemetry, countPorts } from '../protocol/telemetry';
import { color, font, size } from '../theme';
import { Card, Label, Small, Value } from './ui';

function portsText(mask: number): string {
  const n = countPorts(mask);
  return n === 0 ? 'All ports off' : n === 1 ? '1 port on' : `${n} ports on`;
}

export default function PowerFlow({ t, s }: { t: Telemetry; s: Stats }) {
  const max = t.maxRatingW || config.maxPanelW;
  const panelSub = !t.panelConnected
    ? 'No panel'
    : t.panelRatingW
      ? `${t.panelRatingW} W · max ${max}`
      : `max ${max} W`;
  const sunIn = s.panelW > config.idleW;
  const out = s.outW > config.idleW;
  const batteryWord = s.state === 'balanced' ? 'steady' : s.state;
  const net = s.state === 'balanced' ? 0 : s.netW;

  const a11y =
    `Panel ${formatNumber(s.panelW)} watts in, ${panelSub}. ` +
    `Battery ${s.state} at ${formatNumber(Math.abs(net))} watts. ` +
    `Devices ${formatNumber(s.outW)} watts, ${portsText(t.portsOn)}.`;

  return (
    <Card accessible accessibilityLabel={a11y}>
      <View style={styles.row}>
        <Column label="Panel" value={formatNumber(s.panelW)} tint={sunIn ? color.accent : color.muted} sub={panelSub} />
        <Arrow on={sunIn} stroke={color.accent} />
        <Column label="Battery" value={formatNumber(net, 1, true)} sub={batteryWord} />
        <Arrow on={out} stroke={color.text} />
        <Column label="Devices" value={formatNumber(s.outW)} sub={portsText(t.portsOn)} />
      </View>
      {t.overRating && (
        <Text style={styles.notice}>{`This panel is above the ${max} W limit`}</Text>
      )}
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
