"use client";

import type { PropsWithChildren, ReactElement } from "react";
import { Stack, Typography } from "@mui/material";

/**
 * Sticky footer for the dirty form. Rendered outside the SectionCard on purpose: MUI Card clips
 * overflow, which would break `position: sticky`.
 */
export function SaveBar(props: PropsWithChildren): ReactElement {
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={(theme) => ({
        position: "sticky",
        bottom: 0,
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBlock: theme.spacing(1.5),
        backgroundColor: theme.palette.surfaces.base,
        borderTop: `1px solid ${theme.palette.line.divider}`,
        zIndex: 1,
      })}
    >
      <Typography variant="captionMuted">Unsaved changes</Typography>
      {props.children}
    </Stack>
  );
}
