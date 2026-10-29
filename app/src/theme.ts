// Design tokens. See SOLAR_BANK_APP_GUIDE.md §6. The accent (amber) is ONLY for solar data.
import { TextStyle } from 'react-native';

export const color = {
  ground: '#f2f4f7', // screen background (blue-grey, like a meter)
  surface: '#ffffff', // cards
  raised: '#eeeeee', // battery bar track
  border: '#e6e6e6', // card edges and dividers
  control: '#d4d4d4',
  text: '#0a0a0a',
  muted: '#6b6b6b', // labels; passes 4.5:1 on white and on ground
  idle: '#a3a3a3', // offline dot, yesterday's line
  accent: '#b45309', // solar amber, ONLY on solar data
  accentTint: '#fbefe4', // suggested-window band
  positive: '#2e7d32', // "Live" dot
  negative: '#c4242a', // depletion %/h only
};

export const radius = { card: 8, control: 6, bar: 4 };
export const space = { margin: 16, gap: 12, cardPad: 16 };

export const font = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
};

export const size = {
  headline: 28,
  battery: 30,
  flow: 20,
  kpi: 22,
  suggestion: 20,
  appName: 17,
  body: 14,
  label: 13,
  small: 12,
  tick: 11,
};

/** Digits keep the same width so values updating 5×/s don't jiggle. */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };
