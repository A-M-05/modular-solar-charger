// Bluetooth LE (BLE) server: advertises as "SolarRC", lets one phone connect,
// pushes telemetry_t as notifications, and accepts a 1-byte mode command.
#pragma once
#include <stdbool.h>
#include "telemetry.h"

typedef void (*ble_mode_cb_t)(drive_mode_t mode);

void ble_telemetry_init(ble_mode_cb_t on_mode_command);
bool ble_telemetry_send(const telemetry_t *pkt);   // returns false if no phone is subscribed
