"use client";

import type { ReactElement, ReactNode } from "react";
import { Stack } from "@mui/material";

interface StickyFooterProps {
  children: ReactNode;
}

/** Must stay outside any Card: MUI Card clips overflow, which kills `position: sticky`. */
export function StickyFooter(props: StickyFooterProps): ReactElement {
  return (
    <Stack
      spacing={1}
      sx={(theme) => ({
        position: "sticky",
        bottom: 0,
        paddingBlock: theme.spacing(1.5),
        backgroundColor: theme.palette.surfaces.base,
        borderTop: 1,
        borderColor: "divider",
        zIndex: 1,
      })}
    >
      {props.children}
    </Stack>
  );
}
