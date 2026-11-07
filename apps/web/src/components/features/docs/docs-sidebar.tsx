"use client";

import type { ReactElement } from "react";
import { Box, Link, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { DocsMobileNav } from "./docs-mobile-nav";
import { DOCS_LINKS } from "./docs-nav";

interface SidebarLinkProps {
  href: Route;
  label: string;
  active: boolean;
}

function SidebarLink(props: SidebarLinkProps): ReactElement {
  const { href, label, active } = props;
  return (
    <Link
      href={href}
      underline="none"
      aria-current={active ? "page" : undefined}
      sx={(theme) => ({
        display: "block",
        whiteSpace: "nowrap",
        ...(active ? theme.typography.body1Strong : theme.typography.body1),
        paddingBlock: 0.75,
        paddingInline: 1.5,
        borderRadius: theme.radii.sm,
        color: active ? "text.primary" : "text.secondary",
        backgroundColor: active ? theme.palette.surfaces.elevated : "transparent",
        "&:hover": { color: "text.primary" },
      })}
    >
      {label}
    </Link>
  );
}

/** Docs navigation: sticky vertical rail on md+, collapsible section navigator on xs-sm. */
export function DocsSidebar(): ReactElement {
  const pathname = usePathname();
  return (
    <>
      <DocsMobileNav />
      <Box component="nav" aria-label="Documentation" sx={{ display: { xs: "none", md: "block" } }}>
        <Typography variant="overlineMuted" sx={{ display: "block", mb: 1.5 }}>
          Docs
        </Typography>
        <Stack spacing={0}>
          {DOCS_LINKS.map((link) => (
            <SidebarLink
              key={link.href}
              href={link.href}
              label={link.label}
              active={pathname === link.href}
            />
          ))}
        </Stack>
      </Box>
    </>
  );
}
