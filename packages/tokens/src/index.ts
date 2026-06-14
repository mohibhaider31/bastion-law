// ── Colours ──────────────────────────────────────────────────
export const colors = {
  burgundy:        '#6B1E2B',
  burgundyDark:    '#4A141E',
  brass:           '#B68A4E',
  brassLight:      '#C8A15C',
  cream:           '#F6F1EA',
  card:            '#FFFFFF',
  boardBg:         '#E7E5E1',
  ink:             '#241D1C',
  inkSecondary:    '#6E635F',
  inkTertiary:     '#A89F99',
  inkMuted:        '#8A817B',
  border:          '#ECE4D9',
  borderLight:     '#F3EDE3',
  roseTint:        '#F0E3E1',
  roseBg:          '#FBF1EE',
  amber:           '#9A6B1E',
  amberBg:         '#F6ECD8',
  green:           '#3F7A5B',
  greenBg:         '#EAF1EC',
  red:             '#C0392B',
  redBg:           '#FDF0EE',
  sidebar:         '#1C1512',
  darkInactive:    'rgba(246,241,234,0.45)',
} as const;

// ── Typography ───────────────────────────────────────────────
export const fonts = {
  serif:  'Newsreader',
  sans:   'HankenGrotesk',
  mono:   'GeistMono',
} as const;

export const fontSizes = {
  xs:   10,
  sm:   12,
  base: 14,
  md:   16,
  lg:   18,
  xl:   20,
  '2xl': 22,
  '3xl': 24,
  '4xl': 28,
  '5xl': 32,
  '6xl': 38,
} as const;

export const fontWeights = {
  regular:   '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
} as const;

// ── Spacing ──────────────────────────────────────────────────
export const spacing = {
  1:  4,
  1.5: 6,
  2:  8,
  2.5: 10,
  3:  12,
  3.5: 14,
  4:  16,
  4.5: 18,
  5:  20,
  6:  24,
  7:  28,
  8:  32,
  10: 40,
  12: 48,
  14: 56,
} as const;

// ── Border Radii ─────────────────────────────────────────────
export const radii = {
  pill:    999,
  hero:    22,
  card:    16,
  listRow: 14,
  modal:   24,
  input:   12,
  btnLg:   14,
  btnSm:   999,
  logo:    9,
} as const;

// ── Shadows ──────────────────────────────────────────────────
export const shadows = {
  phone:  '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)',
  modal:  '0 24px 60px rgba(0,0,0,0.18)',
} as const;

// ── Stage config (for progress bars and stepper) ─────────────
export const MATTER_STAGES = [
  'intake',
  'documentation',
  'filing',
  'hearing',
  'judgment',
  'closed',
] as const;

export type MatterStage = typeof MATTER_STAGES[number];
