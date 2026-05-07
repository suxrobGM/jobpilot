"use client";

import type { PropsWithChildren, ReactElement } from "react";
import { Stack } from "@mui/material";

export function FilterBar(props: PropsWithChildren): ReactElement {
  const { children } = props;
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={(t) => ({
        py: 1.5,
        px: 2,
        mb: 2,
        border: `1px solid ${t.palette.line.divider}`,
        borderRadius: t.radii.md,
        backgroundColor: t.palette.surfaces.card,
        flexWrap: "wrap",
        rowGap: 1.5,
      })}
    >
      {children}
    </Stack>
  );
}
