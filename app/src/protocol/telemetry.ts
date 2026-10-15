// Mirror of firmware/esp32/main/telemetry.h — keep the two in sync!
// Full byte layout: docs/protocol.md
import { Buffer } from 'buffer';

export const SERVICE_UUID = '6e7a0001-5c1a-4f3b-9b2e-0a1b2c3d4e5f';
export const TELEMETRY_CHAR_UUID = '6e7a0002-5c1a-4f3b-9b2e-0a1b2c3d4e5f'; // ESP32 -> phone (notify)
export const COMMAND_CHAR_UUID = '6e7a0003-5c1a-4f3b-9b2e-0a1b2c3d4e5f';   // phone -> ESP32 (write)

export const PROTOCOL_VERSION = 1;
export const TELEMETRY_SIZE = 20;

export enum DriveMode {
  Manual = 0,
  Auto = 1,
}

export interface Telemetry {
  version: number;
  mode: DriveMode;
  batteryV: number;     // volts
  panelA: number;       // amps into battery from solar
  loadA: number;        // amps used by the car
  light: number[];      // 4 raw light-sensor readings (0-4095)
  uptimeS: number;      // seconds since boot
}

/** Raw bytes (little-endian) -> Telemetry. Returns null if the packet looks wrong. */
export function decodeTelemetry(bytes: Uint8Array): Telemetry | null {
  if (bytes.length < TELEMETRY_SIZE) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = v.getUint8(0);
  if (version !== PROTOCOL_VERSION) return null;
  return {
    version,
    mode: v.getUint8(1) as DriveMode,
    batteryV: v.getUint16(2, true) / 1000,
    panelA: v.getInt16(4, true) / 1000,
    loadA: v.getInt16(6, true) / 1000,
    light: [8, 10, 12, 14].map((o) => v.getUint16(o, true)),
    uptimeS: v.getUint32(16, true) / 1000,
  };
}

/** ble-plx gives characteristic values as base64 strings. */
export function decodeBase64Telemetry(b64: string): Telemetry | null {
  return decodeTelemetry(new Uint8Array(Buffer.from(b64, 'base64')));
}

/** 1-byte command packet: [mode] */
export function encodeModeCommand(mode: DriveMode): string {
  return Buffer.from([mode]).toString('base64');
}
