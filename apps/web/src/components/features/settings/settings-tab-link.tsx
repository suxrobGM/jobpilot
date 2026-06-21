"use client";

import type { ReactElement } from "react";
import { Box } from "@mui/material";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SettingsTabLinkProps {
  href: Route;
  label: string;
}

/** The one interactive leaf of the settings tab bar: highlights the active route. */
export function SettingsTabLink(props: SettingsTabLinkProps): ReactElement {
  const { href, label } = props;
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Box
      component={Link}
      href={href}
      aria-current={active ? "page" : undefined}
      sx={(theme) => ({
        display: "inline-flex",
        alignItems: "center",
        minHeight: 38,
        px: 1.5,
        fontSize: "0.875rem",
        fontWeight: 500,
        textDecoration: "none",
        color: active ? "accent.primary" : "text.secondary",
        borderBottom: `2px solid ${active ? theme.palette.accent.primary : "transparent"}`,
        marginBottom: "-1px", // overlap the strip's divider so the indicator sits on it
        transition: `color ${theme.motion.fast}, border-color ${theme.motion.fast}`,
        "&:hover": { color: active ? "accent.primary" : "text.primary" },
        "&:focus-visible": { outline: theme.shadows_custom.focus, outlineOffset: -2 },
      })}
    >
      {label}
    </Box>
  );
}
