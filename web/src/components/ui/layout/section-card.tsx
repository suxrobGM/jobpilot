"use client";

import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

interface SectionCardProps extends PropsWithChildren {
  title?: string;
  description?: string;
  actions?: ReactNode;
}

export function SectionCard(props: SectionCardProps): ReactElement {
  const { title, description, actions, children } = props;
  return (
    <Box
      sx={(t) => ({
        border: `1px solid ${t.palette.line.divider}`,
        borderRadius: t.radii.md,
        backgroundColor: t.palette.surfaces.card,
        p: 2.5,
      })}
    >
      {(title || actions) && (
        <Stack
          direction="row"
          sx={{ mb: 2, alignItems: "flex-start", justifyContent: "space-between" }}
        >
          <Box>
            {title && <Typography variant="h4">{title}</Typography>}
            {description && (
              <Typography variant="body2Muted" sx={{ mt: 0.5 }}>
                {description}
              </Typography>
            )}
          </Box>
          {actions && (
            <Stack direction="row" spacing={1}>
              {actions}
            </Stack>
          )}
        </Stack>
      )}
      {children}
    </Box>
  );
}
