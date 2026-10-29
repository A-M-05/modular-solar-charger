import { mockLightHistory } from '../../ble/mockConnection';
import { config } from '../../config';
import {
  LightSample,
  computeStats,
  formatClock,
  formatDuration,
  headline,
  longestStrongRun,
  socFromVoltage,
  suggestWindow,
  suggestionText,
} from '../stats';
import { Telemetry } from '../telemetry';

// The mockups show no charger losses (9.4 W in = 6.3 W + 3.1 W), so reproduce them with η = 1.
const lossless = { ...config, efficiency: 1 };

const at = (h: number, m: number, dayOffset = 0) => {
  const d = new Date(2026, 9, 28, h, m, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return d;
};

function telemetry(batteryV: number, panelW: number, outW: number, lightPct: number): Telemetry {
  return {
    batteryV,
    panelV: panelW > 0 ? 18 : 0,
    panelA: panelW > 0 ? panelW / 18 : 0,
    outA: outW / batteryV,
    lightPct,
    panelConnected: true,
    fastCharging: false,
    overRating: false,
    panelRatingW: 20,
    maxRatingW: 30,
    portsOn: 3,
    uptimeS: 0,
  };
}

// 62 % and 54 % on the LiFePO4 table; both display as 13.2 V / 13.1 V like the mockups.
const V62 = 13.1 + 0.22 / 3;
const V54 = 13.1 + 0.14 / 3;

describe('socFromVoltage', () => {
  it('clamps at the table ends', () => {
    expect(socFromVoltage(9)).toBe(0);
    expect(socFromVoltage(10)).toBe(0);
    expect(socFromVoltage(13.6)).toBe(1);
    expect(socFromVoltage(14.2)).toBe(1);
  });
  it('hits table points', () => {
    expect(socFromVoltage(12.8)).toBeCloseTo(0.17);
    expect(socFromVoltage(13.2)).toBeCloseTo(0.7);
  });
  it('interpolates between points', () => {
    expect(socFromVoltage(13.15)).toBeCloseTo(0.55);
    expect(socFromVoltage(V62)).toBeCloseTo(0.62);
  });
});

describe('computeStats + headline', () => {
  it('reproduces the Charging mockup', () => {
    const s = computeStats(telemetry(V62, 9.4, 3.1, 71), lossless);
    expect(s.state).toBe('charging');
    expect(s.panelW).toBeCloseTo(9.4);
    expect(s.netW).toBeCloseTo(6.3);
    expect(s.energyWh.toFixed(1)).toBe('47.6');
    expect(s.pctPerHour.toFixed(1)).toBe('8.2');
    expect(s.hoursLeft).toBeNull();
    expect(headline(s, at(14, 14))).toEqual({
      title: 'Full by 6:52 PM',
      subline: 'Charging at 6.3 W, 4 h 38 m to go at this rate',
    });
  });

  it('reproduces the Draining mockup', () => {
    const s = computeStats(telemetry(V54, 0, 7.4, 0), lossless);
    expect(s.state).toBe('draining');
    expect(s.energyWh.toFixed(1)).toBe('41.5');
    expect(s.pctPerHour.toFixed(1)).toBe('9.6');
    expect(s.hoursToFull).toBeNull();
    expect(headline(s, at(20, 5))).toEqual({
      title: 'Lasts until 1:41 AM',
      subline: 'Draining at 7.4 W, 5 h 36 m left at this rate',
    });
  });

  it('applies charger efficiency', () => {
    const s = computeStats(telemetry(V62, 10, 0, 50), { ...config, efficiency: 0.9 });
    expect(s.netW).toBeCloseTo(9);
  });

  it('treats tiny net power as balanced', () => {
    const s = computeStats(telemetry(13.2, 3.15, 3.1, 30), lossless);
    expect(s.state).toBe('balanced');
    expect(headline(s, at(12, 0)).title).toBe('Holding steady');
  });

  it('flags fast charging at the threshold', () => {
    expect(computeStats(telemetry(13.2, 15, 0, 90)).fastCharging).toBe(true);
    expect(computeStats(telemetry(13.2, 14.9, 0, 90)).fastCharging).toBe(false);
  });

  it('adds the weekday when the ETA is more than a day out', () => {
    const s = computeStats(telemetry(V54, 0, 1, 0), lossless); // ~41 h left
    expect(headline(s, at(20, 5)).title).toMatch(/^Lasts until (Sun|Mon|Tue|Wed|Thu|Fri|Sat) /);
  });
});

describe('formatting', () => {
  it('formats clock times', () => {
    expect(formatClock(at(0, 5))).toBe('12:05 AM');
    expect(formatClock(at(12, 0))).toBe('12:00 PM');
    expect(formatClock(at(18, 52))).toBe('6:52 PM');
  });
  it('formats durations', () => {
    expect(formatDuration(278)).toBe('4 h 38 m');
    expect(formatDuration(45)).toBe('45 m');
    expect(formatDuration(180)).toBe('3 h');
    expect(formatDuration(26 * 60)).toBe('1 d 2 h');
  });
});

describe('suggested charge time', () => {
  // 30-minute samples (what the app records) of a symmetric day around 1 PM
  function day(offset: number, f: (h: number) => number): LightSample[] {
    const out: LightSample[] = [];
    for (let m = 6 * 60; m <= 20 * 60; m += 30) {
      out.push({ t: at(0, m, offset).getTime(), pct: f(m / 60) });
    }
    return out;
  }
  const tent = (h: number) => Math.max(0, 100 - Math.abs(h - 13) * 20); // ≥50 from 10:30 to 3:30
  const yesterday = day(-1, tent);

  it('needs history', () => {
    const s = suggestWindow([], at(9, 0));
    expect(s.kind).toBe('none');
    expect(suggestionText(s).title).toBe('Not enough data yet');
  });

  it('interpolates crossings and finds the window', () => {
    const run = longestStrongRun(yesterday, 50, 60)!;
    expect(formatClock(new Date(run.start))).toBe('10:30 AM');
    expect(formatClock(new Date(run.end))).toBe('3:30 PM');
  });

  it('before the window', () => {
    const s = suggestWindow(yesterday, at(8, 0));
    expect(s.kind).toBe('before');
    expect(suggestionText(s)).toEqual({
      title: 'Today, 10:30 AM – 3:30 PM',
      subline: 'When light stayed above 50 % yesterday',
    });
  });

  it('inside the window', () => {
    const s = suggestWindow(yesterday, at(14, 4));
    expect(suggestionText(s)).toEqual({
      title: 'Now until 3:30 PM',
      subline: '1 h 26 m of strong light left, based on yesterday',
    });
  });

  it('after the window', () => {
    const s = suggestWindow(yesterday, at(16, 0));
    expect(s.kind).toBe('after');
    expect(suggestionText(s).title).toBe('Tomorrow, 10:30 AM – 3:30 PM');
  });

  it('uses today once the day is over', () => {
    const today = day(0, (h) => tent(h - 1)); // shifted an hour later
    const s = suggestWindow([...yesterday, ...today], at(20, 5));
    expect(suggestionText(s)).toEqual({
      title: 'Tomorrow, 11:30 AM – 4:30 PM',
      subline: 'When light stayed above 50 % today',
    });
  });

  it('ignores short dips but not long ones', () => {
    const dip = (from: number, to: number) => (h: number) => (h >= from && h <= to ? 20 : tent(h));
    const short = longestStrongRun(day(-1, dip(12, 12)), 50, 60)!;
    expect(formatClock(new Date(short.start))).toBe('10:30 AM');
    const long = longestStrongRun(day(-1, dip(11.5, 12.5)), 50, 60)!;
    expect(formatClock(new Date(long.start))).toBe('12:41 PM');
  });

  it('reports a day with no strong light', () => {
    const s = suggestWindow(day(-1, () => 30), at(9, 0));
    expect(s.kind).toBe('noStrong');
  });

  it('mock history reproduces both mockups', () => {
    const charging = suggestWindow(mockLightHistory(at(14, 14).getTime()), at(14, 14));
    expect(suggestionText(charging)).toEqual({
      title: 'Now until 3:40 PM',
      subline: '1 h 26 m of strong light left, based on yesterday',
    });
    const draining = suggestWindow(mockLightHistory(at(20, 5).getTime()), at(20, 5));
    expect(suggestionText(draining)).toEqual({
      title: 'Tomorrow, 10:40 AM – 3:40 PM',
      subline: 'When light stayed above 50 % today',
    });
  });
});
