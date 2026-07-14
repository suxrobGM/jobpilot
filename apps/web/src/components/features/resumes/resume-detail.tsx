"use client";

import type { ReactElement } from "react";
import { EMPTY_RESUME_DATA, type ResumeData } from "@jobpilot/contracts/resume";
import { LinearProgress, Stack, useMediaQuery, useTheme } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/api/hooks";
import { resumeQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { resumeChannel } from "@/lib/sse/channels/resume";
import { useSseChannel } from "@/lib/sse/client";
import { ResumeHeaderBar } from "./detail/header-bar";
import { ResumePdfPreview } from "./detail/pdf-preview";
import { SourceUploadCard } from "./detail/source-upload-card";
import { VariantsPanel } from "./detail/variants-panel";
import { ResumeEditor } from "./editor/resume-editor";

interface ResumeDetailProps {
  resumeId: string;
}

export function ResumeDetail(props: ResumeDetailProps): ReactElement {
  const { resumeId } = props;
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const queryClient = useQueryClient();

  const detail = useApiQuery(resumeQueries.detail(resumeId), {
    errorMessage: "Failed to load resume",
  });

  useSseChannel(
    resumeChannel,
    { resumeId },
    {
      on: {
        "content.updated": () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.resume.detail(resumeId) });
        },
        "variant.created": () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.resume.variants(resumeId) });
        },
      },
    },
  );

  if (detail.isLoading || !detail.data) return <LinearProgress />;
  const resume = detail.data;
  const initialData: ResumeData = resume.content ?? EMPTY_RESUME_DATA;

  return (
    <Stack direction={isDesktop ? "row" : "column"} spacing={3} sx={{ alignItems: "flex-start" }}>
      <Stack spacing={3} sx={{ flex: 1, minWidth: 0, width: "100%" }}>
        <ResumeHeaderBar resume={resume} />
        <SourceUploadCard resume={resume} />
        <ResumeEditor key={resume.version} resumeId={resumeId} initialData={initialData} />
        <VariantsPanel resumeId={resumeId} resumeLabel={resume.label} />
      </Stack>
      <Stack
        spacing={2}
        sx={{
          width: isDesktop ? 480 : "100%",
          position: isDesktop ? "sticky" : "static",
          top: isDesktop ? 16 : "auto",
        }}
      >
        <ResumePdfPreview resumeId={resumeId} updatedAt={resume.updatedAt} />
      </Stack>
    </Stack>
  );
}
