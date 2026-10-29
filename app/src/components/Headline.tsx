// The screen's answer: "Full by 6:52 PM" / "Lasts until 1:41 AM" / "Not connected".
// Fades in (220 ms) when the state changes, not when the numbers inside it change.
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { color, font, size, tabular } from '../theme';

export default function Headline({
  title,
  subline,
  stateKey,
  reduceMotion,
}: {
  title: string;
  subline: string;
  stateKey: string;
  reduceMotion: boolean;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current || reduceMotion) {
      first.current = false;
      return;
    }
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [stateKey]);

  return (
    <Animated.View style={[styles.block, { opacity }]} accessible accessibilityRole="header">
      <Text style={[styles.title, tabular]}>{title}</Text>
      <Text style={[styles.subline, tabular]}>{subline}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 4, marginTop: -4, paddingBottom: 4 },
  title: {
    fontFamily: font.semibold,
    fontSize: size.headline,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: color.text,
  },
  subline: { fontFamily: font.regular, fontSize: size.body, lineHeight: 20, color: color.muted },
});
