"use client";

import { type ReactElement, useState } from "react";
import { EMPTY_RESUME_DATA, type ResumeData } from "@jobpilot/contracts/resume";
import { resumeChannel } from "@jobpilot/contracts/sse";
import { Box, LinearProgress, Stack } from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { resumeQueries } from "@/api/queries";
import { QueryError } from "@/components/ui/feedback";
import { type SectionAnchor, SectionLayout } from "@/components/ui/layout";
import { useSseChannel } from "@/lib/sse/client";
import { ExtractionCard } from "./detail/extraction-card";
import { ResumeHeaderBar } from "./detail/header-bar";
import { ResumePdfPreview } from "./detail/pdf-preview";
import { ProfileMismatchCard } from "./detail/profile-mismatch-card";
import { SourceUploadCard } from "./detail/source-upload-card";
import { SuggestedRewriteCard } from "./detail/suggested-rewrite-card";
import { VariantsPanel } from "./detail/variants-panel";
import { ResumeEditor } from "./editor/resume-editor";
import { RESUME_SECTIONS } from "./editor/sections";

interface ResumeDetailProps {
  resumeId: string;
}

function anchorsFor(data: ResumeData): SectionAnchor[] {
  return [
    ...RESUME_SECTIONS.map((section) => ({
      id: section.id,
      label: section.label,
      empty: section.summary(data) === "empty",
    })),
    { id: "source", label: "Source PDF" },
    { id: "variants", label: "Variants" },
  ];
}

export function ResumeDetail(props: ResumeDetailProps): ReactElement {
  const { resumeId } = props;
  const queryClient = useQueryClient();
  const [skippedExtraction, setSkippedExtraction] = useState(false);

  const detail = useQuery(resumeQueries.detail(resumeId));

  useSseChannel(
    resumeChannel,
    { resumeId },
    {
      on: {
        "content.updated": () => {
          void queryClient.invalidateQueries({ queryKey: resumeQueries.detail(resumeId).queryKey });
        },
        "variant.created": () => {
          void queryClient.invalidateQueries({
            queryKey: resumeQueries.variants(resumeId).queryKey,
          });
        },
        "variant.deleted": () => {
          void queryClient.invalidateQueries({
            queryKey: resumeQueries.variants(resumeId).queryKey,
          });
        },
      },
    },
  );

  if (detail.isLoading) {
    return <LinearProgress />;
  }
  const resume = detail.data;
  if (!resume) {
    return <QueryError title="Couldn't load this resume." onRetry={() => void detail.refetch()} />;
  }
  const initialData: ResumeData = resume.content ?? EMPTY_RESUME_DATA;
  // A source PDF with no structure yet means `extract-resume` is either running or worth retrying.
  const extracting = !resume.content && resume.sourceFilename !== null && !skippedExtraction;

  return (
    <Stack direction={{ xs: "column", lg: "row" }} spacing={3} sx={{ alignItems: "flex-start" }}>
      <Stack spacing={3} sx={{ flex: 1, minWidth: 0, width: "100%" }}>
        <ResumeHeaderBar resume={resume} />
        <ProfileMismatchCard mismatches={resume.profileMismatches} />
        <SuggestedRewriteCard resume={resume} />

        {extracting ? (
          <ExtractionCard resumeId={resumeId} onSkip={() => setSkippedExtraction(true)} />
        ) : (
          <SectionLayout anchors={anchorsFor(initialData)}>
            <Stack spacing={3}>
              <ResumeEditor
                resumeId={resumeId}
                initialData={initialData}
                version={resume.version}
              />
              <Box data-section-id="source">
                <SourceUploadCard resume={resume} />
              </Box>
              <Box data-section-id="variants">
                <VariantsPanel resumeId={resumeId} resumeLabel={resume.label} />
              </Box>
            </Stack>
          </SectionLayout>
        )}
      </Stack>

      <Box
        sx={{
          width: { xs: "100%", lg: 380, xl: 480 },
          flexShrink: 0,
          position: { lg: "sticky" },
          top: { lg: 16 },
        }}
      >
        <ResumePdfPreview resumeId={resumeId} updatedAt={resume.updatedAt} />
      </Box>
    </Stack>
  );
}
