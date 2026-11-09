"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import { EMPTY_RESUME_DATA, type ResumeData } from "@jobpilot/contracts/resume";
import { resumeChannel } from "@jobpilot/contracts/sse";
import { Box, Stack, Tab, Tabs, useMediaQuery } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { resumeQueries } from "@/api/queries";
import type { ResumeDto } from "@/api/types";
import { DetailLoadFailure, DetailSkeleton } from "@/components/ui/feedback";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";
import { ExtractionCard } from "./detail/extraction-card";
import { ResumeHeader, ResumeNameField } from "./detail/header-bar";
import { ResumePdfPreview } from "./detail/pdf-preview";
import { ProfileMismatchCard } from "./detail/profile-mismatch-card";
import { SourceUploadCard } from "./detail/source-upload-card";
import { SuggestedRewriteCard } from "./detail/suggested-rewrite-card";
import { VariantsPanel } from "./detail/variants-panel";
import { ResumeEditor } from "./editor/resume-editor";

type DetailTab = "edit" | "preview" | "variants" | "source";

const EDITOR_WIDTH = 820;

interface EditTabProps {
  resume: ResumeDto;
}

function EditTab(props: EditTabProps): ReactElement {
  const { resume } = props;
  const [skippedExtraction, setSkippedExtraction] = useState(false);
  const initialData: ResumeData = resume.content ?? EMPTY_RESUME_DATA;
  // A source PDF with no structure yet means `extract-resume` is either running or worth retrying.
  const extracting = !resume.content && resume.sourceFilename !== null && !skippedExtraction;

  return (
    <Stack spacing={2}>
      <ProfileMismatchCard mismatches={resume.profileMismatches} />
      <SuggestedRewriteCard resume={resume} />
      <ResumeNameField resume={resume} />
      {extracting ? (
        <ExtractionCard resumeId={resume.id} onSkip={() => setSkippedExtraction(true)} />
      ) : (
        <ResumeEditor resumeId={resume.id} initialData={initialData} version={resume.version} />
      )}
    </Stack>
  );
}

interface ResumeDetailProps {
  resumeId: string;
}

/** The editor beside the PDF it produces; variants and the source PDF are tabs of their own. */
export function ResumeDetail(props: ResumeDetailProps): ReactElement {
  const { resumeId } = props;
  const [tab, setTab] = useState<DetailTab>("edit");
  // Below lg the two columns would each be too narrow, so the preview becomes a tab.
  const wide = useMediaQuery((theme) => theme.breakpoints.up("lg"));

  const detail = useQuery(resumeQueries.detail(resumeId));
  const variantCount = useQuery(resumeQueries.variants(resumeId)).data?.length ?? 0;

  const variantsKey = resumeQueries.variants(resumeId).queryKey;
  useLiveInvalidation(
    resumeChannel,
    { resumeId },
    {
      on: {
        "content.updated": [resumeQueries.detail(resumeId).queryKey],
        "variant.created": [variantsKey],
        "variant.deleted": [variantsKey],
      },
    },
  );

  if (detail.isPending) {
    return (
      <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
        <DetailSkeleton />
      </Box>
    );
  }
  const resume = detail.data;
  if (!resume) {
    return (
      <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
        <DetailLoadFailure
          noun="resume"
          error={detail.error}
          onRetry={() => void detail.refetch()}
        />
      </Box>
    );
  }

  // Widening the window while on Preview lands back on Edit, with the preview beside it.
  const shown: DetailTab = wide && tab === "preview" ? "edit" : tab;
  const preview = <ResumePdfPreview resumeId={resumeId} updatedAt={resume.updatedAt} />;

  const renderTab = (): ReactNode => {
    switch (shown) {
      case "edit":
        return <EditTab resume={resume} />;
      case "preview":
        return preview;
      case "variants":
        return <VariantsPanel resumeId={resumeId} resumeLabel={resume.label} />;
      case "source":
        return <SourceUploadCard resume={resume} />;
    }
  };

  return (
    <Stack direction="row" sx={{ flex: "1 1 0", minHeight: 0 }}>
      <ResumeHeader resume={resume} />
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Tabs
          value={shown}
          onChange={(_, value: DetailTab) => setTab(value)}
          variant="scrollable"
          sx={{ px: { xs: 1, sm: 2 }, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}
        >
          <Tab value="edit" label="Edit" />
          {!wide && <Tab value="preview" label="Preview" />}
          <Tab
            value="variants"
            label={variantCount > 0 ? `Variants (${variantCount})` : "Variants"}
          />
          <Tab value="source" label="Source PDF" />
        </Tabs>
        {shown === "preview" ? (
          preview
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 1.5, sm: 3 }, pt: 3 }}>
            <Box sx={{ maxWidth: EDITOR_WIDTH, mx: "auto" }}>{renderTab()}</Box>
          </Box>
        )}
      </Stack>
      {wide && (
        <Stack
          sx={(theme) => ({
            width: "min(48%, 800px)",
            flexShrink: 0,
            borderLeft: 1,
            borderColor: "divider",
            backgroundColor: theme.palette.surfaces.panel,
          })}
        >
          {preview}
        </Stack>
      )}
    </Stack>
  );
}
