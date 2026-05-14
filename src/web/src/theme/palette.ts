export const surfaces = {
  base: "#07090F",
  card: "#111726",
  elevated: "#161D2E",
  hover: "#1B2438",
} as const;

export const accent = {
  primary: "#A78BFA",
  secondary: "#8B6FE8",
  dark: "#7C5CFF",
} as const;

export const textColors = {
  primary: "#E9EDF5",
  secondary: "#94A3C5",
  disabled: "#5D6886",
} as const;

export const feedback = {
  error: "#F87171",
  success: "#6FBC8E",
  info: "#5DA8E0",
  warning: "#FBBF24",
} as const;

export const line = {
  divider: "#1E2638",
  border: "#26303F",
  borderHi: "#2A3550",
} as const;

export const stages = {
  discovered: "#6478D8",
  queued: "#5DA8E0",
  applying: "#A78BFA",
  submitted: "#6FBC8E",
  replied: "#F5C2A4",
  rejected: "#F87171",
} as const;

export type StageKey = keyof typeof stages;
