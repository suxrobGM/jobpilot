"use client";

import { type ReactElement, useEffect, useState } from "react";
import { Search } from "@mui/icons-material";
import { Box, ButtonBase, IconButton, Typography } from "@mui/material";
import { JumpPalette } from "./jump-palette";

function isMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.userAgent);
}

/** The top bar's way into the jump menu; Ctrl+K (⌘K on a Mac) opens it from anywhere. */
export function JumpButton(): ReactElement {
  const [open, setOpen] = useState(false);
  // Read after mount: the server can't know the platform, and a guess would flash.
  const [shortcut, setShortcut] = useState("Ctrl K");

  useEffect(() => {
    setShortcut(isMac() ? "⌘K" : "Ctrl K");
    const onKey = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault();
        setOpen((was) => !was);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <IconButton
        aria-label="Jump to"
        onClick={() => setOpen(true)}
        sx={{ display: { xs: "inline-flex", md: "none" } }}
      >
        <Search fontSize="md" />
      </IconButton>
      <ButtonBase
        aria-label={`Jump to (${shortcut})`}
        onClick={() => setOpen(true)}
        sx={(theme) => ({
          display: { xs: "none", md: "flex" },
          gap: 1,
          width: 220,
          height: 36,
          px: 1.25,
          justifyContent: "flex-start",
          border: 1,
          borderColor: "line.border",
          borderRadius: theme.radii.md,
          color: "text.secondary",
          backgroundColor: theme.palette.surfaces.panel,
          transition: theme.motion.fast,
          "&:hover": { borderColor: "line.borderHi", color: "text.primary" },
        })}
      >
        <Search fontSize="sm" />
        <Typography variant="body2" sx={{ color: "inherit" }}>
          Jump to…
        </Typography>
        <Box
          component="kbd"
          sx={(theme) => ({
            ml: "auto",
            px: 0.75,
            border: 1,
            borderColor: "line.border",
            borderRadius: theme.radii.xs,
            typography: "monoCaption",
          })}
        >
          {shortcut}
        </Box>
      </ButtonBase>
      <JumpPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}
