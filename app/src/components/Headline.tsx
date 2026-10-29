import { StyleSheet, Text, View } from 'react-native';
import { color, font, size } from '../theme';

/** The screen's answer: "Full by 6:52 PM" + one grey line of detail. */
export default function Headline({ title, sub }: { title: string; sub?: string }) {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={sub ? `${title}. ${sub}` : title}>
      <Text style={styles.title}>{title}</Text>
      {sub && <Text style={styles.sub}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: font.semibold, fontSize: size.headline, letterSpacing: -0.5, color: color.text,
    fontVariant: ['tabular-nums'],
  },
  sub: { fontFamily: font.regular, fontSize: size.body, lineHeight: 20, color: color.muted, marginTop: 4 },
});
