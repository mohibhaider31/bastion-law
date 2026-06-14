export const colors = {
  burgundy:      '#6B1E2B',
  burgundyDark:  '#4A141E',
  brass:         '#B68A4E',
  brassLight:    '#C8A15C',
  cream:         '#F6F1EA',
  card:          '#FFFFFF',
  ink:           '#241D1C',
  inkSecondary:  '#6E635F',
  inkTertiary:   '#A89F99',
  inkMuted:      '#8A817B',
  border:        '#ECE4D9',
  borderLight:   '#F3EDE3',
  roseTint:      '#F0E3E1',
  roseBg:        '#FBF1EE',
  amber:         '#9A6B1E',
  amberBg:       '#F6ECD8',
  green:         '#3F7A5B',
  greenBg:       '#EAF1EC',
  red:           '#C0392B',
  redBg:         '#FDF0EE',
} as const;

export const STAGE_LABELS: Record<string, string> = {
  intake:         'Intake',
  documentation:  'Documentation',
  filing:         'Filing',
  hearing:        'Hearing',
  judgment:       'Judgment',
  closed:         'Closed',
};

export const STAGE_ORDER = ['intake', 'documentation', 'filing', 'hearing', 'judgment', 'closed'];
