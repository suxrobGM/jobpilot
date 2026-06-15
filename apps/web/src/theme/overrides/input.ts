import type { Components, Theme } from "@mui/material/styles";

export const textFieldOverrides: Components<Theme>["MuiTextField"] = {
  defaultProps: { variant: "outlined", size: "small" },
};

export const outlinedInputOverrides: Components<Theme>["MuiOutlinedInput"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      borderRadius: theme.radii.sm,
      backgroundColor: theme.palette.surfaces.base,
      transition: theme.motion.fast,
      "& fieldset": { borderColor: theme.palette.line.border },
      "&:hover fieldset": { borderColor: `${theme.palette.line.borderHi} !important` },
      "&.Mui-focused fieldset": {
        borderColor: `${theme.palette.accent.primary} !important`,
        borderWidth: 1,
      },
      "&.Mui-focused": { boxShadow: theme.shadows_custom.focus },
      "& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus, & input:-webkit-autofill:active":
        {
          WebkitBoxShadow: `0 0 0 1000px ${theme.palette.surfaces.base} inset`,
          WebkitTextFillColor: theme.palette.text.primary,
          caretColor: theme.palette.text.primary,
          borderRadius: "inherit",
          transition: "background-color 5000s ease-in-out 0s",
        },
    }),
  },
};

export const formHelperTextOverrides: Components<Theme>["MuiFormHelperText"] = {
  styleOverrides: { root: { marginInline: 0, fontSize: "0.75rem" } },
};

export const selectOverrides: Components<Theme>["MuiSelect"] = {
  defaultProps: { size: "small" },
};
