// Entry point: start Bluetooth, then read sensors and send telemetry 5x per second.
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "ble_telemetry.h"
#include "sensors.h"

#define TELEMETRY_PERIOD_MS 200   // 5 Hz

static const char *TAG = "main";

void app_main(void)
{
    // NVS = small flash storage; the Bluetooth stack needs it
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);

    sensors_init();
    ble_telemetry_init();

    telemetry_t pkt;
    while (1) {
        sensors_read(&pkt);
        bool sent = ble_telemetry_send(&pkt);
        ESP_LOGD(TAG, "vbat=%umV vpanel=%umV ipanel=%dmA iout=%dmA light=%u flags=0x%02x sent=%d",
                 pkt.vbat_mV, pkt.vpanel_mV, pkt.ipanel_mA, pkt.iout_mA, pkt.light_permille,
                 pkt.flags, sent);
        vTaskDelay(pdMS_TO_TICKS(TELEMETRY_PERIOD_MS));
    }
}
