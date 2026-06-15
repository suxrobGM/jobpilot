"use client";

import { useState, type ReactElement } from "react";
import { Delete, OpenInNew, Search } from "@mui/icons-material";
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { apiClient } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import { variantPdfUrl } from "@/api/resume-urls";
import type { ResumeVariantListItem } from "@/api/types";
import { ConfirmDialog } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";
import { TailorForJobButton } from "../tailor/tailor-for-job-button";

interface VariantsPanelProps {
  resumeId: number;
  resumeLabel: string;
}

export function VariantsPanel(props: VariantsPanelProps): ReactElement {
  const { resumeId, resumeLabel } = props;
  const [confirmDelete, setConfirmDelete] = useState<ResumeVariantListItem | null>(null);
  const [search, setSearch] = useState("");

  const query = useApiQuery<ResumeVariantListItem[]>(queryKeys.resume.variants(resumeId), () =>
    apiClient.get<ResumeVariantListItem[]>(`/api/resumes/${resumeId}/variants`),
  );

  const remove = useApiMutation<{ deleted: number }, number>(
    (id) => apiClient.del<{ deleted: number }>(`/api/resumes/variants/${id}`),
    {
      successMessage: "Variant deleted",
      invalidate: [queryKeys.resume.variants(resumeId)],
      onSuccess: () => setConfirmDelete(null),
    },
  );

  const variants = query.data ?? [];
  const term = search.trim().toLowerCase();
  const filtered = term
    ? variants.filter(
        (v) =>
          v.label.toLowerCase().includes(term) || (v.jobUrl?.toLowerCase().includes(term) ?? false),
      )
    : variants;

  return (
    <SectionCard
      title="Tailored variants"
      description={`AI-generated copies of "${resumeLabel}" tailored to specific jobs. Bases are not modified.`}
      actions={<TailorForJobButton />}
    >
      {query.isLoading ? (
        <Skeleton variant="rounded" height={64} />
      ) : variants.length === 0 ? (
        <Typography variant="body2Muted">
          No variants yet. Click &ldquo;Tailor for job&rdquo;, paste a job description or URL, and
          the AI will either reuse a close match (if you had previous variants) or create a new one.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          <TextField
            size="small"
            placeholder="Search by label or job URL"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="sm" />
                  </InputAdornment>
                ),
              },
            }}
          />
          {filtered.length === 0 ? (
            <Typography variant="body2Muted">No variants match &ldquo;{search}&rdquo;.</Typography>
          ) : (
            <Stack spacing={1} sx={{ maxHeight: 480, overflowY: "auto", pr: 0.5 }}>
              {filtered.map((v) => (
                <Card key={v.id} sx={{ flexShrink: 0 }}>
                  <CardContent>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {v.label}
                          </Typography>
                          {v.applicationId && (
                            <Chip
                              label={`Application #${v.applicationId}`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                        <Typography variant="captionMuted">
                          {v.jobUrl ? `${v.jobUrl} · ` : ""}created{" "}
                          {new Date(v.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <IconButton
                        component="a"
                        href={variantPdfUrl(v.id, v.updatedAt)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open variant PDF"
                      >
                        <OpenInNew fontSize="md" />
                      </IconButton>
                      <IconButton onClick={() => setConfirmDelete(v)} aria-label="Delete variant">
                        <Delete fontSize="md" />
                      </IconButton>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      )}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete variant?"
        description={confirmDelete ? `Remove "${confirmDelete.label}"? This cannot be undone.` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={() => confirmDelete && remove.mutate(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </SectionCard>
  );
}
