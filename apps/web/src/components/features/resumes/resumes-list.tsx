"use client";

import { type ReactElement, useState } from "react";
import { workspaceChannel } from "@jobpilot/contracts/sse";
import { Add, Description, PictureAsPdf, Star, StarBorder } from "@mui/icons-material";
import { Button, Chip } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { invalidations, resumeQueries } from "@/api/queries";
import { resumePdfUrl } from "@/api/resume-urls";
import { useApiMutation } from "@/api/use-api-mutation";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { TooltipIconButton } from "@/components/ui/buttons";
import { ListCard, ListCell, ListHeader, ListLead, ListRow } from "@/components/ui/data";
import { RelativeTime } from "@/components/ui/display";
import { EmptyState, QuerySection } from "@/components/ui/feedback";
import { FileUpload } from "@/components/ui/form";
import { PageActions } from "@/components/ui/layout";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";
import { MAX_RESUME_BYTES } from "@/lib/constants";
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
  const request = useCreateRequest();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  const list = useQuery(resumeQueries.list());

  const upload = useApiMutation((file: File) => api.resumes.upload.post({ file }), {
    successMessage: "Resume uploaded",
    invalidate: invalidations.resume,
    onSuccess: ({ id }) => {
      request.mutate({ taskType: "resume.extract", payload: { resumeId: id, force: false } });
      // Extraction progress only shows on the detail page, not on a row saying "No structure".
      router.push(resumeHref(id));
    },
  });

  const setPrimary = useSetPrimaryResume();

  const rows = list.data ?? [];

  return (
    <>
      <PageActions>
        <Button variant="outlined" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
          Start blank
        </Button>
        <FileUpload
          accept="application/pdf"
          maxBytes={MAX_RESUME_BYTES}
          loading={upload.isPending}
          label="Upload PDF"
          buttonProps={{ variant: "contained", size: "medium" }}
          onFile={(f) => upload.mutate(f)}
          onError={(msg) => toast.error(msg)}
        />
      </PageActions>

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
        <ListCard
          header={
            <ListHeader>
              Base resumes; the pilot tailors a variant of one for each application
            </ListHeader>
          }
        >
          {rows.map((resume) => (
            <ListRow
              key={resume.id}
              href={resumeHref(resume.id)}
              lead={
                <ListLead>
                  <Description fontSize="md" />
                </ListLead>
              }
              title={resume.label}
              tags={
                <>
                  {resume.isPrimary && <Chip label="Primary" color="primary" />}
                  {!resume.hasData && <Chip label="No structure" variant="outlined" />}
                </>
              }
              meta={resume.sourceFilename ?? "No source PDF"}
              columns={
                <ListCell width={110}>
                  {resume.variantCount > 0 ? plural(resume.variantCount, "variant") : "No variants"}
                </ListCell>
              }
              actions={
                <>
                  <TooltipIconButton
                    title={resume.isPrimary ? "Primary resume" : "Make primary"}
                    size="small"
                    disabled={resume.isPrimary || setPrimary.isPending}
                    onClick={() => setPrimary.mutate(resume.id)}
                  >
                    {resume.isPrimary ? <Star fontSize="sm" /> : <StarBorder fontSize="sm" />}
                  </TooltipIconButton>
                  <TooltipIconButton
                    title="Open PDF"
                    size="small"
                    href={resumePdfUrl(resume.id, resume.updatedAt)}
                  >
                    <PictureAsPdf fontSize="sm" />
                  </TooltipIconButton>
                </>
              }
              time={<RelativeTime value={resume.updatedAt} />}
            />
          ))}
        </ListCard>
      </QuerySection>

      <NewResumeDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
