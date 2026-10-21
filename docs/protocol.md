# Bluetooth protocol (v1)

Single source of truth for what the car sends. If you change anything here, update **both**
`firmware/esp32/main/telemetry.h` and `app/src/protocol/telemetry.ts`, and bump the version.

## Names & UUIDs

| What | UUID | Direction |
| --- | --- | --- |
| Service "Car Telemetry" | `6e7a0001-5c1a-4f3b-9b2e-0a1b2c3d4e5f` | — |
| Telemetry characteristic | `6e7a0002-5c1a-4f3b-9b2e-0a1b2c3d4e5f` | car → phone (read + notify, 5 Hz) |
| Command characteristic | `6e7a0003-5c1a-4f3b-9b2e-0a1b2c3d4e5f` | phone → car (write) |

Device advertises as **`SolarRC`**.

## Telemetry packet — 20 bytes, little-endian

| Offset | Type | Field | Unit |
| --- | --- | --- | --- |
| 0 | uint8 | version | = 1 |
| 1 | uint8 | mode | 0 manual, 1 auto |
| 2 | uint16 | vbat_mV | mV |
| 4 | int16 | ipanel_mA | mA (solar in) |
| 6 | int16 | iload_mA | mA (used by car) |
| 8 | uint16 ×4 | light[0..3] | raw ADC 0–4095 (FL, FR, BL, BR) |
| 16 | uint32 | uptime_ms | ms since boot |

Example: `0101841e85ffc801010002000300ff0f40e20100` → v1, auto, 7.812 V, −0.123 A, 0.456 A, light [1,2,3,4095], 123.456 s.

## Command packet — 1 byte

| Byte | Meaning |
| --- | --- |
| `0x00` | switch to manual |
| `0x01` | switch to auto (light-seeking) |

## Stats computed in the app (`app/src/protocol/stats.ts`)

- P_in = V · I_panel, P_out = V · I_load
- SoC from voltage lookup table (2S LiPo, 6.6–8.4 V)
- E_now = SoC · 16.3 Wh
- Time to full = (16.3 − E_now) / (P_in − P_out)
- Time left = E_now / (P_out − P_in)
- Smoothing: y = αx + (1−α)y, α = 0.2
