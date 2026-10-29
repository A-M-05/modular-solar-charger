import { MOCK_EFFICIENCY, mockTelemetry } from '../ble/mockConnection';
import { addHours, computeStats, formatClock, formatDuration, socFromVoltage } from './stats';

test('socFromVoltage: table endpoints and interpolation', () => {
  expect(socFromVoltage(9)).toBe(0);
  expect(socFromVoltage(10)).toBe(0);
  expect(socFromVoltage(13.6)).toBe(1);
  expect(socFromVoltage(14)).toBe(1);
  expect(socFromVoltage(13.15)).toBeCloseTo(0.55);
});

test('formatClock', () => {
  expect(formatClock(new Date(2026, 0, 1, 0, 5))).toBe('12:05 AM');
  expect(formatClock(new Date(2026, 0, 1, 12, 0))).toBe('12:00 PM');
  expect(formatClock(new Date(2026, 0, 1, 18, 52))).toBe('6:52 PM');
});

// The mock reproduces the mockups in docs/ui/ — if these pass, the math matches the design.
test('charging mockup: 62 %, 47.6 Wh, full by 6:52 PM', () => {
  const t = mockTelemetry('charging');
  const s = computeStats(t, MOCK_EFFICIENCY);
  expect(t.batteryV.toFixed(1)).toBe('13.2');
  expect(Math.round(s.soc * 100)).toBe(62);
  expect(s.eNowWh.toFixed(1)).toBe('47.6');
  expect(s.pPanel.toFixed(1)).toBe('9.4');
  expect(s.pOut.toFixed(1)).toBe('3.1');
  expect(s.pNet.toFixed(1)).toBe('6.3');
  expect(s.state).toBe('charging');
  expect(s.pctPerHour.toFixed(1)).toBe('8.2');
  expect(formatDuration(s.hoursToFull!)).toBe('4 h 38 m');
  expect(formatClock(addHours(new Date(2026, 9, 28, 14, 14), s.hoursToFull!))).toBe('6:52 PM');
  expect(s.hoursLeft).toBeNull();
  expect(s.fastCharging).toBe(false);
});

test('draining mockup: 54 %, 41.5 Wh, lasts until 1:41 AM', () => {
  const t = mockTelemetry('draining');
  const s = computeStats(t, MOCK_EFFICIENCY);
  expect(t.batteryV.toFixed(1)).toBe('13.1');
  expect(Math.round(s.soc * 100)).toBe(54);
  expect(s.eNowWh.toFixed(1)).toBe('41.5');
  expect(s.pOut.toFixed(1)).toBe('7.4');
  expect(s.state).toBe('draining');
  expect(s.pctPerHour.toFixed(1)).toBe('-9.6');
  expect(formatDuration(s.hoursLeft!)).toBe('5 h 36 m');
  expect(formatClock(addHours(new Date(2026, 9, 28, 20, 5), s.hoursLeft!))).toBe('1:41 AM');
  expect(s.hoursToFull).toBeNull();
});

test('balanced and fast-charging scenarios', () => {
  expect(computeStats(mockTelemetry('balanced'), MOCK_EFFICIENCY).state).toBe('balanced');
  const over = computeStats(mockTelemetry('overRating'), MOCK_EFFICIENCY);
  expect(over.fastCharging).toBe(true);
});

test('real efficiency (0.9) charges slower than the mockup', () => {
  expect(computeStats(mockTelemetry('charging')).pNet).toBeCloseTo(9.4 * 0.9 - 3.1);
});
