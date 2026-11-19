#include "sensors.h"
#include <math.h>
#include <stdbool.h>
#include "esp_timer.h"

// Set to 0 once real sensors are wired up.
#define USE_FAKE_DATA 1

#define FAST_THRESHOLD_mW 15000  // fake data only: "fast charging" at >= 15 W panel input
#define LOW_BATTERY_PCT   20     // low-battery flag at or below this
#define FAKE_DAY_S        120.0f // fake data runs one "day" every 2 minutes

void sensors_init(void)
{
    // TODO (hardware): set up the parts once the final list is known, e.g.
    //   - I2C (i2c_master driver) for the INA219/INA226 current sensors (panel + device output)
    //   - GPIO inputs for the charger's status pins (charging / done)
    //   - the USB PD controller (to read fast-charge and negotiation-failure status)
    //   - OR, if another chip does all sensing: a UART that receives telemetry_t from it
}

void sensors_read(telemetry_t *out)
{
    static uint8_t seq = 0;
    out->length = TELEMETRY_LEN;
    out->seq    = seq++;               // wraps 255 -> 0 by itself

#if USE_FAKE_DATA
    uint32_t ms = (uint32_t)(esp_timer_get_time() / 1000);
    // Sun rises and sets once per FAKE_DAY_S; half of each "day" is night.
    float phase = fmodf(ms / 1000.0f, FAKE_DAY_S) / FAKE_DAY_S;
    float sun   = fmaxf(0.0f, sinf(phase * 2.0f * (float)M_PI));
    out->panel_mV  = sun > 0.02f ? 18000 : 0;
    out->panel_mA  = (uint16_t)(sun * 900);      // up to ~16 W, so fast charging shows at midday
    out->device_mV = 5000;
    out->device_mA = 620;                        // ~3.1 W to the plugged-in device
    out->soc_pct   = (uint8_t)(55 + 30 * sinf(phase * 2.0f * (float)M_PI));
    bool pd_fail   = false;
#else
    // TODO (hardware): fill these from real readings
    // panel_mV  = ina_read_bus_voltage(PANEL_INA_ADDR)
    // panel_mA  = ina_read_current(PANEL_INA_ADDR)
    // device_mV = ina_read_bus_voltage(DEVICE_INA_ADDR)
    // device_mA = ina_read_current(DEVICE_INA_ADDR)
    // soc_pct   = battery percentage (fuel gauge or voltage lookup)
    // pd_fail   = status from the USB PD controller
    bool pd_fail = false;
#endif

    uint32_t panel_mW = (uint32_t)out->panel_mV * out->panel_mA / 1000;
    out->flags = 0;
    if (panel_mW >= FAST_THRESHOLD_mW)    out->flags |= FLAG_FAST_CHARGING;  // TODO: real fast-charge status
    if (out->soc_pct >= 100)              out->flags |= FLAG_DONE_CHARGING;  // TODO: charger DONE pin
    if (out->panel_mA > 20)               out->flags |= FLAG_CHARGING;       // TODO: charger CHRG pin
    if (out->soc_pct <= LOW_BATTERY_PCT)  out->flags |= FLAG_LOW_BATTERY;
    if (pd_fail)                          out->flags |= FLAG_PD_FAIL;

    telemetry_seal(out);   // CRC last
}
