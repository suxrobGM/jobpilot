import { Box, Stack, Typography } from "@mui/material";
import type { ReactElement, ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader(props: PageHeaderProps): ReactElement {
  const { eyebrow, title, description, actions } = props;
  return (
    <Stack
      direction="row"
      sx={{ mb: 3, alignItems: "flex-end", justifyContent: "space-between" }}
    >
      <Box>
        {eyebrow && <Typography variant="overlineMuted">{eyebrow}</Typography>}
        <Typography variant="h1" sx={{ fontSize: "1.75rem", mt: eyebrow ? 0.5 : 0 }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body1Muted" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        )}
      </Box>
      {actions && <Stack direction="row" spacing={1}>{actions}</Stack>}
    </Stack>
  );
}
