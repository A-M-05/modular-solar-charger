// Shared building blocks: the bordered card, grey labels, and number + small grey unit.
import { ReactNode } from 'react';
import { StyleSheet, Text, View, ViewProps } from 'react-native';
import { color, font, radius, size, space } from '../theme';

export const DASH = '—';
export const MINUS = '−';

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

export function Label({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

export function Sub({ children, tint }: { children: ReactNode; tint?: string }) {
  return <Text style={[styles.sub, tint ? { color: tint } : null]}>{children}</Text>;
}

/** "9.4" big + " W" small grey. Pass value DASH for "doesn't apply". */
export function Value({ value, unit, fontSize, tint = color.text }: {
  value: string; unit?: string; fontSize: number; tint?: string;
}) {
  const dash = value === DASH;
  return (
    <Text style={[styles.value, { fontSize, color: dash ? color.muted : tint }]}>
      {value}
      {unit && !dash && <Text style={styles.unit}> {unit}</Text>}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderColor: color.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.cardPad,
  },
  label: { fontFamily: font.regular, fontSize: size.label, color: color.muted },
  sub: { fontFamily: font.regular, fontSize: size.small, color: color.muted },
  value: { fontFamily: font.medium, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: font.regular, fontSize: size.label, color: color.muted },
});
