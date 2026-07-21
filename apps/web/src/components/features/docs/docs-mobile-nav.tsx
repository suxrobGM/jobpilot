"use client";

import { type ReactElement, useState } from "react";
import { ExpandMore } from "@mui/icons-material";
import { Box, Collapse, Link, Paper, Stack, Typography } from "@mui/material";
import { usePathname } from "next/navigation";
import { DOCS_LINKS } from "./docs-nav";

const PANEL_ID = "docs-mobile-nav-panel";

/** Collapsible section navigator for xs-sm: a disclosure showing the current page, tap to reveal all pages. */
export function DocsMobileNav(): ReactElement {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close on route change so the panel never lingers over the new page (render-time state adjustment).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  const current = DOCS_LINKS.find((link) => link.href === pathname)?.label ?? "Overview";
  // Collapse unmounts the panel; aria-controls pointing at a missing id strands screen readers.
  const controlledPanelId = open ? PANEL_ID : undefined;

  return (
    <Paper
      component="nav"
      aria-label="Documentation"
      variant="panel"
      sx={{
        display: { xs: "block", md: "none" },
        backgroundColor: "surfaces.elevated",
        overflow: "hidden",
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={controlledPanelId}
        sx={(t) => ({
          appearance: "none",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          paddingBlock: 1.25,
          paddingInline: 1.75,
          textAlign: "left",
          "&:focus-visible": { outline: t.shadows_custom.focus, outlineOffset: -2 },
        })}
      >
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography variant="overlineMuted">Docs</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }} noWrap>
            {current}
          </Typography>
        </Stack>
        <ExpandMore
          fontSize="sm"
          sx={(t) => ({
            color: "text.secondary",
            transition: `transform ${t.motion.fast}`,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          })}
        />
      </Box>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Stack
          id={PANEL_ID}
          spacing={0}
          sx={{ borderTop: 1, borderColor: "line.divider", paddingBlock: 0.75 }}
        >
          {DOCS_LINKS.map((link) => {
            const active = link.href === pathname;
            return (
              <Link
                key={link.href}
                href={link.href}
                underline="none"
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                sx={(t) => ({
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: active ? 600 : 400,
                  paddingBlock: 1,
                  paddingInline: 1.75,
                  borderLeft: 2,
                  borderLeftColor: active ? "accent.primary" : "transparent",
                  color: active ? "text.primary" : "text.secondary",
                  backgroundColor: active ? "surfaces.base" : "transparent",
                  transition: `color ${t.motion.fast}`,
                  "&:hover": { color: "text.primary" },
                })}
              >
                {link.label}
              </Link>
            );
          })}
        </Stack>
      </Collapse>
    </Paper>
  );
}
