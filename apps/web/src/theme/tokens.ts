export const gradients = {
  primary: "linear-gradient(135deg, #D9573A, #A33E26)",
  reversed: "linear-gradient(135deg, #A33E26, #D9573A)",
  orb: "conic-gradient(from 200deg, #D9573A, #D9A85C, #8FA08F, #D9573A)",
} as const;

export const motion = {
  fast: "160ms cubic-bezier(0.3,0.7,0.2,1)",
  standard: "240ms cubic-bezier(0.2,0.8,0.2,1)",
  expressive: "320ms cubic-bezier(0.2,0.8,0.2,1)",
} as const;

export const shadows = {
  sm: "none",
  md: "0 4px 14px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.04)",
  lg: "0 18px 36px -10px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.05)",
  focus: "0 0 0 2px rgba(217, 87, 58, 0.45)",
} as const;

export const radii = {
  xs: 2,
  sm: 3,
  md: 6,
  lg: 10,
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
