# Solar RC Car — Software

UCI EECS 159A/B senior design. Car sends live battery/solar data over Bluetooth to a phone app.

```
solar-rc-car/
├── firmware/
│   ├── esp32/           ESP32-H4 code (C, ESP-IDF): reads sensors, sends data over Bluetooth
│   │   └── main/
│   │       ├── main.c            starts everything, sends data 5x/second
│   │       ├── telemetry.h       ★ the data packet (must match the app)
│   │       ├── sensors.c/.h      sensor readings — FAKE data for now, TODOs for hardware
│   │       └── ble_telemetry.c/.h  Bluetooth server
│   └── stm32/           placeholder — only if STM32 stays the main controller
├── app/                 Phone app (React Native + Expo, TypeScript)
│   ├── App.tsx
│   └── src/
│       ├── protocol/telemetry.ts  ★ decodes the data packet (must match firmware)
│       ├── protocol/stats.ts      battery %, watts, time-to-full math
│       ├── ble/carConnection.ts   real Bluetooth connection
│       ├── ble/mockConnection.ts  fake car, for building the UI with no hardware
│       └── screens/Dashboard.tsx  the main screen
├── docs/protocol.md     ★ byte-by-byte description of the packet
└── .vscode/             shared editor settings + recommended extensions
```

★ = these three must always agree. Change one → change all three.

## Who works where
| Team | Folder |
|---|---|
| App / UI / stats | `app/` |
| Bluetooth firmware | `firmware/esp32/main/ble_telemetry.c` |
| Sensors / hardware | `firmware/esp32/main/sensors.c` (and `firmware/stm32/` if used) |

## Setup (one time)
1. Install **VS Code**, **Git**, and **Node.js LTS**.
2. Open this folder in VS Code → accept the "install recommended extensions" popup.
3. ESP32: run **ESP-IDF: Configure ESP-IDF Extension** from the command palette (Ctrl/Cmd+Shift+P) → Express install.
4. App: `cd app && npm install`.
5. Android: install **Android Studio** (for the SDK) and turn on USB debugging on your phone.

## Run the app
| Goal | Command (inside `app/`) | Needs |
|---|---|---|
| Work on UI with fake data | `npm run start:mock` → scan QR with **Expo Go** | Just a phone |
| Real Bluetooth, Android | `npm run android` (first time builds the app, ~5–10 min) then `npm start` | Android phone on USB |
| Real Bluetooth, iPhone | `npm run ios` | Mac + Xcode; free Apple ID expires every 7 days |

Expo Go **cannot** use Bluetooth — leave "Mock data" on there.

## Run the firmware
In VS Code, bottom status bar: set target **esp32h4** → select the USB port → **Build, Flash and Monitor** (flame icon).
Then check it in the **nRF Connect** phone app: you should see `SolarRC` advertising.

## Bring-up order
1. Flash ESP32 (fake data) → see `SolarRC` in nRF Connect, values changing.
2. App with mock data → build the UI.
3. App with real Bluetooth → same screen, real (fake) packets from the ESP32.
4. Hardware team replaces fake data in `sensors.c` with real readings.
