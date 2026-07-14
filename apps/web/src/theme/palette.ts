// Warm-carbon ladder: near-black with a whisper of warmth - low saturation so
// large surfaces stay carbon, never brown.
export const surfaces = {
  base: "#0B0B0A",
  card: "#151413",
  elevated: "#201E1B",
  hover: "#2B2925",
} as const;

// Brand ramp: flame (primary/dark) + thrust blue (secondary) - the Afterburner duotone.
// Green is reserved for go/success - see `feedback.success` / `stages.submitted`.
export const accent = {
  primary: "#FF6A3D",
  secondary: "#3B82F6",
  dark: "#D9532A",
} as const;

export const textColors = {
  primary: "#F4F2EE",
  secondary: "#A7A49D",
  disabled: "#6C6860",
} as const;

export const feedback = {
  error: "#E5484D",
  success: "#16D98A",
  info: "#3B82F6",
  warning: "#FFB020",
} as const;

export const line = {
  divider: "#21201C",
  border: "#38342E",
  borderHi: "#4A463F",
} as const;

export const stages = {
  queued: "#8A93A0",
  applying: accent.secondary,
  submitted: feedback.success,
  interviewing: feedback.warning,
  rejected: feedback.error,
} as const;

export const editorial = {
  paper: textColors.primary,
  ink: surfaces.base,
  thrust: accent.secondary,
  flame: accent.primary,
  amber: feedback.warning,
} as const;

export type StageKey = keyof typeof stages;
