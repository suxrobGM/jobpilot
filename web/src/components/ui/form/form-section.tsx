"use client";

import { Box, Stack, Typography } from "@mui/material";
import type { PropsWithChildren, ReactElement } from "react";

interface FormSectionProps extends PropsWithChildren {
  title: string;
  description?: string;
}

export function FormSection(props: FormSectionProps): ReactElement {
  const { title, description, children } = props;
  return (
    <Box>
      <Stack spacing={0.25} sx={{ mb: 2 }}>
        <Typography variant="h4">{title}</Typography>
        {description && (
          <Typography variant="body2Muted">{description}</Typography>
        )}
      </Stack>
      <Stack spacing={2}>{children}</Stack>
    </Box>
  );
}
