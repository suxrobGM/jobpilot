import type { Components, Theme } from "@mui/material/styles";

export const textFieldOverrides: Components<Theme>["MuiTextField"] = {
  defaultProps: { variant: "outlined", size: "small" },
};

export const inputBaseOverrides: Components<Theme>["MuiInputBase"] = {
  styleOverrides: {
    // iOS Safari zooms the page into any field under 16px on focus.
    root: ({ theme }) => ({ [theme.breakpoints.down("sm")]: { fontSize: "1rem" } }),
  },
};

export const outlinedInputOverrides: Components<Theme>["MuiOutlinedInput"] = {
  styleOverrides: {
    // Pinned to the shared control height so a text field and the button beside it are the same box.
    sizeSmall: ({ theme }) => ({ minHeight: theme.controlHeights.md }),
    root: ({ theme }) => ({
      borderRadius: theme.radii.md,
      backgroundColor: theme.palette.surfaces.base,
      transition: theme.motion.fast,
      "& fieldset": { borderColor: theme.palette.line.border },
      "&:hover fieldset": { borderColor: `${theme.palette.line.borderHi} !important` },
      // Focus keeps MUI's 2px border, not a box-shadow ring: the ring has no notch and strikes through the floating label.
      "&.Mui-focused fieldset": { borderColor: `${theme.palette.accent.primary} !important` },
      "& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus, & input:-webkit-autofill:active":
        {
          WebkitBoxShadow: `0 0 0 1000px ${theme.palette.surfaces.base} inset`,
          WebkitTextFillColor: (theme.vars ?? theme).palette.text.primary,
          caretColor: (theme.vars ?? theme).palette.text.primary,
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
