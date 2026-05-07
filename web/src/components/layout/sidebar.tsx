"use client";

import { Box, Stack, Typography } from "@mui/material";
import type { ReactElement } from "react";
import { NavGroup } from "./nav-group";
import { APP_TITLE, SIDEBAR_WIDTH, navGroups } from "./shell-config";

export function Sidebar(): ReactElement {
  return (
    <Box
      component="aside"
      sx={(t) => ({
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        borderRight: `1px solid ${t.palette.line.divider}`,
        backgroundColor: t.palette.surfaces.card,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
      })}
    >
      <Stack
        direction="row"
        sx={{ p: 2, pb: 1, alignItems: "center", gap: 1 }}
      >
        <Box
          sx={(t) => ({
            width: 28,
            height: 28,
            borderRadius: t.radii.sm,
            background: t.gradients.primary,
          })}
        />
        <Typography variant="h4" sx={{ fontSize: "1.05rem", fontWeight: 700 }}>
          {APP_TITLE}
        </Typography>
      </Stack>
      <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        {navGroups.map((group, idx) => (
          <NavGroup key={group.label ?? idx} group={group} />
        ))}
      </Box>
      <Box
        sx={(t) => ({
          p: 2,
          borderTop: `1px solid ${t.palette.line.divider}`,
        })}
      >
        <Typography variant="captionMuted">
          Local · 127.0.0.1:8000
        </Typography>
      </Box>
    </Box>
  );
}
