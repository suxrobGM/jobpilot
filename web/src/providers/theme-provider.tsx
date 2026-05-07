"use client";

import { CssBaseline, ThemeProvider as MuiThemeProvider } from "@mui/material";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import type { PropsWithChildren, ReactElement } from "react";
import { theme } from "@/theme";

export function ThemeProvider(props: PropsWithChildren): ReactElement {
  const { children } = props;
  return (
    <AppRouterCacheProvider options={{ key: "mui", enableCssLayer: true }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </AppRouterCacheProvider>
  );
}
