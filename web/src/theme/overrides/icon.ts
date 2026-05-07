import type { Components, Theme } from "@mui/material/styles";

export const svgIconOverrides: Components<Theme>["MuiSvgIcon"] = {
  styleOverrides: {
    root: ({ ownerState }) => ({
      ...(ownerState.fontSize === "xs" && { fontSize: "0.875rem" }),
      ...(ownerState.fontSize === "sm" && { fontSize: "1rem" }),
      ...(ownerState.fontSize === "md" && { fontSize: "1.125rem" }),
      ...(ownerState.fontSize === "lg" && { fontSize: "1.25rem" }),
      ...(ownerState.fontSize === "xl" && { fontSize: "1.5rem" }),
      ...(ownerState.fontSize === "xxl" && { fontSize: "1.75rem" }),
      ...(ownerState.fontSize === "2xxl" && { fontSize: "2rem" }),
    }),
  },
};
