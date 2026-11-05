"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import { resumeChannel } from "@jobpilot/contracts/sse";
import { Add, Description, PictureAsPdf, Star, StarBorder } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { invalidations, resumeQueries } from "@/api/queries";
import { resumePdfUrl } from "@/api/resume-urls";
import { RelativeTime } from "@/components/ui/display";
import { FileUpload } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { MAX_RESUME_BYTES } from "@/lib/constants";
import { useSseChannel } from "@/lib/sse/client";
import { useAgent, useAgentAvailable } from "@/providers/agent-provider";
import { useToast } from "@/providers/notification-provider";
import { plural } from "@/utils/format";
import { NewResumeDialog } from "./new-resume-dialog";
import { useSetPrimaryResume } from "./use-set-primary-resume";

/** Invisible per-resume SSE subscriber: refetches the list when content or variants change. */
function ResumeEventsSubscriber({ resumeId }: { resumeId: string }): ReactNode {
  const queryClient = useQueryClient();
  useSseChannel(
    resumeChannel,
    { resumeId },
    {
      onMessage: () => {
        void queryClient.invalidateQueries({ queryKey: resumeQueries.list().queryKey });
      },
    },
  );
  return null;
}

export function ResumesList(): ReactElement {
  const toast = useToast();
  const agent = useAgent();
  const agentAvailable = useAgentAvailable();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  const list = useQuery(resumeQueries.list());

  const upload = useApiMutation((file: File) => api.resumes.upload.post({ file }), {
    successMessage: "Resume uploaded",
    invalidate: invalidations.resume,
    onSuccess: ({ id }) => {
      // Same chain as onboarding: parse, then extract-resume follows up with a suggested rewrite.
      // Desktop-only, so on mobile the upload waits for a desktop session - as onboarding does.
      if (agentAvailable) {
        void agent.injectSkill("extract-resume", id);
      }
      // Extraction progress only shows on the detail page, not on a row saying "No structure".
      router.push(`/resumes/${id}` as Route);
    },
  });

  const setPrimary = useSetPrimaryResume();

  if (list.isLoading) {
    return <LinearProgress />;
  }
  const rows = list.data ?? [];

  return (
    <Stack spacing={2}>
      <Stack
        component={Paper}
        variant="panel"
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", p: 2, borderStyle: "dashed" }}
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
        <Typography variant="captionMuted" sx={{ ml: "auto" }}>
          {plural(rows.length, "resume")}
        </Typography>
      </Stack>

      {rows.map((r) => (
        <ResumeEventsSubscriber key={`sse-${r.id}`} resumeId={r.id} />
      ))}

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
                      <Typography variant="body1Strong">{r.label}</Typography>
                      {r.isPrimary && <Chip label="Primary" color="primary" />}
                      {!r.hasData && <Chip label="No structure" variant="outlined" />}
                      {r.variantCount > 0 && (
                        <Chip
                          label={`${r.variantCount} variant${r.variantCount === 1 ? "" : "s"}`}
                          variant="outlined"
                        />
                      )}
                    </Stack>
                    <Typography variant="captionMuted">
                      {r.sourceFilename ?? "no source PDF"} · updated{" "}
                      <RelativeTime value={r.updatedAt} />
                    </Typography>
                  </Box>
                  <IconButton
                    onClick={() => setPrimary.mutate(r.id)}
                    aria-label={r.isPrimary ? "Primary resume" : "Set as primary"}
                    disabled={setPrimary.isPending}
                  >
                    {r.isPrimary ? <Star fontSize="md" /> : <StarBorder fontSize="md" />}
                  </IconButton>
                  <IconButton href={resumePdfUrl(r.id, r.updatedAt)} aria-label="Open PDF">
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
