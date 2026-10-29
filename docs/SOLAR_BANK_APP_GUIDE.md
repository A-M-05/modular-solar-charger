# Solar Bank App — Build Guide

How to turn the current `app/` (built for an RC car) into the React Native app (iOS, Android, web) for the modular solar power bank, matching the UI mockups (Charging, Draining, Not connected).

The microcontroller data isn't ready yet, so everything here runs on **mock data first** and switches to real BLE later with no UI changes.

---

## 0. What the app does

One screen that answers: **"Is my power bank charging, and how long until it's full (or empty)?"**

It shows the six items from the whiteboard sketch:

| Sketch item | Shown as |
| --- | --- |
| Light level | % of full sun |
| Battery level | % + voltage + Wh |
| Charging rate (+ estimated time) | W in, % per hour, "Full by 6:52 PM" |
| Depletion rate | W out, % per hour, "Lasts until 1:41 AM" |
| Fast charging? | On / Off + threshold |
| Suggested charge time | Time window from past light readings |

There's also a power-flow strip (Panel → Battery → Devices), which shows off the swappable-panel idea: it displays the attached panel's rating against the max rating.

### The UI to build

| Charging (afternoon) | Draining (evening) | Not connected |
| --- | --- | --- |
| ![Charging screen](ui/charging.png) | ![Draining screen](ui/draining.png) | ![Not connected screen](ui/not-connected.png) |

The three PNGs live in `docs/ui/`, next to this file. The editable mockups live in the **Solar Bank App UI** canvas on claude.ai: https://claude.ai/artifact/5ZRZVr88C5TgWRm1PD25EU. The canvas is private until its owner shares it. All exact sizes and colours are in §6–7.

---

## 1. Assumptions to confirm with the team

Change these in **one place** (`src/config.ts`, see §4) once decided.

| Assumption | Value used | Who decides |
| --- | --- | --- |
| Battery | 4S LiFePO4, 12.8 V nominal, 76.8 Wh (6 Ah) | Hardware |
| Max panel rating | 30 W | Hardware |
| Fast-charging threshold | panel input ≥ 15 W | Hardware |
| Light level | 0–100 % of full sun (MCU sends it) | Hardware |
| "Strong light" for suggestions | ≥ 50 % | App team |
| Charger efficiency | 0.90 (until battery current is measured directly) | Hardware |
| Platform | React Native (Expo): iOS, Android, and web. Web is mock-only (no Bluetooth), so teammates without a phone can work on the UI | Team |

---

## 2. Repo cleanup (do this first, small PR)

The repo still says "Solar RC Car". Remove the car parts:

1. `app/app.json`: change the name to `Solar Bank`, set `slug` to `solar-bank` and the bundle id to `edu.uci.solarbank`, and update the Bluetooth permission text to describe the power bank.
2. `firmware/esp32/sdkconfig.defaults`: change the device name to `SolarBank`.
3. Delete everything about **drive mode** (Manual/Auto) and the **4 light sensors**:
   - `DriveMode`, `encodeModeCommand`, and `setMode` in the app
   - `drive_mode_t` and `sensors_set_mode` in the firmware
4. Update `README.md` with the new project description and folder table.

---

## 3. New Bluetooth protocol (v2)

Do this together with the firmware team. The **three files must match**: `docs/protocol.md`, `firmware/esp32/main/telemetry.h`, and `app/src/protocol/telemetry.ts`.

Keep the same service UUID and telemetry characteristic. The packet stays **20 bytes** (fits one default BLE packet), little-endian, notified at 5 Hz:

| Offset | Type | Field | Unit / meaning |
| --- | --- | --- | --- |
| 0 | uint8 | version | = 2 |
| 1 | uint8 | flags | bit0 panel connected · bit1 fast charging · bit2 panel over max rating |
| 2 | uint16 | vbat_mV | battery voltage, mV |
| 4 | uint16 | vpanel_mV | panel voltage, mV |
| 6 | int16 | ipanel_mA | panel current into the charger, mA |
| 8 | int16 | iout_mA | current to the output ports, mA (at battery voltage) |
| 10 | uint16 | light_permille | 0–1000 = 0.0–100.0 % of full sun |
| 12 | uint8 | panel_rating_W | rating of the attached panel (0 = unknown) |
| 13 | uint8 | max_rating_W | max rating the controller accepts |
| 14 | uint8 | ports_on | bitmask of output ports that are on |
| 15 | uint8 | reserved | 0 (later: temperature) |
| 16 | uint32 | uptime_ms | ms since boot |

C side (`telemetry.h`):

```c
#define TELEMETRY_VERSION 2
enum { FLAG_PANEL = 1 << 0, FLAG_FAST = 1 << 1, FLAG_OVER_RATING = 1 << 2 };

typedef struct __attribute__((packed)) {
    uint8_t  version, flags;
    uint16_t vbat_mV, vpanel_mV;
    int16_t  ipanel_mA, iout_mA;
    uint16_t light_permille;
    uint8_t  panel_rating_W, max_rating_W, ports_on, reserved;
    uint32_t uptime_ms;
} telemetry_t;
_Static_assert(sizeof(telemetry_t) == 20, "update the app decoder!");
```

App side (`telemetry.ts`): rewrite the `Telemetry` interface and `decodeTelemetry()` to match. Use the same `DataView` approach that's already there, and convert to volts, amps, %, and booleans in the decoder so the rest of the app never touches raw bytes. Reject packets where `version !== 2` or length < 20.

The command characteristic (`…0003`) can stay unused for now. Later it could toggle output ports.

**Exercise:** write the example hex packet for the "Charging" mockup values (13.2 V battery, 9.4 W panel, 3.1 W out, light 71 %) into `docs/protocol.md` and make a unit test decode it.

---

## 4. App file structure

```
app/
├── App.tsx                       loads fonts, renders Home
└── src/
    ├── config.ts                 battery Wh, thresholds, efficiency (§1)
    ├── theme.ts                  colours, type, spacing (§6)
    ├── protocol/
    │   ├── telemetry.ts          v2 decoder (§3)
    │   └── stats.ts              all derived numbers (§5)
    ├── ble/
    │   ├── carConnection.ts  →   rename: bankConnection.ts
    │   └── mockConnection.ts     fake bank with day/evening scenarios (§8)
    ├── storage/
    │   └── lightHistory.ts       saves light samples for suggestions (§5.5)
    ├── hooks/
    │   └── useBank.ts            connection + smoothing + stale detection
    ├── components/
    │   ├── Header.tsx            "Solar Bank" + Live/Offline stamp
    │   ├── Headline.tsx          "Full by…" / "Lasts until…" + subline
    │   ├── BatteryCard.tsx
    │   ├── PowerFlow.tsx
    │   ├── RatesGrid.tsx         2×2: charging, depletion, light, fast
    │   └── SuggestionCard.tsx    window text + light chart
    └── screens/
        └── Home.tsx              picks the state and lays out the cards
```

New dependencies (inside `app/`):

```bash
npx expo install react-native-svg @react-native-async-storage/async-storage expo-font
```

Font: download **Geist** (Regular 400, Medium 500, SemiBold 600) from Google Fonts into `app/assets/fonts/` and load it with `useFonts` from `expo-font` in `App.tsx`.

---

## 5. The math (`stats.ts`)

Keep every formula in this file as a **pure function** (input → output, no React). That makes them easy to unit test.

### 5.1 Power

```
P_panel  = V_panel · I_panel                 (W)
P_out    = V_bat   · I_out                   (W)
P_net    = P_panel · η − P_out               (W, η = 0.90 from config)
```

`P_net > 0` → charging. `P_net < 0` → draining. Treat |P_net| < 0.1 W as **balanced** to avoid flicker.

> The mockups show 9.4 W in = 6.3 W to battery + 3.1 W out (no losses) to keep the numbers simple. The real app should use η until the hardware measures battery current directly.

### 5.2 Battery level

The first version maps resting voltage to state of charge (SoC) for 4S LiFePO4, using linear interpolation between points (same as the existing `socFromVoltage`):

| V | 10.0 | 12.0 | 12.8 | 12.9 | 13.0 | 13.1 | 13.2 | 13.3 | 13.4 | 13.6 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SoC | 0 | 0.09 | 0.17 | 0.20 | 0.30 | 0.40 | 0.70 | 0.90 | 0.99 | 1.00 |

⚠ LiFePO4 voltage is very flat between 20–90 %, so this will jump around. Better later: **coulomb counting** (integrate battery current over time). Ask hardware to send battery current, or derive it from `P_net / V_bat`.

`E_now = SoC · 76.8 Wh`, shown as "47.6 of 76.8 Wh".

### 5.3 Rates and times

```
charging rate  = P_net W,   %/h = P_net / Wh_capacity · 100        (when charging)
depletion rate = −P_net W,  %/h = −P_net / Wh_capacity · 100       (when draining)
time to full   = (Wh_capacity − E_now) / P_net      hours
time left      = E_now / (−P_net)                   hours
"Full by" / "Lasts until" = now + that time, formatted "6:52 PM"
```

Show the rate that doesn't apply as an em dash `—` in grey, never `0` or `--`.

Smooth V and I with the existing `ema()` (α = 0.2) **before** computing times, or the clock time will jump every 200 ms.

### 5.4 Fast charging

`fastCharging = P_panel ≥ 15 W` (or read the `FLAG_FAST` bit once firmware sends it). Subline: "Needs 15 W in".

### 5.5 Suggested charge time

1. Every 30 min while connected, save `{ time, light% }` to AsyncStorage (`lightHistory.ts`). Keep the last 2 days.
2. Take the most recent **full day** of samples. Find the longest continuous run where light ≥ 50 %. That run is the window (e.g. 10:40 AM – 3:40 PM).
3. Show the window based on the current time:
   - before the window → "Today, 10:40 AM – 3:40 PM"
   - inside it → "Now until 3:40 PM" + "1 h 26 m of strong light left"
   - after it → "Tomorrow, 10:40 AM – 3:40 PM"
   - no history yet → "Not enough data yet. Check back tomorrow."
4. The chart draws today's light line in the accent colour, yesterday in grey, and the window as a pale amber band.

---

## 6. Design system (`theme.ts`)

The style is light and quiet, with no colour in the chrome. The **one accent colour (amber) appears only on solar data**: the panel figure, the light line, and the flow arrow. Everything else is black, grey, and white.

```ts
export const color = {
  ground:  '#f2f4f7',   // screen background (blue-grey, like a meter)
  surface: '#ffffff',   // cards
  raised:  '#eeeeee',   // battery bar track
  border:  '#e6e6e6',   // card edges and dividers
  control: '#d4d4d4',
  text:    '#0a0a0a',
  muted:   '#6b6b6b',   // labels; passes 4.5:1 on white and on ground
  idle:    '#a3a3a3',   // offline dot, yesterday's line
  accent:  '#b45309',   // solar amber, ONLY on solar data
  accentTint: '#fbefe4',// suggested-window band
  positive:'#2e7d32',   // "Live" dot
  negative:'#c4242a',   // depletion %/h only
};
export const radius = { card: 8, control: 6, bar: 4 };
export const space  = { margin: 16, gap: 12, cardPad: 16 };
export const font   = { regular: 'Geist_400Regular', medium: 'Geist_500Medium', semibold: 'Geist_600SemiBold' };
export const size   = { headline: 28, battery: 30, flow: 20, kpi: 22, suggestion: 20, appName: 17, body: 14, label: 13, small: 12, tick: 11 };
```

Rules that keep it looking designed:

- **No shadows, gradients, emoji, or icons in coloured circles.** Cards are separated by a 1px `#e6e6e6` border only.
- **The headline is the biggest text** ("Full by 6:52 PM"). Nothing competes with it except the battery %.
- **Tabular numbers everywhere they update**: `fontVariant: ['tabular-nums']` so digits don't jiggle at 5 Hz.
- **Units are smaller and grey**: `9.4` in 20 px black + ` W` in 13 px grey.
- **Sentence case**, no all-caps labels.
- **Red appears in one place only:** the depletion "−9.6 % per hour".
- Touch targets ≥ 44 pt. Text contrast ≥ 4.5:1.

---

## 7. Screen layout (`Home.tsx`)

`ScrollView` with 16 px side margins and 12 px gap between cards, inside a `SafeAreaView`. Top to bottom:

| Block | Contents | Notes |
| --- | --- | --- |
| Header (48 pt) | "Solar Bank" 17/600 left · right: green 6 px dot + "Live · 2:14 PM" 12 grey | Offline: grey dot + "Offline" |
| Headline | 28/600, letter-spacing −0.5: **"Full by 6:52 PM"** / **"Lasts until 1:41 AM"** / **"Holding steady"** · subline 14 grey: "Charging at 6.3 W, 4 h 38 m to go at this rate" | The screen's answer |
| Battery card | label "Battery level" + voltage at right · **62 %** 30/500 · 8 px bar (black fill on #eee, width = SoC) · "47.6 of 76.8 Wh" | |
| Power flow card | 3 columns: **Panel** (W in amber, "20 W · max 30") → **Battery** (+6.3 W / −7.4 W, "charging"/"draining") → **Devices** (W, "2 ports on") | Arrows are 2 px lines drawn with react-native-svg. Panel→Battery arrow is amber; Battery→Devices is black. When no power flows on a link, draw a 1 px dashed grey line instead |
| Rates grid | One card split into 2×2 by 1 px dividers: Charging rate · Depletion rate · Light level · Fast charging. Each cell: 13 grey label, 22/500 value, 12 grey subline | Not separate cards |
| Suggestion card | "Suggested charge time" label · window 20/500 · reason 12 grey · legend (Today / Yesterday / Suggested) · light chart 140 pt tall | Chart: 3 dashed gridlines at 0/50/100, x labels 6 AM / 12 PM / 6 PM, no y-axis line, dot at "now" |

Open the canvas mockups side by side while building. Every size above comes from them.

### Screen states

| State | When | What changes |
| --- | --- | --- |
| Charging | P_net > 0.1 W | "Full by…", depletion = — |
| Draining | P_net < −0.1 W | "Lasts until…", charging = —, Panel→Battery link dashed |
| Balanced | |P_net| ≤ 0.1 W | "Holding steady", both rates — |
| Not connected | no device | Title "Not connected", black **Connect to Solar Bank** button (48 pt), last battery reading greyed with "Last reading 8:05 PM", rates show — |
| Scanning / connecting | after tapping Connect | Button text "Looking for Solar Bank…", disabled |
| Stale | connected but no packet for > 3 s | Header shows "Last update 2:14 PM" in grey; keep the old values (don't blank them) |
| Panel over rating | `FLAG_OVER_RATING` | One amber notice line under the power flow: "This panel is above the 30 W limit" |
| Error | BLE error | One sentence in the header area + "Try again" text button. Not a full-screen alert |

---

## 8. Mock data (`mockConnection.ts`)

Rewrite the mock to emit **v2 Telemetry objects**, with a scenario switch so you can design every state without hardware:

- `'charging'`: light ~70 %, panel ~9.4 W, out ~3.1 W
- `'draining'`: light 0 %, panel 0 W, out ~7.4 W
- `'balanced'`, `'stale'` (stops emitting after 5 s), `'overRating'`

Add small random noise (±0.5 %) so you can see the smoothing working. (±2 % moved the first decimal and the finish time by a few minutes, so the screen no longer matched the mockups.) Keep the dev-only "Mock data" toggle, but move it out of the main UI: put it behind a long-press on the "Solar Bank" title, or show it only in `__DEV__`.

**Exercise:** make the mock's numbers reproduce the mockup values exactly. If your screen shows "Full by 6:52 PM" when the mock clock says 2:14 PM, your math matches the design.

---

## 9. Motion

The app is glanced at often, and values update 5×/s, so motion stays **subtle and rare**:

- **Numbers do not animate** (no count-up). Tabular figures make the instant change look clean.
- Battery bar width: 300 ms ease-out when SoC changes by ≥ 1 %. Otherwise snap.
- State change (Charging ↔ Draining ↔ Not connected): headline cross-fade, 200–250 ms, ease-out. Use `react-native-reanimated` or `Animated` with `useNativeDriver: true` on opacity only.
- Live dot: no pulsing.
- Respect **Reduce Motion**: check `AccessibilityInfo.isReduceMotionEnabled()` and skip all of the above when it's on.

---

## 10. Accessibility

- Each card gets `accessible` + `accessibilityLabel`, e.g. "Battery 62 percent, 47.6 of 76.8 watt-hours".
- The chart gets one summary label, e.g. "Light today peaked near 90 percent at 1 PM. Suggested window 10:40 AM to 3:40 PM."
- Support Dynamic Type up to at least the "Large" text size. Check that the headline wraps instead of being clipped.
- Every interactive element has `accessibilityRole="button"`.

---

## 11. Running the app

| Goal | How | Needs |
| --- | --- | --- |
| Build UI with mock data, in a browser | `npm run web` | Any laptop |
| Build UI with mock data, on a phone | `npm start`, scan the QR code with **Expo Go** | Any iPhone or Android phone |
| Build UI with mock data, in the iOS Simulator | `npm start`, then press `i` | Mac with Xcode (including Simulator.app) |
| Real Bluetooth, Android | `npm run android` (builds a dev client), then `npm run start:dev` | Android Studio (any OS), Android phone on USB |
| Real Bluetooth, iPhone | `npm run ios` (builds a dev client), then `npm run start:dev` | **Mac + Xcode**, iPhone on USB, free Apple ID (re-sign every 7 days) |

Expo Go and the browser **cannot** use Bluetooth. Real BLE testing needs an Android phone (any computer) or an iPhone (Mac only). The Bluetooth permission text is already set in `app.json` via the `react-native-ble-plx` plugin.

---

## 12. Testing

```bash
npx expo install jest-expo jest @types/jest
```

Add `"test": "jest"` and `"jest": {"preset": "jest-expo"}` to `package.json`. Write tests for:

- `decodeTelemetry`: the example hex from §3 decodes to the right values; wrong version → `null`; short packet → `null`
- `socFromVoltage`: table endpoints and one interpolated value
- `computeStats`: the charging and draining mockup numbers produce "6:52 PM" and "1:41 AM"
- suggestion window: before / inside / after / no-history cases

Run `npm run typecheck` and `npm test` before every PR.

---

## 13. Design skills for Claude Code

The UI was designed with these open-source repos (all MIT licensed). Three are Claude Code **skills**. They're included in this bundle under `.claude/skills/`, so Claude Code picks them up automatically when opened at the repo root. Each folder keeps its original `LICENSE`.

| Repo | In `.claude/skills/` | What it's for here |
| --- | --- | --- |
| [TasteSkill](https://github.com/Leonxlnx/taste-skill) | `taste-skill/` | Art direction and anti-generic rules. Its app-screen rules (`references/app-screens.md`) set this app's look. Style dealt: **achromatic-ledger**, light theme, with the "power flow" signature element. |
| [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | `ui-ux-pro-max/` | Searchable UX, contrast, chart and React Native guidelines (`python3 scripts/search.py "<query>" --stack react-native`). Ignore its palette/font picks for this app; §6 wins. |
| [Design Motion Principles](https://github.com/kylezantos/design-motion-principles) | `design-motion-principles/` | Motion rules. Mobile-app weighting: Jakub primary, Emil secondary. Use its **Audit** mode to review the app's animations against §9. |
| [Awesome Claude Design](https://github.com/VoltAgent/awesome-claude-design) | — (link only) | A catalog of `DESIGN.md` brand systems. Not used: none fit this project, and §6 is the design system. |
| Design.md Chrome | — (browser extension) | Extracts a design system from a live website. Only useful if the team picks a reference site to match. |

How to use them with Claude Code:

- Skills load on their own when a task matches. You can also ask directly, e.g. *"use the taste-skill app-screen rules to review `BatteryCard.tsx`"* or *"audit the motion in Home.tsx with design-motion-principles"*.
- The skills are written for web/HTML. When they say CSS, translate to React Native styles (`StyleSheet`, `react-native-svg`). The rules (sizes, colours, contrast, no shadows) carry over unchanged.
- **This guide overrides the skills where they disagree.** The UI is already decided; use the skills to *check and polish* the build, not to redesign it.
- TasteSkill's scripts (`draw.mjs`, `inspect.mjs`) need Node 22+ and Chrome, and target web pages. Mostly read its references instead of running them.

---

## 14. Build order (suggested task split)

| # | Task | Done when |
| --- | --- | --- |
| 1 | Repo cleanup (§2) | No "RC car" left; app still runs on mock |
| 2 | `config.ts` + `theme.ts` + fonts | Geist renders |
| 3 | Protocol v2 types + decoder + tests (§3) | Tests pass |
| 4 | `stats.ts` + tests (§5.1–5.4) | Mockup numbers reproduced |
| 5 | Mock scenarios (§8) | Can flip between all states |
| 6 | Components + Home layout (§6–7) | Screens match the canvas at 390 pt |
| 7 | States: not connected, stale, error (§7) | Each state visible from mock |
| 8 | Light history + suggestion card + chart (§5.5) | Window text updates correctly |
| 9 | Motion + accessibility (§9–10) | VoiceOver reads every card |
| 10 | Firmware v2 packet with fake data → real BLE on a phone | Same screen, real packets |
| 11 | Hardware swaps fake sensor values for real readings | Live readings from the real bank |

Steps 1–9 need no hardware at all.
