idf_component_register(
    SRCS "main.c" "ble_telemetry.c" "sensors.c"
    INCLUDE_DIRS "."
    REQUIRES bt nvs_flash
)
