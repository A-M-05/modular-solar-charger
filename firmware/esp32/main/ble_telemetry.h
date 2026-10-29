// Bluetooth LE (BLE) server: advertises as "SolarBank", lets one phone connect,
// and pushes telemetry_t as notifications.
#pragma once
#include <stdbool.h>
#include "telemetry.h"

void ble_telemetry_init(void);
bool ble_telemetry_send(const telemetry_t *pkt);   // returns false if no phone is subscribed
