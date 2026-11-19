# Bluetooth protocol (v3)

Single source of truth for what the power bank sends. If you change anything here, update **both**
`firmware/esp32/main/telemetry.h` and `app/src/protocol/telemetry.ts`, and the test packet below.

## Names & UUIDs

The **service** is like a folder on the bank; a **characteristic** is a file inside it. The app finds
the bank by these IDs, so they must match exactly.

| What | UUID | Direction |
| --- | --- | --- |
| Service "Bank Telemetry" | `6e7a0001-5c1a-4f3b-9b2e-0a1b2c3d4e5f` | — |
| Telemetry characteristic | `6e7a0002-5c1a-4f3b-9b2e-0a1b2c3d4e5f` | bank → phone (read + notify, **1 per second**) |
| Command characteristic | `6e7a0003-5c1a-4f3b-9b2e-0a1b2c3d4e5f` | phone → bank (write) — reserved, ignored for now |

Device advertises as **`SolarBank`**. Data is sent with GATT notifications.

## Telemetry packet — 14 bytes, little-endian, all unsigned

Little-endian = for 2-byte numbers, the low byte is sent first (7812 = `0x1E84` is sent as `84 1E`).

| Offset | Type | Field | Unit / meaning |
| --- | --- | --- | --- |
| 0 | uint8 | length | always 14 |
| 1 | uint8 | seq | packet ID, counts 0–255 then wraps to 0 |
| 2 | uint16 | panel_mV | panel voltage, mV |
| 4 | uint16 | panel_mA | panel current, mA |
| 6 | uint16 | device_mV | voltage to the device being charged, mV |
| 8 | uint16 | device_mA | current to the device being charged, mA |
| 10 | uint8 | soc_pct | battery percentage, 0–100 |
| 11 | uint8 | flags | see below |
| 12 | uint16 | crc | CRC-16/CCITT-FALSE of bytes 0–11 |

### Flag byte

Bit 0 = rightmost bit (value 1). Endianness doesn't apply inside a single byte.

| Bit | Value | Flag |
| --- | --- | --- |
| 0 | `0x01` | fast charging |
| 1 | `0x02` | done charging (battery full) |
| 2 | `0x04` | plugged in / charging |
| 3 | `0x08` | low battery |
| 4 | `0x10` | USB Power Delivery negotiation failed |
| 5–7 | — | free, always 0 |

Example: `0x05` = `0000 0101` = bits 0 and 2 = fast charging + charging.

### CRC

CRC-16/CCITT-FALSE: polynomial `0x1021`, start value `0xFFFF`, no reflection, no final XOR.
Calculated over bytes 0–11, stored little-endian in bytes 12–13. Check value: `"123456789"` → `0x29B1`.
C: `telemetry_seal()` in `telemetry.h` · TypeScript: `crc16()` in `telemetry.ts`.

The app drops a packet if the length isn't 14, the length byte isn't 14, or the CRC doesn't match.

### Test packet

```
0e 01 50 46 0a 02 88 13 6c 02 3e 04 10 73
```

length 14 · packet #1 · panel 18.000 V × 0.522 A = **9.4 W** · device 5.000 V × 0.620 A = **3.1 W** ·
battery **62 %** · flags `0x04` (charging) · CRC `0x7310`.

Both sides are tested against it: the C code produces exactly these bytes, and
`app/src/protocol/__tests__/telemetry.test.ts` decodes them back to the same values.

## Command packet

Not used yet. Writes are accepted and ignored.

## Stats computed in the app (`app/src/protocol/stats.ts`)

All tunable numbers are in `app/src/config.ts`.

- P_panel = V_panel · I_panel, P_out = V_device · I_device
- P_net = P_panel · η − P_out (η = 0.90); |P_net| < 0.1 W = balanced
- SoC = soc_pct / 100 (straight from the packet)
- E_now = SoC · 76.8 Wh
- Time to full = (76.8 − E_now) / P_net · Time left = E_now / −P_net
- Light level (estimate, no light sensor) = min(100, P_panel / panelRatedW · 100), panelRatedW = 20 W
- Dropped packets = (seq − last_seq − 1) mod 256
- Smoothing: y = αx + (1−α)y, α = 0.5 (lag ≈ 1 s / α ≈ 2 s), applied to V, I and battery %
- Stale: no packet for 3 s (3 missed packets)
