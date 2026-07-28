/**
 * Brand / design system — tmavý Material směr z UI návrhů.
 * Group eventy: magenta/růžová (odlišení od osobních barev lidí).
 */
export const Brand = {
  primary: '#4175E1',
  primaryMuted: '#8AB4F8',
  primarySoft: 'rgba(65, 117, 225, 0.18)',
  onPrimary: '#FFFFFF',
  danger: '#E53935',
  success: '#2E7D32',
  warning: '#F9A825',
  /** Group / shared events */
  groupEvent: '#FF00AA',
  groupEventBorder: '#FF9AD8',
} as const;

export const BrandSurfaces = {
  light: {
    background: '#F2F2F7',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    border: '#E5E5EA',
    text: '#11181C',
    textSecondary: '#687076',
  },
  dark: {
    background: '#121416',
    surface: '#1C1C1E',
    surfaceElevated: '#2C2C2E',
    border: '#3A3A3C',
    text: '#ECEDEE',
    textSecondary: '#9BA1A6',
  },
} as const;
