// Entry point: start Bluetooth, then read sensors and send telemetry once per second.
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "ble_telemetry.h"
#include "sensors.h"

#define TELEMETRY_PERIOD_MS 1000  // 1 Hz

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
        ESP_LOGD(TAG, "seq=%u panel=%umV/%umA device=%umV/%umA soc=%u%% flags=0x%02x crc=0x%04x sent=%d",
                 pkt.seq, pkt.panel_mV, pkt.panel_mA, pkt.device_mV, pkt.device_mA, pkt.soc_pct,
                 pkt.flags, pkt.crc, sent);
        vTaskDelay(pdMS_TO_TICKS(TELEMETRY_PERIOD_MS));
    }
}
