# Bluetooth protocol (v2)

Single source of truth for what the power bank sends. If you change anything here, update **both**
`firmware/esp32/main/telemetry.h` and `app/src/protocol/telemetry.ts`, and bump the version.

## Names & UUIDs

| What | UUID | Direction |
| --- | --- | --- |
| Service "Bank Telemetry" | `6e7a0001-5c1a-4f3b-9b2e-0a1b2c3d4e5f` | — |
| Telemetry characteristic | `6e7a0002-5c1a-4f3b-9b2e-0a1b2c3d4e5f` | bank → phone (read + notify, 5 Hz) |
| Command characteristic | `6e7a0003-5c1a-4f3b-9b2e-0a1b2c3d4e5f` | phone → bank (write) — reserved, ignored for now |

Device advertises as **`SolarBank`**.

## Telemetry packet — 20 bytes, little-endian

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

The app rejects packets shorter than 20 bytes or with `version != 2`.

### Example: the "Charging" mockup

```
02 01 9033 5046 0a02 eb00 c602 14 1e 03 00 40e20100
```

`0201903350460a02eb00c602141e030040e20100` →
v2 · panel connected · 13.200 V battery · 18.000 V × 0.522 A = **9.4 W** panel ·
0.235 A × 13.2 V = **3.1 W** out · light **71.0 %** · 20 W panel, max 30 W · ports 0 and 1 on · 123.456 s.

Decoded in `app/src/protocol/__tests__/telemetry.test.ts`.

## Command packet

Not used yet. Writes are accepted and ignored. Later: toggle output ports.

## Stats computed in the app (`app/src/protocol/stats.ts`)

All tunable numbers are in `app/src/config.ts`.

- P_panel = V_panel · I_panel, P_out = V_bat · I_out
- P_net = P_panel · η − P_out (η = 0.90 until the hardware measures battery current); |P_net| < 0.1 W = balanced
- SoC from a resting-voltage lookup table (4S LiFePO4, 10.0–13.6 V)
- E_now = SoC · 76.8 Wh
- Time to full = (76.8 − E_now) / P_net · Time left = E_now / −P_net
- Fast charging = `FLAG_FAST` or P_panel ≥ 15 W
- Smoothing: y = αx + (1−α)y, α = 0.2, applied to V, I and light before any of the above
