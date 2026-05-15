export const gradients = {
  primary: "linear-gradient(135deg, #A78BFA, #7C5CFF)",
  reversed: "linear-gradient(135deg, #7C5CFF, #A78BFA)",
  orb: "conic-gradient(from 220deg, #A78BFA, #D4E157, #F5C2A4, #A78BFA)",
} as const;

export const motion = {
  fast: "160ms cubic-bezier(0.3,0.7,0.2,1)",
  standard: "240ms cubic-bezier(0.2,0.8,0.2,1)",
  expressive: "320ms cubic-bezier(0.2,0.8,0.2,1)",
} as const;

export const shadows = {
  sm: "none",
  md: "0 4px 12px rgba(0,0,0,0.35)",
  lg: "0 14px 28px -8px rgba(0,0,0,0.5)",
  focus: "0 0 0 2px rgba(167,139,250,0.4)",
} as const;

export const radii = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const iconSizes = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
  xxl: 28,
  "2xxl": 32,
} as const;

export type IconSizeToken = keyof typeof iconSizes;
