import { Buffer } from 'buffer';
import { crc16, decodeBase64Telemetry, decodeTelemetry, droppedBetween } from '../telemetry';

// The test packet from docs/protocol.md. The ESP32 must produce exactly these bytes for these values.
// length 14 · packet #1 · panel 18.000 V × 0.522 A · device 5.000 V × 0.620 A · 62 % · charging · CRC 0x7310
const TEST_HEX = '0e0150460a0288136c023e041073';
const bytes = (hex: string) => new Uint8Array(Buffer.from(hex, 'hex'));

/** Copy of the test packet with one byte changed and the CRC fixed up. */
function withByte(i: number, value: number): Uint8Array {
  const b = bytes(TEST_HEX);
  b[i] = value;
  const c = crc16(b, 12);
  b[12] = c & 0xff;
  b[13] = c >> 8;
  return b;
}

describe('crc16', () => {
  it('matches the standard CCITT-FALSE check value', () => {
    expect(crc16(new Uint8Array(Buffer.from('123456789', 'ascii')))).toBe(0x29b1);
  });
});

describe('decodeTelemetry', () => {
  it('decodes the test packet', () => {
    const t = decodeTelemetry(bytes(TEST_HEX))!;
    expect(t).not.toBeNull();
    expect(t.seq).toBe(1);
    expect(t.panelV).toBeCloseTo(18);
    expect(t.panelA).toBeCloseTo(0.522);
    expect(t.panelV * t.panelA).toBeCloseTo(9.4, 1);
    expect(t.deviceV).toBeCloseTo(5);
    expect(t.deviceA).toBeCloseTo(0.62);
    expect(t.deviceV * t.deviceA).toBeCloseTo(3.1, 1);
    expect(t.socPct).toBe(62);
    expect(t.charging).toBe(true);
    expect(t.fastCharging).toBe(false);
    expect(t.doneCharging).toBe(false);
    expect(t.lowBattery).toBe(false);
    expect(t.pdFailure).toBe(false);
  });

  it('decodes every flag bit', () => {
    const t = decodeTelemetry(withByte(11, 0b0001_1011))!; // fast, done, low, PD fail (no charging)
    expect(t.fastCharging).toBe(true);
    expect(t.doneCharging).toBe(true);
    expect(t.charging).toBe(false);
    expect(t.lowBattery).toBe(true);
    expect(t.pdFailure).toBe(true);
  });

  it('reads currents above 32.767 A as unsigned', () => {
    const t = decodeTelemetry(withByte(5, 0x9c))!; // panel mA 0x9c0a = 39946
    expect(t.panelA).toBeCloseTo(39.946);
  });

  it('works on a view into a bigger buffer', () => {
    const big = new Uint8Array(30);
    big.set(bytes(TEST_HEX), 5);
    expect(decodeTelemetry(big.subarray(5, 19))?.socPct).toBe(62);
  });

  it('rejects a corrupted packet (bad CRC)', () => {
    const b = bytes(TEST_HEX);
    b[10] = 99; // battery % changed but CRC not updated
    expect(decodeTelemetry(b)).toBeNull();
  });

  it('rejects the wrong length', () => {
    expect(decodeTelemetry(bytes(TEST_HEX).slice(0, 13))).toBeNull();
    expect(decodeTelemetry(new Uint8Array([...bytes(TEST_HEX), 0]))).toBeNull();
    expect(decodeTelemetry(withByte(0, 15))).toBeNull(); // length byte says 15
  });

  it('decodes base64 from ble-plx', () => {
    const b64 = Buffer.from(TEST_HEX, 'hex').toString('base64');
    expect(decodeBase64Telemetry(b64)?.socPct).toBe(62);
  });
});

describe('droppedBetween', () => {
  it('counts lost packets, including across the 255 -> 0 wrap', () => {
    expect(droppedBetween(1, 2)).toBe(0);
    expect(droppedBetween(1, 4)).toBe(2);
    expect(droppedBetween(255, 0)).toBe(0);
    expect(droppedBetween(254, 1)).toBe(2);
  });
});
