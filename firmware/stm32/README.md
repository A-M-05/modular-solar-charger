# STM32 firmware (placeholder)

Create this project from **STM32CubeIDE** (or the STM32 VS Code extension) once the board is decided:
File → New → STM32 Project → pick your Nucleo board → save it in this folder.

**Only needed if the STM32 stays the main controller** (motors, sensors, RC receiver).
In that setup the STM32 fills a `telemetry_t` (copy `../esp32/main/telemetry.h`) and sends it
over UART to the ESP32, which only forwards it over Bluetooth. Change `sensors_read()` in the
ESP32 code to read from that UART instead of from sensors.
