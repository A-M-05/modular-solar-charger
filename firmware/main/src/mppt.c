#include "mppt.h"

/* Reads the ADC for the P=VI of the Panel */
void read_power_adc(){

}

/* Test inputs for Panel Simulation */
void read_test_inputs(power_t* output_holder){

}

/* Runs Preturb and Observe and return DAC value 
    INPUT: Current Power Value, Previous Power Value
    OUTPUT: Integer Value Corresponding to Duty Cycle */
uint8_t peturb_and_observe(const power_t* current, const power_t* previous){
    return 0;
}

/* Sends the output signal to change the buck converter duty cycle 
    INPUT: 8 Bit Digital Value to Convert
    OUTPUT: Bool for proper execution */    
bool send_signal_dac(uint8_t duty_cycle_val){

    return false;
}

void sim_compare_duty_cycles(){

}