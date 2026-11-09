"use client";

import type { ReactElement } from "react";
import { EMPTY_RESUME_DATA } from "@jobpilot/contracts/resume";
import { OpenInNew } from "@mui/icons-material";
import { Button, Card, Divider, Stack, Typography } from "@mui/material";
import { resumePdfUrl, variantPdfUrl } from "@/api/resume-urls";
import type { ResumeDto, ResumeVariantDto } from "@/api/types";
import { FormDialogShell } from "@/components/ui/form";
import { diffRewrite } from "./rewrite-diff";

interface RewriteReviewDialogProps {
  open: boolean;
  onClose: () => void;
  resume: ResumeDto;
  suggestion: ResumeVariantDto;
  isLoading: boolean;
  onApply: () => void;
}

/** Before and after for every changed field, so applying a rewrite is not a leap of faith. */
export function RewriteReviewDialog(props: RewriteReviewDialogProps): ReactElement {
  const { open, onClose, resume, suggestion, isLoading, onApply } = props;
  const changes = diffRewrite(resume.content ?? EMPTY_RESUME_DATA, suggestion.content);
  const notes = suggestion.changeNotes?.trim();

  return (
    <FormDialogShell
      open={open}
      onClose={onClose}
      title="Suggested rewrite"
      maxWidth="md"
      onSubmit={onApply}
      submit={
        <Button type="submit" variant="contained" disabled={isLoading}>
          Apply rewrite
        </Button>
      }
    >
      <Stack spacing={2}>
        <Typography variant="body2Muted">
          Your uploaded PDF is untouched either way, so you can always re-extract from it.
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNew fontSize="sm" />}
            href={resumePdfUrl(resume.id, resume.updatedAt)}
          >
            Current PDF
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNew fontSize="sm" />}
            href={variantPdfUrl(suggestion.id, suggestion.updatedAt)}
          >
            Rewritten PDF
          </Button>
        </Stack>

        {notes && <Typography variant="body2Muted">{notes}</Typography>}

        {changes.length === 0 ? (
          <Typography variant="body2Muted">
            The rewrite matches your current text field for field. Discard it, or open both PDFs to
            compare the layout.
          </Typography>
        ) : (
          <Stack spacing={1.5} divider={<Divider />}>
            {changes.map((change) => (
              <Stack key={change.where} spacing={1}>
                <Typography variant="body2Strong">{change.where}</Typography>
                <Card sx={{ p: 1.5 }}>
                  <Typography variant="captionMuted">Now</Typography>
                  <Typography variant="body2Muted">{change.before || "(empty)"}</Typography>
                </Card>
                <Card sx={{ p: 1.5, borderColor: "primary.main" }}>
                  <Typography variant="captionMuted">Suggested</Typography>
                  <Typography variant="body2">{change.after || "(empty)"}</Typography>
                </Card>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </FormDialogShell>
  );
}
