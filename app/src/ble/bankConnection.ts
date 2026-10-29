// Talks to the power bank over Bluetooth Low Energy (BLE).
// Flow: ask permission -> scan for our service -> connect -> subscribe to telemetry notifications.
import { PermissionsAndroid, Platform } from 'react-native';
import type { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { SERVICE_UUID, TELEMETRY_CHAR_UUID, Telemetry, decodeBase64Telemetry } from '../protocol/telemetry';

export type Status = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

export interface BankConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

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

export function createBankConnection(
  onTelemetry: (t: Telemetry) => void,
  onStatus: (s: Status, msg?: string) => void,
): BankConnection {
  let device: Device | null = null;
  let sub: Subscription | null = null;

  return {
    async connect() {
      if (!(await requestPermissions())) return onStatus('error', 'Bluetooth permission denied');
      const ble = getManager();
      onStatus('scanning');
      ble.startDeviceScan([SERVICE_UUID], null, async (err, found) => {
        if (err) return onStatus('error', err.message);
        if (!found) return;
        ble.stopDeviceScan();
        try {
          onStatus('connecting');
          device = await found.connect();
          await device.discoverAllServicesAndCharacteristics();
          if (Platform.OS === 'android') await device.requestMTU(64).catch(() => {});
          sub = device.monitorCharacteristicForService(SERVICE_UUID, TELEMETRY_CHAR_UUID, (e, ch) => {
            if (e) return onStatus('error', e.message);
            const t = ch?.value ? decodeBase64Telemetry(ch.value) : null;
            if (t) onTelemetry(t);
          });
          device.onDisconnected(() => onStatus('idle', 'Bank disconnected'));
          onStatus('connected');
        } catch (e: any) {
          onStatus('error', e?.message ?? 'Connection failed');
        }
      });
    },
    async disconnect() {
      sub?.remove();
      getManager().stopDeviceScan();
      await device?.cancelConnection().catch(() => {});
      device = null;
      onStatus('idle');
    },
  };
}
