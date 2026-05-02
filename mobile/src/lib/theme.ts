export const colors = {
  primary: '#01696f',
  primaryHover: '#0c4e54',
  primaryHighlight: '#cedcd8',
  bg: '#f7f6f2',
  surface: '#ffffff',
  surfaceOffset: '#f3f0ec',
  border: '#d4d1ca',
  divider: '#e8e5e0',
  text: '#28251d',
  textMuted: '#7a7974',
  textFaint: '#bab9b4',
  textInverse: '#f9f8f4',
  success: '#437a22',
  successBg: '#d4dfcc',
  warning: '#964219',
  warningBg: '#ddcfc6',
  error: '#a12c7b',
  errorBg: '#e0ced7',
  status: {
    DELIVERED: { bg: '#d4dfcc', text: '#2e5c10' },
    SHIPPED: { bg: '#dacfde', text: '#5e2099' },
    PAID: { bg: '#c6d8e4', text: '#0b3751' },
    PENDING: { bg: '#e9e0c6', text: '#8a5b00' },
    CANCELLED: { bg: '#e0ced7', text: '#561740' },
  },
} as const;

export const spacing = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;
export const radius = { sm: 6, md: 10, lg: 14, xl: 20, '2xl': 28, full: 9999 } as const;
export const font = {
  family: 'System',
  size: { xs: 12, sm: 14, base: 16, lg: 18, xl: 22, '2xl': 28 },
  weight: { regular: '400' as const, medium: '500' as const, semibold: '600' as const, bold: '700' as const },
} as const;
export const shadow = {
  sm: { shadowColor: '#28251d', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  md: { shadowColor: '#28251d', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 12, elevation: 4 },
  lg: { shadowColor: '#28251d', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.13, shadowRadius: 24, elevation: 8 },
} as const;
