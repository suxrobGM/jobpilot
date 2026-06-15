export const surfaces = {
  base: "#161615",
  card: "#1F1F1E",
  elevated: "#2C2C2A",
  hover: "#363633",
} as const;

export const accent = {
  primary: "#D9573A",
  secondary: "#BF4A30",
  dark: "#A33E26",
} as const;

export const textColors = {
  primary: "#EEEAE0",
  secondary: "#A8A49D",
  disabled: "#646169",
} as const;

export const feedback = {
  error: "#D86F5A",
  success: "#8FA08F",
  info: "#7FA0B8",
  warning: "#D9A85C",
} as const;

export const line = {
  divider: "#363634",
  border: "#42423F",
  borderHi: "#54544F",
} as const;

export const stages = {
  queued: "#C9A876",
  applying: "#D9573A",
  submitted: "#8FA08F",
  interviewing: "#D9A85C",
  rejected: "#D86F5A",
} as const;

export const editorial = {
  paper: "#EEEAE0",
  ink: "#161615",
  sage: "#8FA08F",
  ember: "#D9573A",
  gold: "#D9A85C",
} as const;

export type StageKey = keyof typeof stages;
