"use client";

import type { ReactElement } from "react";
import { OpenInNew } from "@mui/icons-material";
import { Box, Button, Stack, Typography } from "@mui/material";
import { resumePdfUrl } from "@/api/resume-urls";

interface ResumePdfPreviewProps {
  resumeId: string;
  updatedAt: string | Date;
}

/** The saved PDF at full height: the output is what the editor is for, so it gets the room. */
export function ResumePdfPreview(props: ResumePdfPreviewProps): ReactElement {
  const { resumeId, updatedAt } = props;
  const src = resumePdfUrl(resumeId, updatedAt);
  return (
    <Stack sx={{ flex: 1, minHeight: 0 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", px: 2, py: 1, borderBottom: 1, borderColor: "divider" }}
      >
        <Typography variant="body2Strong" sx={{ flex: 1 }}>
          PDF preview
        </Typography>
        <Typography variant="captionMuted" sx={{ display: { xs: "none", sm: "block" } }}>
          Updates on save
        </Typography>
        <Button size="small" color="inherit" endIcon={<OpenInNew fontSize="sm" />} href={src}>
          Open
        </Button>
      </Stack>
      <Box
        component="iframe"
        title="Resume PDF preview"
        // Chromium's viewer flags: no thumbnail pane, page fit to the column's width.
        src={`${src}#navpanes=0&view=FitH`}
        sx={{ flex: 1, minHeight: 480, width: "100%", border: 0, bgcolor: "background.default" }}
      />
    </Stack>
  );
}
