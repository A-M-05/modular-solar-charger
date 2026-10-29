import { Buffer } from 'buffer';
import { countPorts, decodeBase64Telemetry, decodeTelemetry } from '../telemetry';

// The "Charging" mockup packet from docs/protocol.md
const CHARGING_HEX = '0201903350460a02eb00c602141e030040e20100';
const bytes = (hex: string) => new Uint8Array(Buffer.from(hex, 'hex'));

describe('decodeTelemetry', () => {
  it('decodes the charging example packet', () => {
    const t = decodeTelemetry(bytes(CHARGING_HEX))!;
    expect(t).not.toBeNull();
    expect(t.batteryV).toBeCloseTo(13.2);
    expect(t.panelV).toBeCloseTo(18);
    expect(t.panelA).toBeCloseTo(0.522);
    expect(t.outA).toBeCloseTo(0.235);
    expect(t.panelV * t.panelA).toBeCloseTo(9.4, 1);
    expect(t.batteryV * t.outA).toBeCloseTo(3.1, 1);
    expect(t.lightPct).toBeCloseTo(71);
    expect(t.panelConnected).toBe(true);
    expect(t.fastCharging).toBe(false);
    expect(t.overRating).toBe(false);
    expect(t.panelRatingW).toBe(20);
    expect(t.maxRatingW).toBe(30);
    expect(countPorts(t.portsOn)).toBe(2);
    expect(t.uptimeS).toBeCloseTo(123.456);
  });

  it('decodes flags and negative currents', () => {
    const b = bytes(CHARGING_HEX);
    b[1] = 0b110;               // fast + over rating, no panel bit
    b[8] = 0x9c; b[9] = 0xff;   // iout = -100 mA
    const t = decodeTelemetry(b)!;
    expect(t.panelConnected).toBe(false);
    expect(t.fastCharging).toBe(true);
    expect(t.overRating).toBe(true);
    expect(t.outA).toBeCloseTo(-0.1);
  });

  it('works on a view into a bigger buffer', () => {
    const big = new Uint8Array(30);
    big.set(bytes(CHARGING_HEX), 5);
    expect(decodeTelemetry(big.subarray(5, 25))?.batteryV).toBeCloseTo(13.2);
  });

  it('rejects the wrong version', () => {
    const b = bytes(CHARGING_HEX);
    b[0] = 1;
    expect(decodeTelemetry(b)).toBeNull();
  });

  it('rejects a short packet', () => {
    expect(decodeTelemetry(bytes(CHARGING_HEX).slice(0, 19))).toBeNull();
  });

  it('decodes base64 from ble-plx', () => {
    const b64 = Buffer.from(CHARGING_HEX, 'hex').toString('base64');
    expect(decodeBase64Telemetry(b64)?.lightPct).toBeCloseTo(71);
  });
});
