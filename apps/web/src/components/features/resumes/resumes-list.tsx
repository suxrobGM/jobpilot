"use client";

import { type ReactElement, useState } from "react";
import { workspaceChannel } from "@jobpilot/contracts/sse";
import { Add, Description, PictureAsPdf, Star, StarBorder } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { invalidations, resumeQueries } from "@/api/queries";
import { resumePdfUrl } from "@/api/resume-urls";
import { useApiMutation } from "@/api/use-api-mutation";
import { RelativeTime } from "@/components/ui/display";
import { EmptyState, QuerySection } from "@/components/ui/feedback";
import { FileUpload } from "@/components/ui/form";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";
import { MAX_RESUME_BYTES } from "@/lib/constants";
import { useAgent, useAgentAvailable } from "@/providers/agent-provider";
import { useToast } from "@/providers/toast-provider";
import { plural } from "@/utils/format";
import { resumeHref } from "@/utils/routes";
import { NewResumeDialog } from "./new-resume-dialog";
import { useSetPrimaryResume } from "./use-set-primary-resume";

export function ResumesList(): ReactElement {
  useLiveInvalidation(workspaceChannel, null, {
    on: { "resume.updated": [resumeQueries.list().queryKey] },
  });

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
      // Needs the local agent, so on mobile the upload waits for a desktop session, as in onboarding.
      if (agentAvailable) {
        void agent.injectSkill("extract-resume", id);
      }
      // Extraction progress only shows on the detail page, not on a row saying "No structure".
      router.push(resumeHref(id));
    },
  });

  const setPrimary = useSetPrimaryResume();

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

      <QuerySection
        query={list}
        errorTitle="Couldn't load your resumes."
        isEmpty={rows.length === 0}
        empty={
          <EmptyState
            title="No resumes yet"
            description="Upload a PDF to bootstrap your first base resume, or start blank and fill out the editor."
          />
        }
      >
        <Stack spacing={1}>
          {rows.map((r) => (
            <Card key={r.id} sx={{ backgroundColor: r.isPrimary ? "action.selected" : undefined }}>
              <CardContent>
                <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                  <Description fontSize="lg" sx={{ color: "text.secondary" }} />
                  <Box
                    component={Link}
                    href={resumeHref(r.id)}
                    sx={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Typography variant="body1Strong">{r.label}</Typography>
                      {r.isPrimary && <Chip label="Primary" color="primary" />}
                      {!r.hasData && <Chip label="No structure" variant="outlined" />}
                      {r.variantCount > 0 && (
                        <Chip label={plural(r.variantCount, "variant")} variant="outlined" />
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
      </QuerySection>

      <NewResumeDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Stack>
  );
}
