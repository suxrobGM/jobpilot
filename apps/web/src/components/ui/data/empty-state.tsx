"use client";

import type { ReactElement, ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /**
   * `card` (default) renders a full dashed-border panel. `inline` renders a
   * compact centered message — use inside a SectionCard or list where a panel
   * would be too heavy.
   */
  variant?: "card" | "inline";
}

export function EmptyState(props: EmptyStateProps): ReactElement {
  const { title, description, action, variant = "card" } = props;

  if (variant === "inline") {
    return (
      <Box sx={{ py: 3, textAlign: "center" }}>
        <Typography variant="body2Muted">{title}</Typography>
        {description && (
          <Typography variant="body2Muted" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        )}
        {action && <Box sx={{ pt: 1 }}>{action}</Box>}
      </Box>
    );
  }

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
