"use client";

import { Fragment, type ReactElement, Suspense } from "react";
import { Box, Divider, Stack } from "@mui/material";
import NextLink from "next/link";
import { JobPilotMark } from "@/components/brand/jobpilot-mark";
import { useSession } from "@/hooks/use-auth";
import { AccountMenu } from "./account-menu";
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
        borderRight: 1,
        borderColor: "divider",
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
          filter: theme.shadows_custom.markGlow,
          "&:hover": {
            transform: "translateY(-1px)",
            filter: theme.shadows_custom.markGlowHover,
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
