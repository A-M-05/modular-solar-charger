// Reads all sensors into a telemetry_t.
// Right now it returns FAKE data so Bluetooth + the app can be built before parts arrive.
// Hardware team: replace the TODOs in sensors.c once wiring is decided.
#pragma once
#include "telemetry.h"

void sensors_init(void);
void sensors_read(telemetry_t *out);
void sensors_set_mode(drive_mode_t mode);
