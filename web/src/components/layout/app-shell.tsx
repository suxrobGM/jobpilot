"use client";

import { Box } from "@mui/material";
import type { PropsWithChildren, ReactElement } from "react";
import { Sidebar } from "./sidebar";

export function AppShell(props: PropsWithChildren): ReactElement {
  const { children } = props;
  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <Box component="main" sx={{ flex: 1, minWidth: 0 }}>
        {children}
      </Box>
    </Box>
  );
}
