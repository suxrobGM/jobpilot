"use client";

import type { ReactElement } from "react";
import { Link, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import { JobPilotMark } from "@/components/brand/jobpilot-mark";

interface BrandMarkProps {
  iconOnly?: boolean;
  /** Defaults to home: a logo that links nowhere reads as broken. */
  href?: Route;
}

export function BrandMark(props: BrandMarkProps): ReactElement {
  const { iconOnly = false, href = "/" } = props;
  return (
    <Stack
      component={Link}
      href={href}
      aria-label="JobPilot home"
      underline="none"
      direction="row"
      spacing={1}
      sx={{
        alignItems: "center",
        color: "text.primary",
        transition: (theme) => theme.motion.fast,
        "&:hover": { opacity: 0.85 },
      }}
    >
      <JobPilotMark size={32} />
      {!iconOnly && (
        <Typography variant="h4" component="span">
          JobPilot
        </Typography>
      )}
    </Stack>
  );
}
