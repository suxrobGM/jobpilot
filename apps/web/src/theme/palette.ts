export const surfaces = {
  base: "#0B1016",
  card: "#15191F",
  elevated: "#1D232B",
  hover: "#28313B",
} as const;

// Brand ramp: flame (primary/dark) + thrust blue (secondary) — the Afterburner duotone.
// Green is reserved for go/success — see `feedback.success` / `stages.submitted`.
export const accent = {
  primary: "#FF6A3D",
  secondary: "#3B82F6",
  dark: "#D9532A",
} as const;

export const textColors = {
  primary: "#F1F0EE",
  secondary: "#9AA0A6",
  disabled: "#5C636B",
} as const;

export const feedback = {
  error: "#E5484D",
  success: "#16D98A",
  info: "#3B82F6",
  warning: "#FFB020",
} as const;

export const line = {
  divider: "#1E242B",
  border: "#2A323B",
  borderHi: "#3A444F",
} as const;

export const stages = {
  queued: "#8A93A0",
  applying: "#3B82F6",
  submitted: "#16D98A",
  interviewing: "#FFB020",
  rejected: "#E5484D",
} as const;

export const editorial = {
  paper: "#F1F0EE",
  ink: "#0B1016",
  thrust: "#3B82F6",
  flame: "#FF6A3D",
  amber: "#FFB020",
} as const;

export type StageKey = keyof typeof stages;
