"use client";

import { useRef, useState, type ReactElement } from "react";
import { CloudUpload, Delete, PictureAsPdf, Star, StarBorder } from "@mui/icons-material";
import { Box, Button, IconButton, Stack, TextField, Typography } from "@mui/material";
import { ConfirmDialog } from "@/components/ui/feedback/confirm-dialog";
import { SectionCard } from "@/components/ui/layout/section-card";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { ProfileResponse, ResumeDto } from "@/types/api";

export function ResumesTab(): ReactElement {
  const [pendingDelete, setPendingDelete] = useState<ResumeDto | null>(null);
  const [label, setLabel] = useState("default");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resumes = useApiQuery<ResumeDto[]>(queryKeys.resumes.list(), () =>
    apiClient.get<ResumeDto[]>("/api/resumes"),
  );

  const profile = useApiQuery<ProfileResponse>(queryKeys.profile.detail(), () =>
    apiClient.get<ProfileResponse>("/api/profile"),
  );

  const upload = useApiMutation<ResumeDto, { label: string; file: File }>(
    (vars) => {
      const fd = new FormData();
      fd.append("label", vars.label);
      fd.append("file", vars.file);
      return apiClient.upload<ResumeDto>("/api/resumes", fd);
    },
    {
      successMessage: "Resume uploaded",
      invalidate: [queryKeys.resumes.all, queryKeys.profile.all],
      onSuccess: () => {
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    },
  );

  const remove = useApiMutation<{ deleted: number }, number>(
    (id) => apiClient.del<{ deleted: number }>(`/api/resumes/${id}`),
    {
      successMessage: "Resume removed",
      invalidate: [queryKeys.resumes.all, queryKeys.profile.all],
      onSuccess: () => setPendingDelete(null),
    },
  );

  const setDefault = useApiMutation<{ defaultResumeId: number | null }, number>(
    (id) =>
      apiClient.post<{ defaultResumeId: number | null }>("/api/profile/default-resume", {
        resumeId: id,
      }),
    {
      successMessage: "Default resume updated",
      invalidate: [queryKeys.profile.all],
    },
  );

  const rows = resumes.data ?? [];
  const defaultResumeId = profile.data?.profile?.defaultResumeId ?? null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!label.trim()) return;
    upload.mutate({ label: label.trim(), file });
  };

  return (
    <SectionCard
      title="Resumes"
      description="Upload PDFs that skills attach during applications. The default is used unless a board overrides it."
    >
      <Stack
        direction="row"
        spacing={1.5}
        sx={(t) => ({
          alignItems: "center",
          mb: 2,
          p: 2,
          border: `1px dashed ${t.palette.line.border}`,
          borderRadius: t.radii.md,
        })}
      >
        <TextField
          size="small"
          label="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        <Button
          variant="contained"
          startIcon={<CloudUpload />}
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending || !label.trim()}
        >
          {upload.isPending ? "Uploading…" : "Upload PDF"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={handleFile}
        />
      </Stack>

      {rows.length === 0 ? (
        <Box sx={{ py: 3, textAlign: "center" }}>
          <Typography variant="body2Muted">No resumes uploaded yet.</Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {rows.map((r) => {
            const isDefault = r.id === defaultResumeId;
            return (
              <Stack
                key={r.id}
                direction="row"
                spacing={2}
                sx={(t) => ({
                  alignItems: "center",
                  p: 1.5,
                  borderRadius: t.radii.sm,
                  border: `1px solid ${t.palette.line.divider}`,
                })}
              >
                <PictureAsPdf fontSize="lg" sx={{ color: "text.secondary" }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {r.label}
                  </Typography>
                  <Typography variant="captionMuted">
                    {r.filename} · {(r.sizeBytes / 1024).toFixed(0)} KB
                  </Typography>
                </Box>
                <IconButton
                  onClick={() => setDefault.mutate(r.id)}
                  aria-label={isDefault ? "Default resume" : "Set as default"}
                  disabled={setDefault.isPending}
                >
                  {isDefault ? <Star fontSize="md" /> : <StarBorder fontSize="md" />}
                </IconButton>
                <IconButton
                  component="a"
                  href={`/api/resumes/${r.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open PDF"
                >
                  <PictureAsPdf fontSize="md" />
                </IconButton>
                <IconButton onClick={() => setPendingDelete(r)} aria-label="Delete resume">
                  <Delete fontSize="md" />
                </IconButton>
              </Stack>
            );
          })}
        </Stack>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete resume?"
        message={
          pendingDelete
            ? `Remove "${pendingDelete.label}" (${pendingDelete.filename})? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </SectionCard>
  );
}
