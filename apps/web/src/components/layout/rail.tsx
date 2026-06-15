"use client";

import { Suspense, type ReactElement } from "react";
import { Box, Stack } from "@mui/material";
import NextLink from "next/link";
import { ProfileSwitcher } from "@/components/features/profile";
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
          background: `linear-gradient(155deg, ${theme.palette.surfaces.elevated} 0%, ${theme.palette.surfaces.card} 60%, ${theme.palette.surfaces.base} 100%)`,
          border: `1px solid ${theme.palette.line.borderHi}`,
          display: "grid",
          placeItems: "center",
          textDecoration: "none",
          overflow: "hidden",
          transition: theme.motion.standard,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 6px rgba(0,0,0,0.4)",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 80% 100%, ${theme.palette.accent.primary}40 0%, transparent 60%)`,
            opacity: 0.9,
            transition: theme.motion.standard,
          },
          "&:hover": {
            borderColor: `${theme.palette.accent.primary}99`,
            transform: "translateY(-1px)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 18px rgba(0,0,0,0.5), 0 0 22px rgba(217,87,58,0.35)",
            "&::before": { opacity: 1 },
          },
          "&:focus-visible": { boxShadow: theme.shadows_custom.focus },
        })}
      >
        <Box
          component="span"
          sx={(theme) => ({
            position: "relative",
            zIndex: 1,
            fontFamily: 'var(--font-fraunces), "Iowan Old Style", Georgia, serif',
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: 22,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: theme.palette.text.primary,
            transform: "translate(-1px, 1px)",
            textShadow: `0 1px 0 rgba(0,0,0,0.4)`,
          })}
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
      <ProfileSwitcher />
    </Stack>
  );
}
