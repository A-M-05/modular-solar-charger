// NimBLE GATT server, based on ESP-IDF's examples/bluetooth/nimble/bleprph.
//
// Vocabulary:
//   GATT server     = the ESP32 offers a "menu" of data
//   service         = a folder on that menu (our "Car Telemetry" service)
//   characteristic  = one data item in the folder
//   notify          = ESP32 pushes new values to the phone without being asked
#include "ble_telemetry.h"
#include <string.h>
#include "esp_log.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "host/ble_hs.h"
#include "host/util/util.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"

static const char *TAG = "ble";

// UUIDs must match app/src/protocol/telemetry.ts. BLE_UUID128_INIT takes bytes in REVERSE order.
// Service   6e7a0001-5c1a-4f3b-9b2e-0a1b2c3d4e5f
// Telemetry 6e7a0002-5c1a-4f3b-9b2e-0a1b2c3d4e5f (read + notify)
// Command   6e7a0003-5c1a-4f3b-9b2e-0a1b2c3d4e5f (write)
#define UUID_TAIL 0x5f, 0x4e, 0x3d, 0x2c, 0x1b, 0x0a, 0x2e, 0x9b, 0x3b, 0x4f, 0x1a, 0x5c
static const ble_uuid128_t SVC_UUID = BLE_UUID128_INIT(UUID_TAIL, 0x01, 0x00, 0x7a, 0x6e);
static const ble_uuid128_t TLM_UUID = BLE_UUID128_INIT(UUID_TAIL, 0x02, 0x00, 0x7a, 0x6e);
static const ble_uuid128_t CMD_UUID = BLE_UUID128_INIT(UUID_TAIL, 0x03, 0x00, 0x7a, 0x6e);

static uint16_t s_tlm_handle;
static uint16_t s_conn = BLE_HS_CONN_HANDLE_NONE;
static bool s_subscribed = false;
static uint8_t s_own_addr_type;
static telemetry_t s_last;
static ble_mode_cb_t s_on_mode;

static void advertise(void);

static int chr_access(uint16_t conn, uint16_t attr, struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    if (ctxt->op == BLE_GATT_ACCESS_OP_READ_CHR) {          // phone reads telemetry once
        return os_mbuf_append(ctxt->om, &s_last, sizeof(s_last)) == 0 ? 0 : BLE_ATT_ERR_INSUFFICIENT_RES;
    }
    if (ctxt->op == BLE_GATT_ACCESS_OP_WRITE_CHR) {         // phone sends a command
        uint8_t mode;
        uint16_t len;
        if (ble_hs_mbuf_to_flat(ctxt->om, &mode, 1, &len) != 0 || len != 1 || mode > MODE_AUTO) {
            return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
        }
        ESP_LOGI(TAG, "mode command: %u", mode);
        if (s_on_mode) s_on_mode((drive_mode_t)mode);
        return 0;
    }
    return BLE_ATT_ERR_UNLIKELY;
}

static const struct ble_gatt_svc_def s_services[] = {
    {
        .type = BLE_GATT_SVC_TYPE_PRIMARY,
        .uuid = &SVC_UUID.u,
        .characteristics = (struct ble_gatt_chr_def[]) {
            { .uuid = &TLM_UUID.u, .access_cb = chr_access,
              .flags = BLE_GATT_CHR_F_READ | BLE_GATT_CHR_F_NOTIFY, .val_handle = &s_tlm_handle },
            { .uuid = &CMD_UUID.u, .access_cb = chr_access, .flags = BLE_GATT_CHR_F_WRITE },
            { 0 },
        },
    },
    { 0 },
};

static int gap_event(struct ble_gap_event *ev, void *arg)
{
    switch (ev->type) {
    case BLE_GAP_EVENT_CONNECT:
        ESP_LOGI(TAG, "connect %s", ev->connect.status == 0 ? "ok" : "failed");
        if (ev->connect.status == 0) s_conn = ev->connect.conn_handle;
        else advertise();
        break;
    case BLE_GAP_EVENT_DISCONNECT:
        ESP_LOGI(TAG, "disconnected");
        s_conn = BLE_HS_CONN_HANDLE_NONE;
        s_subscribed = false;
        advertise();
        break;
    case BLE_GAP_EVENT_SUBSCRIBE:
        if (ev->subscribe.attr_handle == s_tlm_handle) {
            s_subscribed = ev->subscribe.cur_notify;
            ESP_LOGI(TAG, "notifications %s", s_subscribed ? "on" : "off");
        }
        break;
    case BLE_GAP_EVENT_ADV_COMPLETE:
        advertise();
        break;
    default:
        break;
    }
    return 0;
}

static void advertise(void)
{
    struct ble_hs_adv_fields f = {0};
    const char *name = ble_svc_gap_device_name();
    f.flags = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP;
    f.name = (const uint8_t *)name;
    f.name_len = strlen(name);
    f.name_is_complete = 1;
    f.uuids128 = &SVC_UUID;        // lets the app find the car by service UUID
    f.num_uuids128 = 1;
    f.uuids128_is_complete = 1;
    int rc = ble_gap_adv_set_fields(&f);
    if (rc) { ESP_LOGE(TAG, "adv fields rc=%d (name too long?)", rc); return; }

    struct ble_gap_adv_params p = {
        .conn_mode = BLE_GAP_CONN_MODE_UND,
        .disc_mode = BLE_GAP_DISC_MODE_GEN,
    };
    rc = ble_gap_adv_start(s_own_addr_type, NULL, BLE_HS_FOREVER, &p, gap_event, NULL);
    if (rc) ESP_LOGE(TAG, "adv start rc=%d", rc);
    else ESP_LOGI(TAG, "advertising as \"%s\"", name);
}

static void on_sync(void)
{
    ble_hs_util_ensure_addr(0);
    ble_hs_id_infer_auto(0, &s_own_addr_type);
    advertise();
}

static void host_task(void *arg)
{
    nimble_port_run();               // runs until nimble_port_stop()
    nimble_port_freertos_deinit();
}

void ble_telemetry_init(ble_mode_cb_t on_mode_command)
{
    s_on_mode = on_mode_command;
    ESP_ERROR_CHECK(nimble_port_init());
    ble_hs_cfg.sync_cb = on_sync;
    ble_svc_gap_init();
    ble_svc_gatt_init();
    ESP_ERROR_CHECK(ble_gatts_count_cfg(s_services));
    ESP_ERROR_CHECK(ble_gatts_add_svcs(s_services));
    nimble_port_freertos_init(host_task);
}

bool ble_telemetry_send(const telemetry_t *pkt)
{
    s_last = *pkt;                   // also served on plain reads
    if (s_conn == BLE_HS_CONN_HANDLE_NONE || !s_subscribed) return false;
    struct os_mbuf *om = ble_hs_mbuf_from_flat(pkt, sizeof(*pkt));
    return om && ble_gatts_notify_custom(s_conn, s_tlm_handle, om) == 0;
}
