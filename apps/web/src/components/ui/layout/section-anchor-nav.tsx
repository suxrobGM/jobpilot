"use client";

import { useEffect, useState, type ReactElement } from "react";
import { Box, Stack, Typography } from "@mui/material";

export interface SectionAnchor {
  id: string;
  label: string;
}

interface SectionAnchorNavProps {
  anchors: SectionAnchor[];
  /**
   * `rootMargin` for the intersection observer that detects which section is
   * currently in view. Defaults to a top-heavy band that fires when the
   * section's title crosses ~25% from the top of the viewport.
   */
  rootMargin?: string;
}

/**
 * Sticky left-rail nav that highlights the section currently visible in the
 * scroll viewport. Pair with `<Box data-section-id={id}>` wrappers on each
 * target section. Clicking an anchor smooth-scrolls to its section.
 *
 * Hidden below the `lg` breakpoint to keep narrow viewports clean — the
 * sections themselves still render stacked.
 */
export function SectionAnchorNav(props: SectionAnchorNavProps): ReactElement {
  const { anchors, rootMargin = "-25% 0px -65% 0px" } = props;
  const [activeId, setActiveId] = useState<string | null>(anchors[0]?.id ?? null);
  const idsKey = anchors.map((a) => a.id).join(" ");

  useEffect(() => {
    if (anchors.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) {
          return;
        }

        const first = visible.sort(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
        )[0];

        const id = first?.target.getAttribute("data-section-id");
        if (id) {
          setActiveId(id);
        }
      },
      { rootMargin, threshold: 0 },
    );

    for (const anchor of anchors) {
      const el = document.querySelector(`[data-section-id="${anchor.id}"]`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, rootMargin]);

  const handleClick = (id: string): void => {
    const el = document.querySelector(`[data-section-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <Box
      component="nav"
      sx={(theme) => ({
        display: { xs: "none", lg: "block" },
        position: "sticky",
        top: theme.spacing(3),
        alignSelf: "flex-start",
        width: 200,
        flexShrink: 0,
      })}
      aria-label="Section navigation"
    >
      <Stack spacing={0.25}>
        {anchors.map((anchor) => {
          const active = anchor.id === activeId;
          return (
            <Box
              key={anchor.id}
              component="button"
              type="button"
              onClick={() => handleClick(anchor.id)}
              sx={(theme) => ({
                appearance: "none",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                paddingInline: theme.spacing(1.25),
                paddingBlock: theme.spacing(0.75),
                borderLeft: `2px solid ${
                  active ? theme.palette.accent.primary : theme.palette.line.divider
                }`,
                color: active ? theme.palette.text.primary : theme.palette.text.secondary,
                transition: `color ${theme.motion.fast}, border-color ${theme.motion.fast}`,
                "&:hover": { color: theme.palette.text.primary },
                "&:focus-visible": { outline: theme.shadows_custom.focus, outlineOffset: 2 },
              })}
            >
              <Typography
                variant="body2"
                sx={{ fontWeight: active ? 500 : 400, fontSize: "0.8125rem" }}
              >
                {anchor.label}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
