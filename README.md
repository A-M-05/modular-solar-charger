# Modular Solar Charger — Software

UCI EECS 159A/B senior design. A solar power bank with swappable panels. An ESP32 sends live battery, panel, and light data over Bluetooth to a React Native app (iOS, Android, and web) that answers: **"Is my power bank charging, and how long until it's full (or empty)?"**

```text
modular-solar-charger/
├── firmware/esp32/      ESP32-H4 code (C, ESP-IDF): reads sensors, sends data over Bluetooth
│   └── main/
│       ├── main.c              starts everything, sends data 5x/second
│       ├── telemetry.h         ★ the data packet (must match the app)
│       ├── sensors.c/.h        sensor readings — FAKE data for now, TODOs for hardware
│       └── ble_telemetry.c/.h  Bluetooth server
├── app/                 Phone app (React Native + Expo, TypeScript)
│   ├── App.tsx
│   └── src/
│       ├── config.ts              battery size, thresholds, efficiency
│       ├── protocol/telemetry.ts  ★ decodes the data packet (must match firmware)
│       ├── protocol/stats.ts      battery %, watts, time-to-full math (+ tests)
│       ├── ble/bankConnection.ts  real Bluetooth connection
│       ├── ble/mockConnection.ts  fake power bank with scenarios, for building the UI with no hardware
│       ├── hooks/useBank.ts       connection + smoothing + stale detection
│       ├── storage/lightHistory.ts  light readings saved every 30 min, for the suggested charge time
│       ├── components/            the cards on the screen
│       ├── screens/Home.tsx       the main screen
│       └── theme.ts               colours, fonts, sizes
├── docs/
│   ├── protocol.md              ★ byte-by-byte description of the packet
│   ├── SOLAR_BANK_APP_GUIDE.md  app spec: formulas, design, screen states, build order
│   └── ui/                      the screens to match
├── .claude/skills/      design skills for Claude Code (see the guide, §13)
└── .vscode/             shared editor settings + recommended extensions
```

★ = these three must always agree. Change one → change all three.

## Who works where

| Team | Folder |
| --- | --- |
| App / UI / stats | `app/` |
| Bluetooth firmware | `firmware/esp32/main/ble_telemetry.c` |
| Sensors / hardware | `firmware/esp32/main/sensors.c` |

## Setup (one time)

1. Install **VS Code**, **Git**, and **Node.js LTS**.
2. Open this folder in VS Code → accept the "install recommended extensions" popup.
3. ESP32: run **ESP-IDF: Configure ESP-IDF Extension** from the command palette (Ctrl/Cmd+Shift+P) → Express install.
4. App: `cd app && npm install`.

## Run the app

| Goal | Command (inside `app/`) | Needs |
| --- | --- | --- |
| Work on UI with fake data, in a browser | `npm run web` | Any laptop (Windows, Mac, Linux) |
| Work on UI with fake data, on a phone | `npm run start:mock` → scan the QR code with **Expo Go** | Any iPhone or Android phone |
| Real Bluetooth, Android | `npm run android` (builds a dev client, ~5–10 min the first time), then `npm start` | Android Studio (any OS), Android phone on USB |
| Real Bluetooth, iPhone | `npm run ios` (builds a dev client), then `npm start` | Mac + Xcode, iPhone on USB; free Apple ID re-signs every 7 days |
| Typecheck + tests | `npm run typecheck && npm test` | — |

Expo Go and the browser **cannot** use Bluetooth, so they run on mock data.

**Developer panel:** long-press the "Solar Bank" title. It switches between mock scenarios (charging, draining, balanced, stale, over rating), disconnects (to see the "Not connected" screen), and on phones toggles mock data off for real Bluetooth. The charging and draining scenarios reproduce `docs/ui/charging.png` and `draining.png` exactly.

## Run the firmware

In VS Code, bottom status bar: set target **esp32h4** → select the USB port → **Build, Flash and Monitor** (flame icon).
Then check it in the **nRF Connect** phone app: you should see `SolarBank` advertising.

## Bring-up order

1. Flash ESP32 (fake data) → see `SolarBank` in nRF Connect, values changing.
2. App with mock data → build the UI.
3. App with real Bluetooth → same screen, real (fake) packets from the ESP32.
4. Hardware team replaces fake data in `sensors.c` with real readings.
