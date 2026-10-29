#include "sensors.h"
#include <math.h>
#include "esp_timer.h"

// Set to 0 once real sensors are wired up.
#define USE_FAKE_DATA 1

#define MAX_RATING_W   30   // max panel rating the controller accepts
#define FAST_CHARGE_MW 15000

void sensors_init(void)
{
    // TODO (hardware): set up the parts once the final list is known, e.g.
    //   - ADC (adc_oneshot driver) for the battery/panel voltage dividers and the light sensor
    //   - I2C (i2c_master driver) for the INA219/INA226 current sensors
    //   - OR, if the STM32 does all sensing: a UART that receives telemetry_t from the STM32
}

void sensors_read(telemetry_t *out)
{
    uint32_t ms = (uint32_t)(esp_timer_get_time() / 1000);
    out->version      = TELEMETRY_VERSION;
    out->uptime_ms    = ms;
    out->max_rating_W = MAX_RATING_W;
    out->reserved     = 0;

#if USE_FAKE_DATA
    // A 20 W panel under slowly changing sun, 2 ports on.
    float t   = ms / 1000.0f;
    float sun = 0.5f + 0.5f * sinf(t / 20);
    out->vbat_mV        = 13100 + (int)(100 * sinf(t / 30));
    out->vpanel_mV      = sun > 0.05f ? 18800 : 0;
    out->ipanel_mA      = (int16_t)(1000 * sun);
    out->iout_mA        = 235;
    out->light_permille = (uint16_t)(1000 * sun);
    out->panel_rating_W = 20;
    out->ports_on       = 0x03;
    out->flags          = FLAG_PANEL;   // panel always plugged in
#else
    // TODO (hardware): fill these from real readings
    // vbat_mV        = adc_mV * (R1 + R2) / R2          (voltage divider)
    // vpanel_mV      = same, on the panel input
    // ipanel_mA      = ina_read_current(PANEL_INA_ADDR)
    // iout_mA        = ina_read_current(OUT_INA_ADDR)
    // light_permille = light sensor reading scaled to 0-1000 of full sun
    // panel_rating_W = read from the swappable panel's ID (0 if unknown)
    // ports_on       = which output ports are switched on
    // flags          = FLAG_PANEL if a panel is plugged in
#endif

    uint32_t panel_mW = (uint32_t)out->vpanel_mV * (out->ipanel_mA > 0 ? out->ipanel_mA : 0) / 1000;
    out->flags |= (panel_mW >= FAST_CHARGE_MW ? FLAG_FAST : 0)
                | (out->panel_rating_W > MAX_RATING_W ? FLAG_OVER_RATING : 0);
}
