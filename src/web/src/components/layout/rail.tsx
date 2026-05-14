"use client";

import { Suspense, type ReactElement } from "react";
import { Box, Stack } from "@mui/material";
import { NavGroup } from "./nav-group";
import { APP_SIGIL, APP_TITLE, navGroups, RAIL_WIDTH } from "./shell-config";

export function Rail(): ReactElement {
  return (
    <Stack
      component="aside"
      aria-label={APP_TITLE}
      spacing={1.5}
      sx={(theme) => ({
        alignItems: "center",
        width: RAIL_WIDTH,
        flexShrink: 0,
        height: "100%",
        paddingBlock: theme.spacing(1.5),
        borderRight: `1px solid ${theme.palette.line.divider}`,
        backgroundColor: theme.palette.surfaces.base,
      })}
    >
      <Box
        aria-label={`${APP_TITLE} home`}
        sx={(theme) => ({
          width: 34,
          height: 34,
          borderRadius: theme.radii.sm,
          background: theme.gradients.orb,
          display: "grid",
          placeItems: "center",
          color: theme.palette.surfaces.base,
          fontFamily: "var(--font-geist-mono), monospace",
          fontWeight: 600,
          fontSize: 16,
          boxShadow: `0 0 18px ${theme.palette.accent.primary}40`,
        })}
      >
        {APP_SIGIL}
      </Box>
      <Box sx={{ flex: 1, width: "100%" }}>
        <Suspense fallback={null}>
          {navGroups.map((group, idx) => (
            <NavGroup key={group.label ?? idx} group={group} />
          ))}
        </Suspense>
      </Box>
    </Stack>
  );
}
