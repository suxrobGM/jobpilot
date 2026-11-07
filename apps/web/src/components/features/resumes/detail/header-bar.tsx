"use client";

import { type ReactElement, useState } from "react";
import { Delete, PictureAsPdf, Star, StarBorder } from "@mui/icons-material";
import { Button, Chip, Stack, TextField } from "@mui/material";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { invalidations } from "@/api/queries";
import { resumePdfUrl } from "@/api/resume-urls";
import type { ResumeDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { TooltipIconButton } from "@/components/ui/buttons";
import { PageHeader } from "@/components/ui/layout";
import { useDeleteResume } from "../use-delete-resume";
import { useSetPrimaryResume } from "../use-set-primary-resume";

interface ResumeHeaderProps {
  resume: ResumeDto;
}

/** The top bar for one resume: its name, primary status, the PDF, and delete. */
export function ResumeHeader(props: ResumeHeaderProps): ReactElement {
  const { resume } = props;
  const router = useRouter();
  const setPrimary = useSetPrimaryResume();
  const remove = useDeleteResume(() => router.push("/documents/resumes"));

  return (
    <PageHeader
      eyebrow="Resume"
      title={resume.label}
      backHref="/documents/resumes"
      backLabel="Resumes"
      actions={
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          {resume.isPrimary ? (
            <Chip icon={<Star />} label="Primary" color="primary" variant="outlined" />
          ) : (
            <Button
              size="small"
              startIcon={<StarBorder />}
              onClick={() => setPrimary.mutate(resume.id)}
              loading={setPrimary.isPending}
            >
              Set primary
            </Button>
          )}
          <TooltipIconButton title="Open PDF" href={resumePdfUrl(resume.id, resume.updatedAt)}>
            <PictureAsPdf fontSize="md" />
          </TooltipIconButton>
          <TooltipIconButton
            title="Delete resume"
            disabled={remove.isPending}
            onClick={() => void remove.request(resume)}
          >
            <Delete fontSize="md" />
          </TooltipIconButton>
        </Stack>
      }
    />
  );
}

interface ResumeNameFieldProps {
  resume: ResumeDto;
}

/** Renames on blur; null while not editing, so a rename that arrives live shows instead of a stale copy. */
export function ResumeNameField(props: ResumeNameFieldProps): ReactElement {
  const { resume } = props;
  const [draftLabel, setDraftLabel] = useState<string | null>(null);

  const renameLabel = useApiMutation(
    (label: string) => api.resumes({ id: resume.id }).put({ label }),
    { successMessage: "Renamed", invalidate: invalidations.resume },
  );

  return (
    <TextField
      label="Resume name"
      value={draftLabel ?? resume.label}
      onChange={(e) => setDraftLabel(e.target.value)}
      onBlur={() => {
        const next = draftLabel?.trim();
        if (next && next !== resume.label) {
          renameLabel.mutate(next);
        }
        setDraftLabel(null);
      }}
      sx={{ maxWidth: 360 }}
    />
  );
}
