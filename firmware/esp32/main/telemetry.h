// The data packet sent from the power bank to the phone over Bluetooth.
// MUST match app/src/protocol/telemetry.ts and docs/protocol.md.
// If you change this struct: bump TELEMETRY_VERSION and update the app decoder too.
#pragma once
#include <stdint.h>

#define TELEMETRY_VERSION 2

enum {
    FLAG_PANEL       = 1 << 0,   // a panel is plugged in
    FLAG_FAST        = 1 << 1,   // fast charging is active
    FLAG_OVER_RATING = 1 << 2,   // attached panel is above max_rating_W
};

typedef struct __attribute__((packed)) {
    uint8_t  version;          // offset 0  : TELEMETRY_VERSION
    uint8_t  flags;            // offset 1  : FLAG_* bits
    uint16_t vbat_mV;          // offset 2  : battery voltage, millivolts
    uint16_t vpanel_mV;        // offset 4  : panel voltage, millivolts
    int16_t  ipanel_mA;        // offset 6  : panel current into the charger, milliamps
    int16_t  iout_mA;          // offset 8  : current to the output ports (at battery voltage), milliamps
    uint16_t light_permille;   // offset 10 : 0-1000 = 0.0-100.0 % of full sun
    uint8_t  panel_rating_W;   // offset 12 : rating of the attached panel (0 = unknown)
    uint8_t  max_rating_W;     // offset 13 : max rating the controller accepts
    uint8_t  ports_on;         // offset 14 : bitmask of output ports that are on
    uint8_t  reserved;         // offset 15 : 0 (later: temperature)
    uint32_t uptime_ms;        // offset 16 : time since boot
} telemetry_t;                 // 20 bytes total = fits one BLE packet with default settings

_Static_assert(sizeof(telemetry_t) == 20, "telemetry_t size changed - update the app decoder!");
