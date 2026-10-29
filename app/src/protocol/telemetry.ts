// Mirror of firmware/esp32/main/telemetry.h — keep the two in sync!
// Full byte layout: docs/protocol.md
import { Buffer } from 'buffer';

export const SERVICE_UUID = '6e7a0001-5c1a-4f3b-9b2e-0a1b2c3d4e5f';
export const TELEMETRY_CHAR_UUID = '6e7a0002-5c1a-4f3b-9b2e-0a1b2c3d4e5f'; // ESP32 -> phone (notify)

export const PROTOCOL_VERSION = 2;
export const TELEMETRY_SIZE = 20;

const FLAG_PANEL = 1 << 0;
const FLAG_FAST = 1 << 1;
const FLAG_OVER_RATING = 1 << 2;

export interface Telemetry {
  version: number;
  panelConnected: boolean;
  fastCharging: boolean;   // as reported by the firmware
  overRating: boolean;     // attached panel is above maxRatingW
  batteryV: number;        // volts
  panelV: number;          // volts
  panelA: number;          // amps into the charger from the panel
  outA: number;            // amps to the output ports (at battery voltage)
  lightPct: number;        // 0-100 % of full sun
  panelRatingW: number;    // 0 = unknown
  maxRatingW: number;
  portsOn: number;         // bitmask of output ports that are on
  uptimeS: number;         // seconds since boot
}

/** Raw bytes (little-endian) -> Telemetry. Returns null if the packet looks wrong. */
export function decodeTelemetry(bytes: Uint8Array): Telemetry | null {
  if (bytes.length < TELEMETRY_SIZE) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = v.getUint8(0);
  if (version !== PROTOCOL_VERSION) return null;
  const flags = v.getUint8(1);
  return {
    version,
    panelConnected: (flags & FLAG_PANEL) !== 0,
    fastCharging: (flags & FLAG_FAST) !== 0,
    overRating: (flags & FLAG_OVER_RATING) !== 0,
    batteryV: v.getUint16(2, true) / 1000,
    panelV: v.getUint16(4, true) / 1000,
    panelA: v.getInt16(6, true) / 1000,
    outA: v.getInt16(8, true) / 1000,
    lightPct: v.getUint16(10, true) / 10,
    panelRatingW: v.getUint8(12),
    maxRatingW: v.getUint8(13),
    portsOn: v.getUint8(14),
    uptimeS: v.getUint32(16, true) / 1000,
  };
}

/** ble-plx gives characteristic values as base64 strings. */
export function decodeBase64Telemetry(b64: string): Telemetry | null {
  return decodeTelemetry(new Uint8Array(Buffer.from(b64, 'base64')));
}
