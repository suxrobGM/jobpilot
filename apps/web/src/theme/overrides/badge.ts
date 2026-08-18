import type { Components, Theme } from "@mui/material/styles";

/** Every badge in the app is an attention count on a nav icon; zero renders nothing. */
export const badgeOverrides: Components<Theme>["MuiBadge"] = {
  defaultProps: { color: "error", overlap: "circular", max: 99 },
};
