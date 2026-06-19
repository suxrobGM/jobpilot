export const surfaces = {
  base: "#0F1418",
  card: "#161C21",
  elevated: "#1E262C",
  hover: "#28323A",
} as const;

export const accent = {
  primary: "#15D98A",
  secondary: "#0FB877",
  dark: "#0C9A63",
} as const;

export const textColors = {
  primary: "#ECF2EE",
  secondary: "#97A6A0",
  disabled: "#5A6660",
} as const;

export const feedback = {
  error: "#FB5E52",
  success: "#15D98A",
  info: "#38BDF8",
  warning: "#F5B23B",
} as const;

export const line = {
  divider: "#222A30",
  border: "#2C363D",
  borderHi: "#3C4951",
} as const;

export const stages = {
  queued: "#8593A0",
  applying: "#B6F03C",
  submitted: "#15D98A",
  interviewing: "#F5B23B",
  rejected: "#FB5E52",
} as const;

export const editorial = {
  paper: "#ECF2EE",
  ink: "#0F1418",
  sage: "#38BDF8",
  ember: "#15D98A",
  gold: "#B6F03C",
} as const;

export type StageKey = keyof typeof stages;
