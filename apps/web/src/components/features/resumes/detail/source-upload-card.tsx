"use client";

import type { ReactElement } from "react";
import { Delete, PictureAsPdf } from "@mui/icons-material";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { invalidations } from "@/api/query-keys";
import type { ResumeDto } from "@/api/types";
import { FileUpload } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { MAX_RESUME_BYTES } from "@/lib/constants";
import { useToast } from "@/providers/notification-provider";
import { ExtractResumeButton } from "../extract-resume-button";

interface SourceUploadCardProps {
  resume: ResumeDto;
}

export function SourceUploadCard(props: SourceUploadCardProps): ReactElement {
  const { resume } = props;
  const toast = useToast();

  const upload = useApiMutation<{ id: string }, File>(
    (file) => api.resumes({ id: resume.id }).source.post({ file }),
    {
      successMessage: "Source PDF uploaded",
      invalidate: invalidations.resume,
    },
  );

  const remove = useApiMutation<{ id: string }, void>(
    () => api.resumes({ id: resume.id }).source.delete(),
    {
      successMessage: "Source PDF removed",
      invalidate: invalidations.resume,
    },
  );

  return (
    <SectionCard
      title="Source PDF"
      description={
        resume.sourceFilename
          ? "The PDF this resume was bootstrapped from. Extract structured fields from it, or tailor it for a specific job."
          : "Upload a PDF to bootstrap this resume, or fill out the editor below directly."
      }
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        {resume.sourceFilename ? (
          <>
            <PictureAsPdf sx={{ color: "text.secondary" }} fontSize="lg" />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2Strong">{resume.sourceFilename}</Typography>
              <Typography variant="captionMuted">
                {resume.sourceSizeBytes
                  ? `${(resume.sourceSizeBytes / 1024).toFixed(0)} KB`
                  : "unknown size"}
              </Typography>
            </Box>
            <ExtractResumeButton resume={resume} />
            <FileUpload
              accept="application/pdf"
              maxBytes={MAX_RESUME_BYTES}
              loading={upload.isPending}
              label="Replace"
              onFile={(f) => upload.mutate(f)}
              onError={(msg) => toast.error(msg)}
            />
            <IconButton
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              aria-label="Remove source PDF"
            >
              <Delete fontSize="md" />
            </IconButton>
          </>
        ) : (
          <FileUpload
            accept="application/pdf"
            maxBytes={MAX_RESUME_BYTES}
            loading={upload.isPending}
            label="Upload PDF"
            onFile={(f) => upload.mutate(f)}
            onError={(msg) => toast.error(msg)}
          />
        )}
      </Stack>
    </SectionCard>
  );
}
