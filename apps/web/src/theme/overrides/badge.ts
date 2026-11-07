import type { Components, Theme } from "@mui/material/styles";

/** Every badge in the app is an attention count on a nav icon; zero renders nothing. */
export const badgeOverrides: Components<Theme>["MuiBadge"] = {
  defaultProps: { overlap: "circular", max: 99 },
  styleOverrides: {
    // The action orange, as on the main button and count chips; red read as an error.
    badge: ({ theme }) => ({
      backgroundColor: theme.palette.accent.action,
      color: theme.palette.common.white,
      fontWeight: 600,
      // Smaller than MUI's 20px: a count beside a 20px icon shouldn't outweigh it.
      height: 16,
      minWidth: 16,
      padding: "0 4px",
      fontSize: "0.625rem",
    }),
  },
};
