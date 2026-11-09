"use client";

import type { ReactElement } from "react";
import { Box, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sideNavLink } from "./side-nav-link";

export interface SideNavGroup {
  label: string;
  links: { label: string; href: Route }[];
}

interface SideNavProps {
  /** Names the nav for screen readers. */
  label: string;
  groups: SideNavGroup[];
  /** From md the column sticks this far down; omit when the caller pins it. */
  stickyTop?: string;
}

/** Grouped page links: a column beside the page from md, one scrolling row above it on phones. */
export function SideNav(props: SideNavProps): ReactElement {
  const { label, groups, stickyTop } = props;
  const pathname = usePathname();

  return (
    <Box
      component="nav"
      aria-label={label}
      sx={{
        flexShrink: 0,
        width: { xs: "100%", md: 200 },
        position: { md: stickyTop ? "sticky" : "static" },
        top: { md: stickyTop },
        overflowX: { xs: "auto", md: "visible" },
        scrollbarWidth: "none",
      }}
    >
      <Stack direction={{ xs: "row", md: "column" }} spacing={{ xs: 0.5, md: 2.5 }}>
        {groups.map((group) => (
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
            {group.links.map((link) => {
              const active = pathname === link.href;
              return (
                <Box
                  key={link.href}
                  component={Link}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  sx={(theme) => ({
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                    height: 34,
                    paddingInline: 1,
                    whiteSpace: "nowrap",
                    typography: "body2",
                    ...sideNavLink(theme, active),
                  })}
                >
                  {link.label}
                </Box>
              );
            })}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
