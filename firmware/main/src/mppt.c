#include "mppt.h"

/* Reads the ADC for the P=VI of the Panel */
void read_power_adc(){

}

/* Test inputs for Panel Simulation */
void read_test_inputs(power_t* output_holder){

}

uint16_t _adjust_duty_cycle(bool to_add, const uint16_t duty_cycle){
    uint16_t temp_duty_cycle = (to_add) ? duty_cycle + PO_ADJ_VAL: duty_cycle - PO_ADJ_VAL;
    return (duty_cycle <= DUTY_CYCLE_MAX && duty_cycle >= DUTY_CYCLE_MIN) ? temp_duty_cycle: duty_cycle;
}

/* Runs Preturb and Observe and return DAC value 
    INPUT: Current Power Value, Previous Power Value
    OUTPUT: Integer Value Corresponding to Duty Cycle */
uint16_t peturb_and_observe(const uint16_t duty_cycle, const power_t* current, const power_t* previous, const power_t* older){

    // Battery FULL (STOP, HANDLE THIS IN MAIN LOOP BEFORE P&O RUNS)                                    /////////////////////////////////////////////////////
    // Under Voltage (Not enough sun)
    if (current->voltage <= BATTERY_VOLTAGE)
        return 0; // MUST CHECK for 0 in outer loop, means ERROR
    // Get Important Fields
    double power_past_difference = previous->power - older->power;
    double power_current_difference = current->power - previous->power;

    double voltage_current_difference = current->voltage - previous->voltage;

    double threshold = current->power * 0.05;

    // Check trend with OLDER for possible weather changes
    // Cloud Cover -- Current & Past power falling RAPIDLY, < -threshold
    if (power_current_difference < -threshold && power_past_difference < -threshold)
        return duty_cycle;
    // Power Spike -- (Shade->Sun) (Large INCREASE in power so P&O KEEPS Increasing > 5% -- Should Oscillate)
    if (power_current_difference > threshold && power_past_difference > threshold)
        return duty_cycle;

    // Run P&O
    bool to_add;
    if (power_current_difference > 0){
        // Check if P Increased, V Increased (decrease duty cycle) (increase voltage, keep going same direction)
        if (voltage_current_difference >= 0)
            to_add = true;
            //return duty_cycle + PO_ADJ_VAL;
        // Check P Increased, Voltage decreased (increase duty cycle) (decrease voltage, SLOW down)
        else
            to_add = false;
            //return duty_cycle - PO_ADJ_VAL;
    }
    else{
        // Check P Decreased, V Increased (increase duty cycle) (decrease voltage, want to do opposite so P increases)
        if (voltage_current_difference < 0)
            to_add = false;
            //return duty_cycle - PO_ADJ_VAL;
        // Check P Decreased, V Decreased (decrease duty cycle) (increase voltage so P increases)
        else
            to_add = true;
            //return duty_cycle + PO_ADJ_VAL;
    }

    return _adjust_duty_cycle(to_add, duty_cycle);
}

/* Sends the output signal to change the buck converter duty cycle 
    INPUT: 8 Bit Digital Value to Convert
    OUTPUT: Bool for proper execution */    
bool send_signal_LEDPWM(uint16_t duty_cycle_val, ledc_channel_t channel){
    esp_err_t err = ledc_set_duty_and_update(LEDC_HIGH_SPEED_MODE, channel, duty_cycle_val, 0);
    return (err == ESP_OK) ? true: false;
}

void configure_MPPT(){
    // LEDC PWM
    ledc_timer_config(); // TODO
    ledc_channel_config(); // TODO
    // ADC                  TODO
}

void sim_compare_duty_cycles(){

}