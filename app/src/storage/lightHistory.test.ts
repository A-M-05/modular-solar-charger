import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightEntry, addSample, loadHistory, saveHistory, splitDays } from './lightHistory';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).getTime();

describe('addSample', () => {
  test('records the first reading right away', () => {
    expect(addSample([], 71.04, at(28, 14, 14))).toEqual([{ t: at(28, 14, 14), pct: 71 }]);
  });

  test('skips readings until 30 min have passed', () => {
    const h = addSample([], 70, at(28, 14));
    expect(addSample(h, 75, at(28, 14, 29))).toBe(h);
    expect(addSample(h, 75, at(28, 14, 30))).toHaveLength(2);
  });

  test('keeps yesterday and today, drops older', () => {
    const old: LightEntry[] = [
      { t: at(26, 12), pct: 80 }, // two days ago
      { t: at(27, 0, 5), pct: 0 }, // yesterday
    ];
    expect(addSample(old, 60, at(28, 9)).map((e) => e.t)).toEqual([at(27, 0, 5), at(28, 9)]);
  });
});

test('splitDays: minutes of the day, today only up to now', () => {
  const entries: LightEntry[] = [
    { t: at(27, 10, 40), pct: 50 },
    { t: at(28, 9, 30), pct: 30 },
    { t: at(28, 15), pct: 60 }, // in the future relative to now
  ];
  expect(splitDays(entries, at(28, 14, 14))).toEqual({
    yesterday: [{ min: 640, pct: 50 }],
    today: [{ min: 570, pct: 30 }],
  });
});

test('save then load round trip', async () => {
  const h: LightEntry[] = [{ t: at(28, 14), pct: 71 }];
  await saveHistory(h);
  expect(await loadHistory()).toEqual(h);
});

test('corrupt storage loads as empty instead of crashing', async () => {
  await AsyncStorage.setItem('lightHistory.v1', '{not json');
  expect(await loadHistory()).toEqual([]);
  await AsyncStorage.setItem('lightHistory.v1', JSON.stringify([{ t: 1, pct: 2 }, { bad: true }]));
  expect(await loadHistory()).toEqual([{ t: 1, pct: 2 }]);
});
