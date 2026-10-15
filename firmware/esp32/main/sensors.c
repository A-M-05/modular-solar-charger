#include "sensors.h"
#include <math.h>
#include "esp_timer.h"

// Set to 0 once real sensors are wired up.
#define USE_FAKE_DATA 1

static drive_mode_t s_mode = MODE_MANUAL;

void sensors_init(void)
{
    // TODO (hardware): set up the parts once the final list is known, e.g.
    //   - ADC (adc_oneshot driver) for the battery voltage divider and the 4 light sensors
    //   - I2C (i2c_master driver) for the INA219/INA226 current sensors
    //   - OR, if the STM32 does all sensing: a UART that receives telemetry_t from the STM32
}

void sensors_set_mode(drive_mode_t mode)
{
    s_mode = mode;
    // TODO: tell the motor-control code (or the STM32) about the new mode
}

void sensors_read(telemetry_t *out)
{
    uint32_t ms = (uint32_t)(esp_timer_get_time() / 1000);
    out->version   = TELEMETRY_VERSION;
    out->mode      = s_mode;
    out->uptime_ms = ms;

#if USE_FAKE_DATA
    float t = ms / 1000.0f;
    out->vbat_mV   = 7600 + (int)(300 * sinf(t / 30));
    out->ipanel_mA = 300 + (int)(250 * sinf(t / 20));
    out->iload_mA  = (s_mode == MODE_AUTO) ? 550 : 150;
    for (int i = 0; i < 4; i++) {
        out->light[i] = 2000 + (int)(1500 * sinf(t / 5 + i));
    }
#else
    // TODO (hardware): fill these from real readings
    // vbat_mV   = adc_mV * (R1 + R2) / R2          (voltage divider)
    // ipanel_mA = ina_read_current(PANEL_INA_ADDR)
    // iload_mA  = ina_read_current(LOAD_INA_ADDR)
    // light[i]  = adc_read(LIGHT_CH[i])
#endif
}
