"use client";

import type { ReactElement } from "react";
import { Box, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SettingsLink {
  label: string;
  href: Route;
}

interface SettingsGroup {
  label: string;
  links: SettingsLink[];
}

const GROUPS: SettingsGroup[] = [
  {
    label: "You",
    links: [{ label: "Profile", href: "/settings/profile" }],
  },
  {
    label: "Pilot",
    links: [
      { label: "Behavior", href: "/settings/pilot" },
      { label: "Logins", href: "/settings/credentials" },
      { label: "Notifications", href: "/settings/notifications" },
    ],
  },
  {
    label: "Account",
    links: [
      { label: "Email", href: "/settings/email" },
      { label: "Security", href: "/settings/security" },
    ],
  },
  {
    label: "Advanced",
    links: [{ label: "Diagnostics", href: "/settings/diagnostics" }],
  },
];

/** Grouped settings pages: a sticky column beside the page, a scrolling row on phones. */
export function SettingsNav(): ReactElement {
  const pathname = usePathname();

  return (
    <Box
      component="nav"
      aria-label="Settings sections"
      sx={(theme) => ({
        flexShrink: 0,
        width: { xs: "100%", md: 200 },
        position: { md: "sticky" },
        top: { md: theme.spacing(3) },
        overflowX: { xs: "auto", md: "visible" },
      })}
    >
      <Stack direction={{ xs: "row", md: "column" }} spacing={{ xs: 0.5, md: 2.5 }}>
        {GROUPS.map((group) => (
          <Stack
            key={group.label}
            role="group"
            aria-label={group.label}
            direction={{ xs: "row", md: "column" }}
            spacing={0.25}
          >
            <Typography
              variant="overlineMuted"
              sx={{ display: { xs: "none", md: "block" }, px: 1, pb: 0.5 }}
            >
              {group.label}
            </Typography>
            {group.links.map((link) => (
              <SettingsNavLink key={link.href} link={link} active={pathname === link.href} />
            ))}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

interface SettingsNavLinkProps {
  link: SettingsLink;
  active: boolean;
}

function SettingsNavLink(props: SettingsNavLinkProps): ReactElement {
  const { link, active } = props;
  return (
    <Box
      component={Link}
      href={link.href}
      aria-current={active ? "page" : undefined}
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        height: 34,
        paddingInline: 1,
        borderRadius: theme.radii.sm,
        whiteSpace: "nowrap",
        typography: "body2",
        color: active ? "text.primary" : "text.secondary",
        backgroundColor: active ? theme.palette.surfaces.elevated : "transparent",
        boxShadow: active ? `inset 2px 0 0 ${theme.palette.accent.primary}` : "none",
        textDecoration: "none",
        transition: theme.motion.fast,
        "&:hover": {
          color: "text.primary",
          backgroundColor: active ? theme.palette.surfaces.elevated : theme.palette.surfaces.card,
        },
        "&:focus-visible": { outline: "none", boxShadow: theme.shadows_custom.focus },
      })}
    >
      {link.label}
    </Box>
  );
}
