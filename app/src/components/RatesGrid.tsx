// One card split 2×2 by 1 px dividers: charging rate, depletion rate, light level, fast charging.
import { StyleSheet, View } from 'react-native';
import { config } from '../config';
import { MINUS, Stats, formatNumber } from '../protocol/stats';
import { Telemetry } from '../protocol/telemetry';
import { color, size, space } from '../theme';
import { Card, Label, Small, Value } from './ui';

interface Cell {
  label: string;
  value: string | null;   // null → grey em dash
  unit?: string;
  sub?: string;
  subTint?: string;
  a11y: string;
}

function cells(t: Telemetry, s: Stats): Cell[] {
  const pctH = formatNumber(s.pctPerHour);
  const charging: Cell =
    s.state === 'charging'
      ? {
          label: 'Charging rate', value: formatNumber(s.netW), unit: 'W', sub: `+${pctH} % per hour`,
          a11y: `Charging rate ${formatNumber(s.netW)} watts, plus ${pctH} percent per hour`,
        }
      : {
          label: 'Charging rate', value: null,
          sub: s.state === 'balanced' ? 'Matches the output' : s.panelW > config.idleW ? 'Panel can’t keep up' : 'No light on the panel',
          a11y: 'Charging rate, none',
        };
  const depletion: Cell =
    s.state === 'draining'
      ? {
          label: 'Depletion rate', value: formatNumber(-s.netW), unit: 'W',
          sub: `${MINUS}${pctH} % per hour`, subTint: color.negative,
          a11y: `Depletion rate ${formatNumber(-s.netW)} watts, minus ${pctH} percent per hour`,
        }
      : {
          label: 'Depletion rate', value: null,
          sub: s.outW > config.idleW ? (s.state === 'balanced' ? 'Matches the panel' : 'Sun covers the output') : 'Nothing plugged in',
          a11y: 'Depletion rate, none',
        };
  const light = Math.round(t.lightPct);
  return [
    charging,
    depletion,
    { label: 'Light level', value: String(light), unit: '%', sub: 'of full sun', a11y: `Light level ${light} percent of full sun` },
    {
      label: 'Fast charging', value: s.fastCharging ? 'On' : 'Off',
      sub: s.fastCharging ? `${config.fastChargeW} W or more in` : `Needs ${config.fastChargeW} W in`,
      a11y: `Fast charging ${s.fastCharging ? 'on' : 'off'}`,
    },
  ];
}

const EMPTY: Cell[] = ['Charging rate', 'Depletion rate', 'Light level', 'Fast charging'].map(
  (label) => ({ label, value: null, a11y: `${label}, no reading` }),
);

/** Pass t/s for live values, or nothing for the all-dashes "Not connected" version. */
export default function RatesGrid({ t, s }: { t?: Telemetry; s?: Stats }) {
  const c = t && s ? cells(t, s) : EMPTY;
  return (
    <Card style={styles.card}>
      {[0, 2].map((i) => (
        <View key={i} style={[styles.row, i > 0 && styles.divTop]}>
          <CellView cell={c[i]} />
          <CellView cell={c[i + 1]} divider />
        </View>
      ))}
      {!t && (
        <View style={[styles.footer, styles.divTop]}>
          <Small style={styles.footerText}>Live values appear once the bank is connected.</Small>
        </View>
      )}
    </Card>
  );
}

function CellView({ cell, divider }: { cell: Cell; divider?: boolean }) {
  return (
    <View style={[styles.cell, divider && styles.divLeft]} accessible accessibilityLabel={cell.a11y}>
      <Label>{cell.label}</Label>
      <Value value={cell.value} unit={cell.unit} fontSize={size.kpi} />
      {cell.sub ? <Small style={[styles.sub, cell.subTint ? { color: cell.subTint } : null]}>{cell.sub}</Small> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  cell: { flex: 1, padding: space.cardPad, gap: 4 },
  sub: { fontSize: size.label },
  divTop: { borderTopWidth: 1, borderTopColor: color.border },
  divLeft: { borderLeftWidth: 1, borderLeftColor: color.border },
  footer: { paddingHorizontal: space.cardPad, paddingVertical: 14 },
  footerText: { fontSize: size.label },
});
