import { Buffer } from 'buffer';
import { decodeTelemetry } from './telemetry';

// The "Charging" example packet from docs/protocol.md
const EXAMPLE = '020190337049f401eb00c602141e030040e20100';
const bytes = (hex: string) => new Uint8Array(Buffer.from(hex, 'hex'));

test('decodes the charging example packet', () => {
  expect(decodeTelemetry(bytes(EXAMPLE))).toEqual({
    version: 2,
    panelConnected: true,
    fastCharging: false,
    overRating: false,
    batteryV: 13.2,
    panelV: 18.8,
    panelA: 0.5,
    outA: 0.235,
    lightPct: 71,
    panelRatingW: 20,
    maxRatingW: 30,
    portsOn: 0b11,
    uptimeS: 123.456,
  });
});

test('decodes flag bits', () => {
  const b = bytes(EXAMPLE);
  b[1] = 0b110;
  expect(decodeTelemetry(b)).toMatchObject({ panelConnected: false, fastCharging: true, overRating: true });
});

test('rejects the wrong version', () => {
  const b = bytes(EXAMPLE);
  b[0] = 1;
  expect(decodeTelemetry(b)).toBeNull();
});

test('rejects a short packet', () => {
  expect(decodeTelemetry(bytes(EXAMPLE).slice(0, 19))).toBeNull();
});
