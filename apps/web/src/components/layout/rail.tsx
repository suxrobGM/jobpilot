"use client";

import { Fragment, type ReactElement, Suspense } from "react";
import { alpha, Box, Divider, Stack } from "@mui/material";
import NextLink from "next/link";
import { JobPilotMark } from "@/components/brand/jobpilot-mark";
import { AccountMenu } from "@/components/features/profile/account-menu";
import { useSession } from "@/hooks/use-auth";
import { FeedbackMenu } from "./feedback-menu";
import { NavGroup } from "./nav-group";
import { APP_TITLE, footerNavGroups, RAIL_WIDTH, visibleNavGroups } from "./shell-config";

export function Rail(): ReactElement {
  const { user } = useSession();
  const groups = visibleNavGroups(user?.role);
  const footerGroups = visibleNavGroups(user?.role, footerNavGroups);

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
        href="/workspace"
        aria-label={`${APP_TITLE} home`}
        sx={(theme) => ({
          display: "grid",
          placeItems: "center",
          textDecoration: "none",
          borderRadius: theme.radii.sm,
          transition: theme.motion.standard,
          filter: `drop-shadow(0 2px 8px rgba(0,0,0,0.4)) drop-shadow(0 0 12px ${alpha(theme.palette.accent.primary, 0.22)})`,
          "&:hover": {
            transform: "translateY(-1px)",
            filter: `drop-shadow(0 6px 18px rgba(0,0,0,0.5)) drop-shadow(0 0 20px ${alpha(theme.palette.accent.primary, 0.45)})`,
          },
          "&:focus-visible": { outline: "none", boxShadow: theme.shadows_custom.focus },
        })}
      >
        <JobPilotMark size={36} />
      </Box>
      <Box sx={{ flex: 1, width: "100%" }}>
        <Suspense fallback={null}>
          {groups.map((group, idx) => (
            <Fragment key={group.label ?? idx}>
              {idx > 0 && <Divider flexItem sx={{ mx: 1.5, my: 0.75 }} />}
              <NavGroup group={group} />
            </Fragment>
          ))}
        </Suspense>
      </Box>
      {footerGroups.length > 0 && (
        <>
          <Divider flexItem sx={{ mx: 1.5 }} />
          <Suspense fallback={null}>
            {footerGroups.map((group, idx) => (
              <NavGroup key={group.label ?? idx} group={group} />
            ))}
          </Suspense>
        </>
      )}
      <FeedbackMenu />
      <AccountMenu />
    </Stack>
  );
}
