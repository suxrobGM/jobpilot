export const gradients = {
  primary: "linear-gradient(135deg, #4F46E5, #6366F1)",
  reversed: "linear-gradient(135deg, #6366F1, #4F46E5)",
} as const;

export const motion = {
  fast: "160ms cubic-bezier(0.3,0.7,0.2,1)",
  standard: "240ms cubic-bezier(0.2,0.8,0.2,1)",
  expressive: "320ms cubic-bezier(0.2,0.8,0.2,1)",
} as const;

export const shadows = {
  sm: "0 1px 2px rgba(15,23,42,0.05)",
  md: "0 1px 3px rgba(15,23,42,0.06), 0 6px 16px rgba(15,23,42,0.04)",
  lg: "0 2px 8px rgba(15,23,42,0.08), 0 16px 40px rgba(15,23,42,0.06)",
  focus: "0 0 0 3px rgba(79,70,229,0.18)",
} as const;

export const radii = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const iconSizes = {
  xs: 16,
  sm: 20,
  md: 24,
} as const;
