// One card split 2×2 by 1 px dividers: charging rate · depletion rate · light level · fast charging.
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { FAST_CHARGE_W } from '../config';
import { Stats } from '../protocol/stats';
import { Telemetry } from '../protocol/telemetry';
import { color, size, space } from '../theme';
import { Card, DASH, Label, MINUS, Sub, Value } from './primitives';

function Cell({ label, value, unit, sub, subTint, right, bottom }: {
  label: string; value: string; unit?: string; sub?: string; subTint?: string; right?: boolean; bottom?: boolean;
}) {
  return (
    <View
      style={[styles.cell, right && styles.right, bottom && styles.bottom]}
      accessible
      accessibilityLabel={`${label}: ${value === DASH ? 'not available' : `${value} ${unit ?? ''}`}${sub ? `, ${sub}` : ''}`}
    >
      <Label>{label}</Label>
      <Value value={value} unit={unit} fontSize={size.kpi} />
      {sub && <Sub tint={subTint}>{sub}</Sub>}
    </View>
  );
}

function Grid({ children, footer }: { children: ReactNode; footer?: string }) {
  return (
    <Card style={styles.card}>
      <View style={styles.grid}>{children}</View>
      {footer && <View style={styles.footer}><Label>{footer}</Label></View>}
    </Card>
  );
}

/** Offline: every value is a dash, with one line explaining why. */
export function RatesGridOffline() {
  return (
    <Grid footer="Live values appear once the bank is connected.">
      <Cell label="Charging rate" value={DASH} />
      <Cell label="Depletion rate" value={DASH} right />
      <Cell label="Light level" value={DASH} bottom />
      <Cell label="Fast charging" value={DASH} right bottom />
    </Grid>
  );
}

export default function RatesGrid({ t, stats }: { t: Telemetry; stats: Stats }) {
  const pct = Math.abs(stats.pctPerHour).toFixed(1);
  const noSun = stats.pPanel < 0.05;
  return (
    <Grid>
      {stats.state === 'charging'
        ? <Cell label="Charging rate" value={stats.pNet.toFixed(1)} unit="W" sub={`+${pct} % per hour`} />
        : <Cell label="Charging rate" value={DASH}
            sub={noSun ? 'No light on the panel' : stats.state === 'balanced' ? 'Sun matches the output' : 'Output is higher than solar'} />}
      {stats.state === 'draining'
        ? <Cell label="Depletion rate" value={(-stats.pNet).toFixed(1)} unit="W" sub={`${MINUS}${pct} % per hour`}
            subTint={color.negative} right />
        : <Cell label="Depletion rate" value={DASH} sub="Sun covers the output" right />}
      <Cell label="Light level" value={String(Math.round(t.lightPct))} unit="%" sub="of full sun" bottom />
      <Cell label="Fast charging" value={stats.fastCharging ? 'On' : 'Off'}
        sub={stats.fastCharging ? `${FAST_CHARGE_W} W or more in` : `Needs ${FAST_CHARGE_W} W in`} right bottom />
    </Grid>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', padding: space.cardPad, gap: 2 },
  right: { borderLeftWidth: 1, borderColor: color.border },
  bottom: { borderTopWidth: 1, borderColor: color.border },
  footer: { borderTopWidth: 1, borderColor: color.border, padding: space.cardPad },
});
