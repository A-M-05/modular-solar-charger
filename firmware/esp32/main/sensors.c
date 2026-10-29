#include "sensors.h"
#include <math.h>
#include "esp_timer.h"

// Set to 0 once real sensors are wired up.
#define USE_FAKE_DATA 1

#define MAX_RATING_W      30     // must match the controller hardware
#define FAST_THRESHOLD_mW 15000  // fast charging at >= 15 W panel input
#define FAKE_DAY_S        120.0f // fake data runs one "day" every 2 minutes

void sensors_init(void)
{
    // TODO (hardware): set up the parts once the final list is known, e.g.
    //   - ADC (adc_oneshot driver) for the battery voltage divider and the light sensor
    //   - I2C (i2c_master driver) for the INA219/INA226 current sensors (panel + output)
    //   - a way to read the attached panel's rating (ID resistor, EEPROM, ...)
    //   - OR, if the STM32 does all sensing: a UART that receives telemetry_t from the STM32
}

void sensors_read(telemetry_t *out)
{
    uint32_t ms = (uint32_t)(esp_timer_get_time() / 1000);
    out->version      = TELEMETRY_VERSION;
    out->max_rating_W = MAX_RATING_W;
    out->reserved     = 0;
    out->uptime_ms    = ms;

#if USE_FAKE_DATA
    // Sun rises and sets once per FAKE_DAY_S; half of each "day" is night.
    float phase = fmodf(ms / 1000.0f, FAKE_DAY_S) / FAKE_DAY_S;
    float sun   = fmaxf(0.0f, sinf(phase * 2.0f * (float)M_PI));
    out->light_permille = (uint16_t)(sun * 900);              // peaks at 90 % of full sun
    out->panel_rating_W = 20;
    out->vpanel_mV      = sun > 0.02f ? 18000 : 0;
    out->ipanel_mA      = (int16_t)(sun * 900);              // up to ~16 W, so FLAG_FAST shows at midday
    out->vbat_mV        = 13150 + (int)(30 * sinf(phase * 2.0f * (float)M_PI));
    out->iout_mA        = 235;                               // ~3.1 W to two ports
    out->ports_on       = 0x03;
#else
    // TODO (hardware): fill these from real readings
    // vbat_mV        = adc_mV * (R1 + R2) / R2          (voltage divider)
    // vpanel_mV      = ina_read_bus_voltage(PANEL_INA_ADDR)
    // ipanel_mA      = ina_read_current(PANEL_INA_ADDR)
    // iout_mA        = ina_read_current(OUT_INA_ADDR)
    // light_permille = adc_read(LIGHT_CH) scaled so full sun = 1000
    // panel_rating_W = read from the panel's ID
    // ports_on       = state of the output port switches
#endif

    uint32_t panel_mW = (uint32_t)out->vpanel_mV * (uint32_t)(out->ipanel_mA > 0 ? out->ipanel_mA : 0) / 1000;
    out->flags = 0;
    if (out->panel_rating_W > 0) out->flags |= FLAG_PANEL;
    if (panel_mW >= FAST_THRESHOLD_mW) out->flags |= FLAG_FAST;
    if (out->panel_rating_W > out->max_rating_W) out->flags |= FLAG_OVER_RATING;
}
