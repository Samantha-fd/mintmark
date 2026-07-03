export type ThemeColors = {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  border: string;
  danger: string;
  checkerLight: string;
  checkerDark: string;
};

export const Palette: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    background: '#FAF7F2',
    surface: '#FFFFFF',
    text: '#2B2620',
    textMuted: '#8A8177',
    accent: '#C4704F',
    onAccent: '#FFFFFF',
    accentSoft: '#F3E2D9',
    border: '#E8E1D8',
    danger: '#C0392B',
    checkerLight: '#EDE8E0',
    checkerDark: '#DDD6CB',
  },
  dark: {
    background: '#17140F',
    surface: '#221E18',
    text: '#F1EAE1',
    textMuted: '#9C9287',
    accent: '#D98A66',
    onAccent: '#1B120C',
    accentSoft: '#3A2C24',
    border: '#332D25',
    danger: '#E07060',
    checkerLight: '#2C2723',
    checkerDark: '#3A342B',
  },
};
