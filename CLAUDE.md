# Modular Solar Charger

Solar power bank with swappable panels (UCI EECS 159A/B). An ESP32 sends battery, panel, and light data over BLE to an iOS app (React Native + Expo, in `app/`).

## Read first

- `docs/SOLAR_BANK_APP_GUIDE.md`: the app spec (protocol v2, formulas, design tokens, screen states, build order). It is the source of truth for the app.
- `docs/ui/*.png`: the screens to match.

## Rules

- `docs/protocol.md`, `firmware/esp32/main/telemetry.h`, and `app/src/protocol/telemetry.ts` must always agree. Change one, change all three and bump the version.
- All derived numbers live as pure functions in `app/src/protocol/stats.ts`, with unit tests.
- All colours, sizes, and fonts come from `app/src/theme.ts`. No hard-coded hex values in components.
- Run `npm run typecheck` and `npm test` in `app/` before committing.

## Design skills

`.claude/skills/` holds `taste-skill`, `ui-ux-pro-max`, and `design-motion-principles`. Use them to review and polish UI work. Where they disagree with the guide, the guide wins.
