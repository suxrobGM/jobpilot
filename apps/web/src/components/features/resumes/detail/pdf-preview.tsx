"use client";

import type { ReactElement } from "react";
import { OpenInNew } from "@mui/icons-material";
import { Box, Button, Stack, Typography } from "@mui/material";
import { resumePdfUrl } from "@/api/resume-urls";
import { SectionCard } from "@/components/ui/layout";

interface ResumePdfPreviewProps {
  resumeId: string;
  updatedAt: string | Date;
}

export function ResumePdfPreview(props: ResumePdfPreviewProps): ReactElement {
  const { resumeId, updatedAt } = props;
  const src = resumePdfUrl(resumeId, updatedAt);
  return (
    <SectionCard
      title="PDF preview"
      actions={
        <Button
          size="small"
          endIcon={<OpenInNew fontSize="sm" />}
          component="a"
          href={src}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open
        </Button>
      }
    >
      <Stack spacing={1}>
        <Box
          component="iframe"
          src={src}
          sx={(t) => ({
            width: "100%",
            aspectRatio: "8.5/11",
            border: `1px solid ${t.palette.line.divider}`,
            borderRadius: t.radii.sm,
            bgcolor: "background.default",
          })}
        />
        <Typography variant="captionMuted">
          Reflects the most recently saved structure. Save the editor to refresh.
        </Typography>
      </Stack>
    </SectionCard>
  );
}
