// Small building blocks shared by the cards.
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewProps } from 'react-native';
import { DASH } from '../protocol/stats';
import { color, font, radius, size, space, tabular } from '../theme';

export function Card({ style, children, ...rest }: ViewProps & { children: ReactNode }) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

/** "9.4" big and black + " W" small and grey. Pass value=null for a grey em dash. */
export function Value({
  value,
  unit,
  fontSize,
  tint = color.text,
  style,
}: {
  value: string | null;
  unit?: string;
  fontSize: number;
  tint?: string;
  style?: StyleProp<TextStyle>;
}) {
  if (value === null) {
    return <Text style={[styles.value, { fontSize, color: color.muted }, style]}>{DASH}</Text>;
  }
  return (
    <Text style={[styles.value, { fontSize, color: tint }, tabular, style]}>
      {value}
      {unit ? <Text style={styles.unit}>{` ${unit}`}</Text> : null}
    </Text>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

export function Small({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.small, tabular, style]}>{children}</Text>;
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.cardPad,
  },
  value: { fontFamily: font.medium, letterSpacing: -0.3 },
  unit: { fontFamily: font.regular, fontSize: size.label, color: color.muted, letterSpacing: 0 },
  label: { fontFamily: font.regular, fontSize: size.label, color: color.muted },
  small: { fontFamily: font.regular, fontSize: size.small, color: color.muted },
});
