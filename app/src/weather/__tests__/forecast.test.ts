import { mockForecast } from '../../ble/mockConnection';
import { LightSample, formatClock, suggestFromForecast, suggestionText } from '../../protocol/stats';
import { parseOpenMeteo } from '../forecast';

const at = (h: number, m: number, dayOffset = 0) => {
  const d = new Date(2026, 9, 28, h, m, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return d;
};

/** Hourly samples for one day from a function of the hour, like a real forecast. */
function day(offset: number, f: (h: number) => number): LightSample[] {
  const out: LightSample[] = [];
  for (let h = 0; h < 24; h++) out.push({ t: at(h, 0, offset).getTime(), pct: f(h) });
  return out;
}
const sunny = (h: number) => Math.max(0, 80 - Math.abs(h - 13) * 15); // ≥50 from 11:00 to 15:00
const cloudy = (h: number) => Math.max(0, 30 - Math.abs(h - 14) * 8);  // peaks at 30 % at 2 PM

describe('parseOpenMeteo', () => {
  it('centres each hourly value on its hour and converts W/m² to % of full sun', () => {
    const t = at(14, 0).getTime() / 1000;
    const samples = parseOpenMeteo({
      hourly: { time: [t, t + 3600, t + 7200], shortwave_radiation: [672, null, 1200] },
    });
    expect(samples).toHaveLength(2);
    expect(formatClock(new Date(samples[0].t))).toBe('1:30 PM');
    expect(samples[0].pct).toBeCloseTo(67.2);
    expect(samples[1].pct).toBe(100);
  });

  it('copes with an empty response', () => {
    expect(parseOpenMeteo({})).toEqual([]);
  });
});

describe('suggestFromForecast', () => {
  const forecast = [...day(0, sunny), ...day(1, sunny)];

  it('before today’s window', () => {
    expect(suggestionText(suggestFromForecast(forecast, at(8, 0)))).toEqual({
      title: 'Today, 11:00 AM – 3:00 PM',
      subline: 'Strongest sun in today’s forecast',
    });
  });

  it('inside today’s window', () => {
    expect(suggestionText(suggestFromForecast(forecast, at(13, 30)))).toEqual({
      title: 'Now until 3:00 PM',
      subline: '1 h 30 m of strong sun left in today’s forecast',
    });
  });

  it('after today’s window uses tomorrow’s forecast', () => {
    const tomorrowLater = [...day(0, sunny), ...day(1, (h) => sunny(h - 1))];
    expect(suggestionText(suggestFromForecast(tomorrowLater, at(17, 0)))).toEqual({
      title: 'Tomorrow, 12:00 PM – 4:00 PM',
      subline: 'Strongest sun in tomorrow’s forecast',
    });
  });

  it('suggests the sunniest stretch of a cloudy day', () => {
    const s = suggestFromForecast([...day(0, sunny), ...day(1, cloudy)], at(18, 0));
    expect(s.kind === 'after' && s.weak).toBe(true);
    expect(suggestionText(s)).toEqual({
      title: 'Tomorrow, 12:55 PM \u2013 3:10 PM',
      subline: 'Cloudy tomorrow, so charging will be slow',
    });
  });

  it('says so when there’s no useful sun', () => {
    const s = suggestFromForecast([...day(0, () => 5), ...day(1, () => 5)], at(9, 0));
    expect(suggestionText(s).title).toBe('No sun in the forecast');
  });

  it('returns none when tomorrow is missing, so the app falls back to history', () => {
    expect(suggestFromForecast(day(0, sunny), at(17, 0)).kind).toBe('none');
  });

  it('mock forecast reproduces both mockups', () => {
    const f = mockForecast(at(0, 0).getTime());
    expect(suggestionText(suggestFromForecast(f, at(14, 14)))).toEqual({
      title: 'Now until 3:40 PM',
      subline: '1 h 26 m of strong sun left in today’s forecast',
    });
    expect(suggestionText(suggestFromForecast(f, at(20, 5))).title).toBe(
      'Tomorrow, 10:40 AM – 3:40 PM',
    );
  });
});
