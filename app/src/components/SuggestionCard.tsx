// "Suggested charge time": the strong-light window from the last full day, plus a light chart.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { STRONG_LIGHT_PCT } from '../config';
import { MAX_GAP_MIN, Sample, Suggestion, formatDuration, formatMinuteOfDay } from '../protocol/stats';
import { color, font, size } from '../theme';
import { Card, Label } from './primitives';

const DAY = [330, 1230];           // x-axis: 5:30 AM to 8:30 PM, in minutes of the day
const TICKS = [[360, '6 AM'], [720, '12 PM'], [1080, '6 PM']] as const;
const CHART_H = 140;
const PLOT_H = 114;                // the rest is x labels
const GUTTER = 30;                 // y labels

/** Splits a line where the history has a hole, so the chart doesn't draw light we never measured. */
function segments(s: Sample[]): Sample[][] {
  const out: Sample[][] = [];
  s.forEach((p, i) => {
    if (i === 0 || p.min - s[i - 1].min > MAX_GAP_MIN) out.push([]);
    out[out.length - 1].push(p);
  });
  return out.filter((seg) => seg.length > 1);
}

function texts(s: Suggestion, nowMin: number): [string, string] {
  if (s.kind === 'none') return ['Not enough data yet.', 'Check back tomorrow.'];
  const window = `${formatMinuteOfDay(s.start)} – ${formatMinuteOfDay(s.end)}`;
  const basis = s.source === 'yesterday' ? 'based on yesterday' : 'based on today';
  if (s.kind === 'inside') {
    return [`Now until ${formatMinuteOfDay(s.end)}`, `${formatDuration((s.end - nowMin) / 60)} of strong light left, ${basis}`];
  }
  const why = `When light stayed above ${STRONG_LIGHT_PCT} % ${s.source}`;
  return [s.kind === 'before' ? `Today, ${window}` : `Tomorrow, ${window}`, why];
}

type Props = {
  suggestion: Suggestion;
  today: Sample[];       // up to now, with the live reading as the last point
  yesterday: Sample[];
  nowMin: number;
};

export default function SuggestionCard({ suggestion, today, yesterday, nowMin }: Props) {
  const [width, setWidth] = useState(0);
  const [title, reason] = texts(suggestion, nowMin);
  const showYesterday = suggestion.kind !== 'none' && suggestion.source === 'yesterday';
  const peak = today.reduce((p, x) => (x.pct > p.pct ? x : p), { min: 0, pct: -1 });

  const plotW = width - GUTTER;
  const x = (min: number) => GUTTER + ((min - DAY[0]) / (DAY[1] - DAY[0])) * plotW;
  const y = (pct: number) => 1 + (1 - pct / 100) * (PLOT_H - 2);
  const points = (s: Sample[]) => s.map((p) => `${x(p.min)},${y(p.pct)}`).join(' ');
  const last = today[today.length - 1];

  return (
    <Card
      accessible
      accessibilityLabel={`Suggested charge time: ${title}. ${reason}.`
        + (peak.pct >= 0 ? ` Light today peaked near ${Math.round(peak.pct)} percent at ${formatMinuteOfDay(peak.min)}.` : '')}
    >
      <Label>Suggested charge time</Label>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.reason}>{reason}</Text>

      {suggestion.kind !== 'none' && (
        <>
          <View style={styles.legend}>
            <View style={styles.legendItem}><View style={[styles.swatchLine, { backgroundColor: color.accent }]} /><Label>Today</Label></View>
            {showYesterday && (
              <View style={styles.legendItem}><View style={[styles.swatchLine, { backgroundColor: color.idle }]} /><Label>Yesterday</Label></View>
            )}
            <View style={styles.legendItem}><View style={styles.swatchBand} /><Label>Suggested</Label></View>
          </View>

          <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            {width > 0 && (
              <>
                <Svg width={width} height={PLOT_H}>
                  <Rect x={x(suggestion.start)} y={0} width={x(suggestion.end) - x(suggestion.start)} height={PLOT_H}
                    fill={color.accentTint} />
                  {[100, 50, 0].map((v) => (
                    <Line key={v} x1={GUTTER} x2={width} y1={y(v)} y2={y(v)} stroke={color.control} strokeWidth={1}
                      strokeDasharray="2 4" />
                  ))}
                  {showYesterday && segments(yesterday).map((seg, i) => (
                    <Polyline key={`y${i}`} points={points(seg)} fill="none" stroke={color.idle} strokeWidth={2} />
                  ))}
                  {segments(today).map((seg, i) => (
                    <Polyline key={`t${i}`} points={points(seg)} fill="none" stroke={color.accent} strokeWidth={2} />
                  ))}
                  {last && last.pct > 0 && <Circle cx={x(last.min)} cy={y(last.pct)} r={4} fill={color.accent} />}
                </Svg>
                {[100, 50, 0].map((v) => (
                  <Text key={v} style={[styles.tick, styles.yTick, { top: y(v) - 7 }]}>{v}</Text>
                ))}
                {TICKS.map(([min, label]) => (
                  <Text key={label} style={[styles.tick, styles.xTick, { left: x(min) - 25 }]}>{label}</Text>
                ))}
              </>
            )}
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.medium, fontSize: size.suggestion, color: color.text, marginTop: 4, fontVariant: ['tabular-nums'] },
  reason: { fontFamily: font.regular, fontSize: size.small, color: color.muted, marginTop: 2 },
  legend: { flexDirection: 'row', gap: 16, marginTop: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatchLine: { width: 12, height: 2 },
  swatchBand: { width: 12, height: 12, backgroundColor: color.accentTint },
  chart: { height: CHART_H, marginTop: 12 },
  tick: { position: 'absolute', fontFamily: font.regular, fontSize: size.tick, color: color.muted },
  yTick: { left: 0, width: GUTTER - 6, textAlign: 'right' },
  xTick: { top: PLOT_H + 6, width: 50, textAlign: 'center' },
});
