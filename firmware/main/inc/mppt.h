#ifndef _MPPT_H_
#define _MPPT_H_

#include <stdio.h>
#include <string.h>
#include "driver/gpio.h"
#include "soc/adc_channel.h"
#include "driver/ledc.h"


/* P&O Adjustment Value */
#define PO_ADJ_VAL 1
/* 10 Bit Resolution for Duty Cycle -- 5% min, 90% max */
#define DUTY_CYCLE_MAX 921
#define DUTY_CYCLE_MIN 51
/* Battery Voltage Rounded */
#define BATTERY_VOLTAGE 13

typedef struct {
    uint16_t voltage;
    uint16_t current;
    uint32_t power;
} power_t;

/* Reads the ADC for the P=VI of the Panel */
void read_power_adc();

/* Test inputs for Panel Simulation */
void read_test_inputs(power_t* output_holder);

/* Runs Preturb and Observe and return DAC value 
    INPUT: Current Power Value, Previous Power Value
    OUTPUT: Integer Value Corresponding to Duty Cycle */
uint16_t peturb_and_observe(const uint16_t duty_cycle, const power_t* current, const power_t* previous, const power_t* older);

/* Sends the output signal to change the buck converter duty cycle 
    INPUT: 8 Bit Digital Value to Convert
    OUTPUT: Bool for proper execution */    
bool send_signal_LEDPWM(uint16_t duty_cycle_val);

/* All of the Initializers necessary for MPPT to work */
void configure_MPPT();

/* Main Loop MPPT */
void mppt_main();

void sim_compare_duty_cycles();


#endif