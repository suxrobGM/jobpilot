"use client";

import { useState, type ReactElement } from "react";
import { Add, Description, PictureAsPdf, Star, StarBorder } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { Route } from "next";
import Link from "next/link";
import { apiClient } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import { resumePdfUrl } from "@/api/resume-urls";
import type { ResumeListItem } from "@/api/types";
import { FileUpload } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { MAX_RESUME_BYTES } from "@/lib/constants";
import { useToast } from "@/providers/notification-provider";
import { NewResumeDialog } from "./new-resume-dialog";

export function ResumesList(): ReactElement {
  const toast = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const list = useApiQuery<ResumeListItem[]>(queryKeys.resume.list(), () =>
    apiClient.get<ResumeListItem[]>("/api/resumes"),
  );

  const upload = useApiMutation<{ id: number }, File>(
    (file) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiClient.upload<{ id: number }>("/api/resumes", fd);
    },
    {
      successMessage: "Resume uploaded",
      invalidate: [queryKeys.resume.all, queryKeys.profile.all],
    },
  );

  const setPrimary = useApiMutation<{ primaryResumeId: number | null }, number>(
    (id) =>
      apiClient.post<{ primaryResumeId: number | null }>("/api/profile/primary-resume", {
        resumeId: id,
      }),
    {
      successMessage: "Primary resume updated",
      invalidate: [queryKeys.resume.all, queryKeys.profile.all],
    },
  );

  if (list.isLoading) {
    return <LinearProgress />;
  }
  const rows = list.data ?? [];

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={(t) => ({
          alignItems: "center",
          p: 2,
          border: `1px dashed ${t.palette.line.border}`,
          borderRadius: t.radii.md,
        })}
      >
        <FileUpload
          accept="application/pdf"
          maxBytes={MAX_RESUME_BYTES}
          loading={upload.isPending}
          label="Upload PDF"
          buttonProps={{ variant: "contained" }}
          onFile={(f) => upload.mutate(f)}
          onError={(msg) => toast.error(msg)}
        />
        <Button
          variant="outlined"
          size="small"
          startIcon={<Add />}
          onClick={() => setDialogOpen(true)}
        >
          Start blank
        </Button>
        <Box sx={{ flex: 1 }} />
        <Typography variant="captionMuted">
          {rows.length} resume{rows.length === 1 ? "" : "s"}
        </Typography>
      </Stack>

      {rows.length === 0 ? (
        <SectionCard title="No resumes yet">
          <Typography variant="body2Muted">
            Upload a PDF to bootstrap your first base resume, or start blank and fill out the
            editor.
          </Typography>
        </SectionCard>
      ) : (
        <Stack spacing={1}>
          {rows.map((r) => (
            <Card key={r.id} sx={{ backgroundColor: r.isPrimary ? "action.selected" : undefined }}>
              <CardContent>
                <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                  <Description fontSize="lg" sx={{ color: "text.secondary" }} />
                  <Box
                    component={Link}
                    href={`/resumes/${r.id}` as Route}
                    sx={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Typography variant="body1" sx={{ fontWeight: "bold" }}>
                        {r.label}
                      </Typography>
                      {r.isPrimary && <Chip label="Primary" size="small" color="primary" />}
                      {!r.hasData && <Chip label="No structure" size="small" variant="outlined" />}
                      {r.variantCount > 0 && (
                        <Chip
                          label={`${r.variantCount} variant${r.variantCount === 1 ? "" : "s"}`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Stack>
                    <Typography variant="captionMuted">
                      {r.sourceFilename ?? "no source PDF"} · updated{" "}
                      {new Date(r.updatedAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <IconButton
                    onClick={() => setPrimary.mutate(r.id)}
                    aria-label={r.isPrimary ? "Primary resume" : "Set as primary"}
                    disabled={setPrimary.isPending}
                  >
                    {r.isPrimary ? <Star fontSize="md" /> : <StarBorder fontSize="md" />}
                  </IconButton>
                  <IconButton
                    component="a"
                    href={resumePdfUrl(r.id, r.updatedAt)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open PDF"
                  >
                    <PictureAsPdf fontSize="md" />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <NewResumeDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Stack>
  );
}
