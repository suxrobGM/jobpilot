"use client";

import { Suspense, type ReactElement } from "react";
import { Box, Stack } from "@mui/material";
import NextLink from "next/link";
import { AccountMenu } from "@/components/features/profile";
import { fontFamilies } from "@/theme";
import { NavGroup } from "./nav-group";
import { APP_TITLE, navGroups, RAIL_WIDTH } from "./shell-config";

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
        component={NextLink}
        href="/"
        aria-label={`${APP_TITLE} home`}
        sx={(theme) => ({
          position: "relative",
          width: 36,
          height: 36,
          borderRadius: theme.radii.sm,
          background: theme.gradients.reversed,
          border: `1px solid ${theme.palette.accent.primary}`,
          display: "grid",
          placeItems: "center",
          textDecoration: "none",
          overflow: "hidden",
          transition: theme.motion.standard,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.25), 0 2px 8px rgba(0,0,0,0.4), 0 0 16px rgba(21,217,138,0.25)",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.4) 0%, transparent 55%)",
            opacity: 0.8,
            transition: theme.motion.standard,
          },
          "&:hover": {
            transform: "translateY(-1px)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 18px rgba(0,0,0,0.5), 0 0 26px rgba(21,217,138,0.5)",
            "&::before": { opacity: 1 },
          },
          "&:focus-visible": { boxShadow: theme.shadows_custom.focus },
        })}
      >
        <Box
          component="span"
          sx={{
            position: "relative",
            zIndex: 1,
            fontFamily: fontFamilies.display,
            fontWeight: 700,
            fontSize: 20,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            // Shorthand, not theme.palette.primary.contrastText (cssVariables SSR/client hash drift).
            color: "primary.contrastText",
          }}
        >
          J
        </Box>
      </Box>
      <Box sx={{ flex: 1, width: "100%" }}>
        <Suspense fallback={null}>
          {navGroups.map((group, idx) => (
            <NavGroup key={group.label ?? idx} group={group} />
          ))}
        </Suspense>
      </Box>
      <AccountMenu />
    </Stack>
  );
}
