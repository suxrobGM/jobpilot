"use client";

import { type ReactElement, useState } from "react";
import { Menu as MenuIcon } from "@mui/icons-material";
import { Box, Container, Drawer, IconButton, Link, Stack } from "@mui/material";
import type { Route } from "next";
import { LinkButton } from "@/components/ui/buttons";
import { BrandMark } from "./brand-mark";
import { MARKETING_NAV_HEIGHT, marketingLinkSx } from "./marketing-link-sx";

interface NavLink {
  href: Route;
  label: string;
  external?: boolean;
}

/** `/#how-it-works`, not `#how-it-works`: from /jobs or /docs the bare hash points at nothing. */
const NAV_LINKS: NavLink[] = [
  { href: "/jobs" as Route, label: "Jobs" },
  { href: "/leaderboard" as Route, label: "Leaderboard" },
  { href: "/docs" as Route, label: "Docs" },
  { href: "/#how-it-works" as Route, label: "How it works" },
  { href: "https://github.com/suxrobGM/jobpilot" as Route, label: "GitHub", external: true },
];

const EXTERNAL_PROPS = { target: "_blank", rel: "noopener noreferrer" } as const;

function NavLinks(): ReactElement {
  return (
    <>
      {NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          underline="none"
          sx={marketingLinkSx}
          {...(link.external && EXTERNAL_PROPS)}
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}

export function MarketingNav(): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <Box
      component="header"
      sx={(theme) => ({
        position: "sticky",
        top: 0,
        zIndex: theme.zIndex.appBar,
        borderBottom: 1,
        borderColor: "divider",
        backgroundColor: `color-mix(in srgb, ${theme.palette.surfaces.base} 86%, transparent)`,
        backdropFilter: "blur(8px)",
      })}
    >
      <Container maxWidth="lg">
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            height: MARKETING_NAV_HEIGHT,
          }}
        >
          <Stack direction="row" spacing={4} sx={{ alignItems: "center" }}>
            <BrandMark />
            <Stack
              direction="row"
              spacing={3}
              sx={{ alignItems: "center", display: { xs: "none", sm: "flex" } }}
            >
              <NavLinks />
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <LinkButton
              href="/login"
              variant="text"
              size="small"
              sx={{ display: { xs: "none", sm: "inline-flex" } }}
            >
              Sign in
            </LinkButton>
            <LinkButton href="/install" variant="contained" size="small">
              Get started
            </LinkButton>
            <IconButton
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              sx={{ display: { xs: "inline-flex", sm: "none" } }}
            >
              <MenuIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Container>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Stack component="nav" spacing={2} sx={{ width: 240, p: 3 }} onClick={() => setOpen(false)}>
          <NavLinks />
          <Link href="/login" underline="none" sx={marketingLinkSx}>
            Sign in
          </Link>
        </Stack>
      </Drawer>
    </Box>
  );
}
