"use client";

import { type ReactElement, useState } from "react";
import { Delete, PictureAsPdf, Star, StarBorder } from "@mui/icons-material";
import { Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { invalidations } from "@/api/queries";
import { resumePdfUrl } from "@/api/resume-urls";
import type { ResumeDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { TooltipIconButton } from "@/components/ui/buttons";
import { useConfirm } from "@/providers/confirm-provider";
import { useSetPrimaryResume } from "../use-set-primary-resume";

interface ResumeHeaderBarProps {
  resume: ResumeDto;
}

export function ResumeHeaderBar(props: ResumeHeaderBarProps): ReactElement {
  const { resume } = props;
  const router = useRouter();
  const confirm = useConfirm();
  // Null while not editing, so a rename that arrives live shows instead of a stale copy.
  const [draftLabel, setDraftLabel] = useState<string | null>(null);

  const renameLabel = useApiMutation(
    (label: string) => api.resumes({ id: resume.id }).put({ label }),
    {
      successMessage: "Renamed",
      invalidate: invalidations.resume,
    },
  );

  const setPrimary = useSetPrimaryResume();

  const remove = useApiMutation(() => api.resumes({ id: resume.id }).delete(), {
    successMessage: "Resume deleted",
    invalidate: invalidations.resume,
    onSuccess: () => router.push("/documents/resumes"),
  });

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "Delete resume?",
      description: `Remove "${resume.label}" and all its variants? This cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (confirmed) {
      remove.mutate();
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <TextField
            size="small"
            value={draftLabel ?? resume.label}
            onChange={(e) => setDraftLabel(e.target.value)}
            onBlur={() => {
              const next = draftLabel?.trim();
              if (next && next !== resume.label) {
                renameLabel.mutate(next);
              }
              setDraftLabel(null);
            }}
            sx={{ flex: 1, maxWidth: 320 }}
          />
          {resume.isPrimary ? (
            <Typography
              variant="captionMuted"
              sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
            >
              <Star fontSize="md" color="primary" />
              Primary
            </Typography>
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
          <TooltipIconButton title="Delete resume" onClick={handleDelete}>
            <Delete fontSize="md" />
          </TooltipIconButton>
        </Stack>
      </CardContent>
    </Card>
  );
}
