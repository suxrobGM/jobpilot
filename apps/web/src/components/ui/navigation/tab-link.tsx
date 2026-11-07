"use client";

import type { ReactElement } from "react";
import { Box } from "@mui/material";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface TabLinkProps {
  href: Route;
  label: string;
}

/** The one interactive leaf of a tab strip: highlights the active route. */
export function TabLink(props: TabLinkProps): ReactElement {
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
        flexShrink: 0,
        minHeight: 44,
        px: 2,
        fontSize: theme.typography.body1.fontSize,
        fontWeight: 500,
        textDecoration: "none",
        color: active ? "text.primary" : "text.secondary",
        borderBottom: `2px solid ${active ? theme.palette.accent.primary : "transparent"}`,
        transition: `color ${theme.motion.fast}, border-color ${theme.motion.fast}`,
        "&:hover": { color: "text.primary" },
        "&:focus-visible": { outline: theme.shadows_custom.focus, outlineOffset: -2 },
      })}
    >
      {label}
    </Box>
  );
}
