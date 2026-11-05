"use client";

import { type ReactElement, useEffect, useState } from "react";
import { Box, ButtonBase, Paper, Stack, Typography } from "@mui/material";

export interface SectionAnchor {
  id: string;
  label: string;
  /** Shows a hollow marker, so a section with nothing in it is visible without opening it. */
  empty?: boolean;
}

interface SectionAnchorNavProps {
  anchors: SectionAnchor[];
  /** Observer band; the default fires as a section title crosses ~25% from the top. */
  rootMargin?: string;
}

/** Highlights the section in view; targets are `<Box data-section-id={id}>`. Hidden below `lg`. */
export function SectionAnchorNav(props: SectionAnchorNavProps): ReactElement {
  const { anchors, rootMargin = "-25% 0px -65% 0px" } = props;
  const [activeId, setActiveId] = useState<string | null>(anchors[0]?.id ?? null);
  const idsKey = anchors.map((a) => a.id).join(" ");

  // biome-ignore lint/correctness/useExhaustiveDependencies: idsKey stands in for the anchors identity
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
      if (el) {
        observer.observe(el);
      }
    }

    return () => observer.disconnect();
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
            <ButtonBase
              key={anchor.id}
              onClick={() => handleClick(anchor.id)}
              sx={(theme) => ({
                justifyContent: "flex-start",
                textAlign: "left",
                paddingInline: theme.spacing(1.25),
                paddingBlock: theme.spacing(0.75),
                borderLeft: `2px solid ${
                  active ? theme.palette.accent.primary : theme.palette.line.divider
                }`,
                color: active ? "text.primary" : "text.secondary",
                transition: `color ${theme.motion.fast}, border-color ${theme.motion.fast}`,
                "&:hover": { color: "text.primary" },
                "&:focus-visible": { outline: theme.shadows_custom.focus, outlineOffset: 2 },
              })}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography variant={active ? "body1Strong" : "body1"}>{anchor.label}</Typography>
                {anchor.empty && (
                  <Paper
                    variant="panel"
                    sx={(theme) => ({ width: 6, height: 6, borderRadius: theme.radii.pill })}
                  />
                )}
              </Stack>
            </ButtonBase>
          );
        })}
      </Stack>
    </Box>
  );
}
