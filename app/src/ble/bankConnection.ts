// Talks to the power bank over Bluetooth Low Energy (BLE).
// Flow: ask permission -> wait for Bluetooth on -> scan for our service -> connect -> subscribe.
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import type { BleError, BleManager, Device, Subscription } from 'react-native-ble-plx';
import { config } from '../config';
import { SERVICE_UUID, TELEMETRY_CHAR_UUID, Telemetry, decodeBase64Telemetry } from '../protocol/telemetry';

export type Status = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

export interface BankConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** The clock the screen should use (the mock runs its own). */
  now(): number;
}

/** False in Expo Go and on web, where the BLE native module isn't compiled in. */
export const bleAvailable = Platform.OS !== 'web' && !!NativeModules.BlePlx;

let manager: BleManager | null = null;
function getManager(): BleManager {
  // Lazy-loaded so the app still opens in Expo Go (which has no BLE) for mock mode.
  if (!manager) {
    const { BleManager } = require('react-native-ble-plx');
    manager = new BleManager();
  }
  return manager!;
}

async function requestPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // iOS asks automatically using app.json text
  if (Platform.Version >= 31) {
    const r = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(r).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
  }
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

/** iOS reports 'Unknown' for a moment after startup, so wait for a definite answer. */
function waitPoweredOn(ble: BleManager): Promise<string> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => { sub.remove(); resolve('Timeout'); }, 3000);
    const sub = ble.onStateChange((state) => {
      if (state === 'Unknown' || state === 'Resetting') return;
      clearTimeout(timeout);
      sub.remove();
      resolve(state);
    }, true);
  });
}

function friendly(e: BleError | Error | undefined, fallback: string): string {
  const code = (e as BleError | undefined)?.errorCode;
  if (code === 102) return 'Bluetooth is off. Turn it on and try again.';
  if (code === 101) return 'Bluetooth permission is off for this app.';
  return e?.message || fallback;
}

export function createBankConnection(
  onTelemetry: (t: Telemetry) => void,
  onStatus: (s: Status, msg?: string) => void,
): BankConnection {
  let device: Device | null = null;
  let subs: Subscription[] = [];
  let scanTimer: ReturnType<typeof setTimeout> | null = null;
  let closing = false;

  const cleanup = () => {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = null;
    subs.forEach((s) => s.remove());
    subs = [];
  };

  return {
    now: () => Date.now(),
    async connect() {
      closing = false;
      if (!(await requestPermissions())) return onStatus('error', 'Bluetooth permission is off for this app.');
      const ble = getManager();
      onStatus('scanning');
      const state = await waitPoweredOn(ble);
      if (state === 'PoweredOff') return onStatus('error', 'Bluetooth is off. Turn it on and try again.');
      if (state === 'Unauthorized') return onStatus('error', 'Bluetooth permission is off for this app.');
      if (state === 'Unsupported') return onStatus('error', 'This phone doesn’t support Bluetooth LE.');

      scanTimer = setTimeout(() => {
        ble.stopDeviceScan();
        onStatus('error', 'Couldn’t find Solar Bank nearby.');
      }, config.scanTimeoutMs);

      ble.startDeviceScan([SERVICE_UUID], null, async (err, found) => {
        if (err) {
          cleanup();
          return onStatus('error', friendly(err, 'Bluetooth scan failed.'));
        }
        if (!found) return;
        ble.stopDeviceScan();
        if (scanTimer) clearTimeout(scanTimer);
        try {
          onStatus('connecting');
          device = await found.connect();
          await device.discoverAllServicesAndCharacteristics();
          if (Platform.OS === 'android') await device.requestMTU(64).catch(() => {});
          subs.push(
            device.monitorCharacteristicForService(SERVICE_UUID, TELEMETRY_CHAR_UUID, (e, ch) => {
              if (e) return; // also fires on disconnect; onDisconnected reports that
              const t = ch?.value ? decodeBase64Telemetry(ch.value) : null;
              if (t) onTelemetry(t);
            }),
            device.onDisconnected(() => {
              cleanup();
              device = null;
              if (!closing) onStatus('idle', 'Solar Bank disconnected.');
            }),
          );
          onStatus('connected');
        } catch (e: any) {
          cleanup();
          onStatus('error', friendly(e, 'Couldn’t connect to Solar Bank.'));
        }
      });
    },
    async disconnect() {
      closing = true;
      cleanup();
      if (manager) manager.stopDeviceScan();
      await device?.cancelConnection().catch(() => {});
      device = null;
      onStatus('idle');
    },
  };
}
