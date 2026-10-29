// Suggested charge time: the window text plus today's measured light and the forecast
// (or yesterday's light when there's no forecast) behind it.
import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import {
  LightSample,
  Suggestion,
  formatClock,
  samplesForDay,
  startOfDay,
  suggestionText,
} from '../protocol/stats';
import { color, font, size } from '../theme';
import { Card, Label, Small } from './ui';

// Chart x-axis: 6 AM to 8 PM
const H0 = 6;
const H1 = 20;
const CHART_H = 140;
const PAD = { left: 30, right: 4, top: 8, bottom: 22 };

const hourOf = (t: number) => {
  const d = new Date(t);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
};

export default function SuggestionCard({
  suggestion,
  history,
  forecast,
  now,
  liveLight,
  onUseLocation,
}: {
  suggestion: Suggestion;
  history: LightSample[];
  forecast: LightSample[] | null;
  now: number;
  liveLight: number | null;   // current reading, drawn as the "now" dot
  onUseLocation?: () => void; // set → offer the forecast (needs location permission)
}) {
  const text = suggestionText(suggestion);
  const today = samplesForDay(history, startOfDay(now));
  if (liveLight !== null) today.push({ t: now, pct: liveLight });

  // Grey line: the forecast for the window's day, or yesterday's light for the fallback
  const basis = suggestion.kind === 'none' ? null : suggestion.basis;
  const day = new Date(startOfDay(now));
  let compare: LightSample[] = [];
  let compareLabel = '';
  if (basis === 'forecast' && forecast) {
    if (suggestion.kind === 'after' || suggestion.kind === 'noStrong') day.setDate(day.getDate() + 1);
    compare = samplesForDay(forecast, day.getTime());
    compareLabel = day.getTime() > startOfDay(now) ? 'Tomorrow\u2019s forecast' : 'Forecast';
  } else if (basis === 'yesterday') {
    day.setDate(day.getDate() - 1);
    compare = samplesForDay(history, day.getTime());
    compareLabel = 'Yesterday';
  }
  const band =
    suggestion.kind === 'before' || suggestion.kind === 'inside' || suggestion.kind === 'after'
      ? [hourOf(suggestion.start.getTime()), hourOf(suggestion.end.getTime())]
      : null;

  const chartLabel = summary(today, suggestion, text.title);

  return (
    <Card>
      <View accessible accessibilityLabel={`Suggested charge time: ${text.title}. ${text.subline}`}>
        <Label>Suggested charge time</Label>
        <Text style={styles.title}>{text.title}</Text>
        <Small style={styles.reason}>{text.subline}</Small>
      </View>
      {onUseLocation && (
        <Pressable onPress={onUseLocation} accessibilityRole="button" hitSlop={8} style={styles.locate}>
          <Text style={styles.locateText}>Use my location for a sun forecast</Text>
        </Pressable>
      )}
      {(today.length > 1 || compare.length > 1) && (
        <>
          <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Key swatch={<View style={[styles.keyLine, { backgroundColor: color.accent }]} />} label="Today" />
            {compare.length > 1 && (
              <Key swatch={<View style={[styles.keyLine, { backgroundColor: color.idle }]} />} label={compareLabel} />
            )}
            {band && <Key swatch={<View style={styles.keyBand} />} label="Suggested" />}
          </View>
          <LightChart today={today} compare={compare} band={band} showDot={liveLight !== null} a11y={chartLabel} />
        </>
      )}
    </Card>
  );
}

function Key({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <View style={styles.key}>
      {swatch}
      <Small style={styles.keyText}>{label}</Small>
    </View>
  );
}

function summary(today: LightSample[], s: Suggestion, title: string): string {
  const peak = today.reduce<LightSample | null>((m, x) => (!m || x.pct > m.pct ? x : m), null);
  const peakText = peak
    ? `Light today peaked near ${Math.round(peak.pct / 10) * 10} percent at ${formatClock(new Date(peak.t))}.`
    : 'No light readings today yet.';
  const windowText =
    s.kind === 'before' || s.kind === 'inside' || s.kind === 'after'
      ? ` Suggested window ${formatClock(s.start)} to ${formatClock(s.end)}.`
      : ` ${title}.`;
  return peakText + windowText;
}

function LightChart({
  today,
  compare,
  band,
  showDot,
  a11y,
}: {
  today: LightSample[];
  compare: LightSample[];
  band: number[] | null;
  showDot: boolean;
  a11y: string;
}) {
  const [w, setW] = useState(0);
  const plotW = w - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const x = (h: number) => PAD.left + ((h - H0) / (H1 - H0)) * plotW;
  const y = (pct: number) => PAD.top + (1 - Math.min(100, Math.max(0, pct)) / 100) * plotH;
  const path = (samples: LightSample[]) =>
    samples
      .map((s) => [hourOf(s.t), s.pct] as const)
      .filter(([h]) => h >= H0 && h <= H1)
      .map(([h, p], i) => `${i ? 'L' : 'M'}${x(h).toFixed(1)},${y(p).toFixed(1)}`)
      .join(' ');
  const last = today[today.length - 1];
  const lastH = last ? hourOf(last.t) : -1;

  return (
    <View
      style={styles.chart}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11y}
    >
      {w > 0 && (
        <Svg width={w} height={CHART_H}>
          {band && (
            <Rect
              x={x(Math.max(H0, band[0]))}
              y={PAD.top}
              width={Math.max(0, x(Math.min(H1, band[1])) - x(Math.max(H0, band[0])))}
              height={plotH}
              fill={color.accentTint}
            />
          )}
          {[100, 50, 0].map((v) => (
            <Line
              key={v}
              x1={PAD.left}
              x2={w - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke={color.control}
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          ))}
          {[100, 50, 0].map((v) => (
            <SvgText
              key={v}
              x={PAD.left - 6}
              y={y(v) + 4}
              fontSize={size.tick}
              fontFamily={font.regular}
              fill={color.muted}
              textAnchor="end"
            >
              {String(v)}
            </SvgText>
          ))}
          {[
            [6, '6 AM', 'start'],
            [12, '12 PM', 'middle'],
            [18, '6 PM', 'middle'],
          ].map(([h, label, anchor]) => (
            <SvgText
              key={label as string}
              x={x(h as number)}
              y={CHART_H - 6}
              fontSize={size.tick}
              fontFamily={font.regular}
              fill={color.muted}
              textAnchor={anchor as 'start' | 'middle'}
            >
              {label as string}
            </SvgText>
          ))}
          {compare.length > 1 && (
            <Path d={path(compare)} stroke={color.idle} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
          )}
          {today.length > 1 && (
            <Path d={path(today)} stroke={color.accent} strokeWidth={2} fill="none" strokeLinejoin="round" />
          )}
          {showDot && lastH >= H0 && lastH <= H1 && (
            <Circle cx={x(lastH)} cy={y(last.pct)} r={4} fill={color.accent} />
          )}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: font.medium,
    fontSize: size.suggestion,
    color: color.text,
    marginTop: 4,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  reason: { marginTop: 4 },
  locate: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  locateText: { fontFamily: font.semibold, fontSize: size.body, color: color.text },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 14, marginBottom: 6 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keyLine: { width: 14, height: 2 },
  keyBand: { width: 12, height: 12, backgroundColor: color.accentTint },
  keyText: { fontSize: size.label },
  chart: { height: CHART_H },
});
