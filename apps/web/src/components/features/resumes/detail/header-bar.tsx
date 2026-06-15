"use client";

import { useState, type ReactElement } from "react";
import { Delete, PictureAsPdf, Star, StarBorder } from "@mui/icons-material";
import { Button, Card, CardContent, IconButton, Stack, TextField, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import { resumePdfUrl } from "@/api/resume-urls";
import type { ResumeDto } from "@/api/types";
import { useConfirm } from "@/providers/confirm-provider";
import { TailorForJobButton } from "../tailor/tailor-for-job-button";

interface ResumeHeaderBarProps {
  resume: ResumeDto;
}

export function ResumeHeaderBar(props: ResumeHeaderBarProps): ReactElement {
  const { resume } = props;
  const router = useRouter();
  const confirm = useConfirm();
  const [editingLabel, setEditingLabel] = useState(resume.label);

  const renameLabel = useApiMutation<{ id: number }, { label: string }>(
    (vars) => apiClient.put<{ id: number }>(`/api/resumes/${resume.id}`, vars),
    {
      successMessage: "Renamed",
      invalidate: [queryKeys.resume.all, queryKeys.profile.all],
    },
  );

  const setPrimary = useApiMutation<{ primaryResumeId: number | null }, void>(
    () =>
      apiClient.post<{ primaryResumeId: number | null }>("/api/profile/primary-resume", {
        resumeId: resume.id,
      }),
    {
      successMessage: "Set as primary",
      invalidate: [queryKeys.resume.all, queryKeys.profile.all],
    },
  );

  const remove = useApiMutation<{ deleted: number }, void>(
    () => apiClient.del<{ deleted: number }>(`/api/resumes/${resume.id}`),
    {
      successMessage: "Resume deleted",
      invalidate: [queryKeys.resume.all, queryKeys.profile.all],
      onSuccess: () => router.push("/resumes"),
    },
  );

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "Delete resume?",
      description: `Remove "${resume.label}" and all its variants? This cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (confirmed) remove.mutate();
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <TextField
            size="small"
            value={editingLabel}
            onChange={(e) => setEditingLabel(e.target.value)}
            onBlur={() => {
              const next = editingLabel.trim();
              if (next && next !== resume.label) {
                renameLabel.mutate({ label: next });
              } else if (!next) {
                setEditingLabel(resume.label);
              }
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
              onClick={() => setPrimary.mutate()}
              disabled={setPrimary.isPending}
            >
              Set primary
            </Button>
          )}
          <TailorForJobButton />
          <IconButton
            component="a"
            href={resumePdfUrl(resume.id, resume.updatedAt)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open PDF"
          >
            <PictureAsPdf fontSize="md" />
          </IconButton>
          <IconButton onClick={handleDelete} aria-label="Delete resume">
            <Delete fontSize="md" />
          </IconButton>
        </Stack>
      </CardContent>
    </Card>
  );
}
