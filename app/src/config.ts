// Hardware assumptions (docs/SOLAR_BANK_APP_GUIDE.md §1). Change them here once the team decides.

// 4S LiFePO4, 12.8 V nominal, 6 Ah
export const BATTERY_WH = 12.8 * 6; // 76.8 Wh

export const MAX_PANEL_W = 30;
export const FAST_CHARGE_W = 15;     // panel input at or above this = fast charging
export const CHARGER_EFFICIENCY = 0.9; // until the hardware measures battery current directly
