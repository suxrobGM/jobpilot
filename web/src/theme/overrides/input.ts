import type { Components, Theme } from "@mui/material/styles";

export const textFieldOverrides: Components<Theme>["MuiTextField"] = {
  defaultProps: { variant: "outlined", fullWidth: true, size: "small" },
};

export const outlinedInputOverrides: Components<Theme>["MuiOutlinedInput"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      borderRadius: theme.radii.sm,
      backgroundColor: theme.palette.surfaces.card,
      transition: theme.motion.fast,
      "& fieldset": { borderColor: theme.palette.line.border },
      "&:hover fieldset": { borderColor: `${theme.palette.line.borderHi} !important` },
      "&.Mui-focused fieldset": { borderColor: `${theme.palette.accent.primary} !important`, borderWidth: 1 },
      "&.Mui-focused": { boxShadow: theme.shadows_custom.focus },
    }),
    input: { fontSize: "0.875rem" },
  },
};

export const inputLabelOverrides: Components<Theme>["MuiInputLabel"] = {
  styleOverrides: { root: { fontSize: "0.875rem" } },
};

export const formHelperTextOverrides: Components<Theme>["MuiFormHelperText"] = {
  styleOverrides: { root: { marginInline: 0, fontSize: "0.75rem" } },
};

export const selectOverrides: Components<Theme>["MuiSelect"] = {
  defaultProps: { size: "small" },
};
