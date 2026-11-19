// Mirror of firmware/esp32/main/telemetry.h — keep the two in sync!
// Full byte layout: docs/protocol.md (protocol v3, 14 bytes, little-endian)
import { Buffer } from 'buffer';

export const SERVICE_UUID = '6e7a0001-5c1a-4f3b-9b2e-0a1b2c3d4e5f';
export const TELEMETRY_CHAR_UUID = '6e7a0002-5c1a-4f3b-9b2e-0a1b2c3d4e5f'; // bank -> phone (notify)
export const COMMAND_CHAR_UUID = '6e7a0003-5c1a-4f3b-9b2e-0a1b2c3d4e5f';   // phone -> bank (write, unused for now)

export const PACKET_LEN = 14;

// Flag bits. Bit 0 = rightmost bit (value 1).
const FLAG_FAST_CHARGING = 1 << 0; // 0x01
const FLAG_DONE_CHARGING = 1 << 1; // 0x02
const FLAG_CHARGING = 1 << 2;      // 0x04
const FLAG_LOW_BATTERY = 1 << 3;   // 0x08
const FLAG_PD_FAIL = 1 << 4;       // 0x10

export interface Telemetry {
  seq: number;            // packet ID 0-255, wraps
  panelV: number;         // volts from the panel
  panelA: number;         // amps from the panel
  deviceV: number;        // volts to the device being charged
  deviceA: number;        // amps to the device being charged
  socPct: number;         // battery 0-100 %
  fastCharging: boolean;
  doneCharging: boolean;
  charging: boolean;      // panel plugged in and charging
  lowBattery: boolean;
  pdFailure: boolean;     // USB Power Delivery negotiation failed
}

/** CRC-16/CCITT-FALSE (poly 0x1021, start 0xFFFF). Check value: "123456789" -> 0x29B1. */
export function crc16(b: Uint8Array, n = b.length): number {
  let c = 0xffff;
  for (let i = 0; i < n; i++) {
    c ^= b[i] << 8;
    for (let k = 0; k < 8; k++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
  }
  return c;
}

/** Raw bytes -> Telemetry. Returns null for the wrong length or a bad CRC (corrupted packet). */
export function decodeTelemetry(bytes: Uint8Array): Telemetry | null {
  if (bytes.length !== PACKET_LEN || bytes[0] !== PACKET_LEN) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, PACKET_LEN);
  if (crc16(bytes, 12) !== v.getUint16(12, true)) return null;
  const f = v.getUint8(11);
  return {
    seq: v.getUint8(1),
    panelV: v.getUint16(2, true) / 1000,
    panelA: v.getUint16(4, true) / 1000,
    deviceV: v.getUint16(6, true) / 1000,
    deviceA: v.getUint16(8, true) / 1000,
    socPct: Math.min(100, v.getUint8(10)),
    fastCharging: (f & FLAG_FAST_CHARGING) !== 0,
    doneCharging: (f & FLAG_DONE_CHARGING) !== 0,
    charging: (f & FLAG_CHARGING) !== 0,
    lowBattery: (f & FLAG_LOW_BATTERY) !== 0,
    pdFailure: (f & FLAG_PD_FAIL) !== 0,
  };
}

/** ble-plx gives characteristic values as base64 strings. */
export function decodeBase64Telemetry(b64: string): Telemetry | null {
  return decodeTelemetry(new Uint8Array(Buffer.from(b64, 'base64')));
}

/** Packets lost between two packet IDs: (seq − last − 1) mod 256. */
export function droppedBetween(lastSeq: number, seq: number): number {
  return (seq - lastSeq - 1 + 256) % 256;
}
