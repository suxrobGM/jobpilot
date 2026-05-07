"use client";

import { Box, Stack, Typography } from "@mui/material";
import type { ReactElement, ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState(props: EmptyStateProps): ReactElement {
  const { title, description, action } = props;
  return (
    <Box
      sx={(t) => ({
        py: 6,
        px: 3,
        textAlign: "center",
        border: `1px dashed ${t.palette.line.border}`,
        borderRadius: t.radii.md,
        backgroundColor: t.palette.surfaces.card,
      })}
    >
      <Stack spacing={1} sx={{ alignItems: "center" }}>
        <Typography variant="h4">{title}</Typography>
        {description && <Typography variant="body2Muted">{description}</Typography>}
        {action && <Box sx={{ pt: 1 }}>{action}</Box>}
      </Stack>
    </Box>
  );
}
