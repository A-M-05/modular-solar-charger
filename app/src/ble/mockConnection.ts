// Fake car for building the UI without hardware (works in Expo Go and on a laptop).
import { CarConnection, Status } from './carConnection';
import { DriveMode, Telemetry } from '../protocol/telemetry';

export function createMockConnection(
  onTelemetry: (t: Telemetry) => void,
  onStatus: (s: Status, msg?: string) => void,
): CarConnection {
  let timer: ReturnType<typeof setInterval> | null = null;
  let mode = DriveMode.Manual;
  let v = 7.6;
  const start = Date.now();

  return {
    async connect() {
      onStatus('connected', 'Mock data');
      timer = setInterval(() => {
        const sec = (Date.now() - start) / 1000;
        const sun = 0.5 + 0.5 * Math.sin(sec / 20);
        const panelA = 0.6 * sun;
        const loadA = mode === DriveMode.Auto ? 0.5 + Math.random() * 0.2 : 0.15;
        v = Math.min(8.4, Math.max(6.6, v + (panelA - loadA) * 0.002));
        onTelemetry({
          version: 1, mode, batteryV: v, panelA, loadA, uptimeS: sec,
          light: [0, 1, 2, 3].map((i) => Math.round(2000 + 1500 * Math.sin(sec / 5 + i))),
        });
      }, 200);
    },
    async disconnect() {
      if (timer) clearInterval(timer);
      onStatus('idle');
    },
    async setMode(m) {
      mode = m;
    },
  };
}
