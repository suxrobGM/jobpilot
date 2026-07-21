"use client";

import type { ReactElement } from "react";
import { Box, Link, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { DocsMobileNav } from "./docs-mobile-nav";
import { DOCS_NAV } from "./docs-nav";

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
      sx={{
        display: "block",
        whiteSpace: "nowrap",
        fontSize: "0.8125rem",
        paddingBlock: 0.75,
        paddingInline: 1.5,
        color: active ? "text.primary" : "text.secondary",
        fontWeight: active ? 600 : 400,
        borderLeft: 2,
        borderLeftColor: active ? "accent.primary" : "line.divider",
        "&:hover": { color: "text.primary" },
      }}
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
          <SidebarLink href="/docs" label="Overview" active={pathname === "/docs"} />
          {DOCS_NAV.map((entry) => (
            <SidebarLink
              key={entry.href}
              href={entry.href}
              label={entry.title}
              active={pathname === entry.href}
            />
          ))}
        </Stack>
      </Box>
    </>
  );
}
