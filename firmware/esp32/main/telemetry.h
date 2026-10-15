// The data packet sent from the car to the phone over Bluetooth.
// MUST match app/src/protocol/telemetry.ts and docs/protocol.md.
// If you change this struct: bump TELEMETRY_VERSION and update the app decoder too.
#pragma once
#include <stdint.h>

#define TELEMETRY_VERSION 1

typedef enum {
    MODE_MANUAL = 0,
    MODE_AUTO   = 1,   // autonomous light-seeking
} drive_mode_t;

typedef struct __attribute__((packed)) {
    uint8_t  version;      // offset 0  : TELEMETRY_VERSION
    uint8_t  mode;         // offset 1  : drive_mode_t
    uint16_t vbat_mV;      // offset 2  : battery voltage, millivolts
    int16_t  ipanel_mA;    // offset 4  : solar charge current, milliamps
    int16_t  iload_mA;     // offset 6  : current drawn by the car, milliamps
    uint16_t light[4];     // offset 8  : light sensors, raw ADC 0-4095 (FL, FR, BL, BR)
    uint32_t uptime_ms;    // offset 16 : time since boot
} telemetry_t;             // 20 bytes total = fits one BLE packet with default settings

_Static_assert(sizeof(telemetry_t) == 20, "telemetry_t size changed - update the app decoder!");
