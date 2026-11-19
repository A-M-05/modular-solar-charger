// The data packet sent from the power bank to the phone over Bluetooth (protocol v3).
// MUST match app/src/protocol/telemetry.ts and docs/protocol.md.
// If you change this struct: update the app decoder and the test packet in docs/protocol.md too.
#pragma once
#include <stddef.h>
#include <stdint.h>

#define TELEMETRY_LEN 14

// Flag bits. Bit 0 = rightmost bit (value 1).
enum {
    FLAG_FAST_CHARGING = 1 << 0,   // 0x01 fast charging active
    FLAG_DONE_CHARGING = 1 << 1,   // 0x02 battery full
    FLAG_CHARGING      = 1 << 2,   // 0x04 panel plugged in and charging
    FLAG_LOW_BATTERY   = 1 << 3,   // 0x08 battery low
    FLAG_PD_FAIL       = 1 << 4,   // 0x10 USB Power Delivery negotiation failed
    // bits 5-7: free, always 0
};

typedef struct __attribute__((packed)) {
    uint8_t  length;       // offset 0  : always TELEMETRY_LEN (14)
    uint8_t  seq;          // offset 1  : packet ID, counts 0-255 then wraps
    uint16_t panel_mV;     // offset 2  : panel voltage, millivolts
    uint16_t panel_mA;     // offset 4  : panel current, milliamps
    uint16_t device_mV;    // offset 6  : voltage to the device being charged, millivolts
    uint16_t device_mA;    // offset 8  : current to the device being charged, milliamps
    uint8_t  soc_pct;      // offset 10 : battery percentage, 0-100
    uint8_t  flags;        // offset 11 : FLAG_* bits
    uint16_t crc;          // offset 12 : CRC-16/CCITT-FALSE of bytes 0-11
} telemetry_t;             // 14 bytes, little-endian

_Static_assert(sizeof(telemetry_t) == TELEMETRY_LEN, "telemetry_t size changed - update the app decoder!");

// CRC-16/CCITT-FALSE: polynomial 0x1021, start value 0xFFFF. Check value: "123456789" -> 0x29B1
static inline uint16_t telemetry_crc16(const uint8_t *d, size_t n)
{
    uint16_t c = 0xFFFF;
    while (n--) {
        c ^= (uint16_t)(*d++) << 8;
        for (int k = 0; k < 8; k++) c = (c & 0x8000) ? (uint16_t)((c << 1) ^ 0x1021) : (uint16_t)(c << 1);
    }
    return c;
}

// Call LAST, after every other field is filled in.
static inline void telemetry_seal(telemetry_t *p)
{
    p->crc = telemetry_crc16((const uint8_t *)p, offsetof(telemetry_t, crc));
}
