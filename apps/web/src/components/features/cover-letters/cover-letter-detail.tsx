"use client";

import type { ReactElement } from "react";
import { Launch, PictureAsPdf } from "@mui/icons-material";
import { Button, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/api/base-url";
import { isNotFound } from "@/api/error";
import { coverLetterQueries } from "@/api/queries";
import { StatusChip } from "@/components/ui/display";
import { DetailSkeleton, EmptyState, QueryError } from "@/components/ui/feedback";
import { PageHeader, SectionCard } from "@/components/ui/layout";
import { formatAbsoluteTime } from "@/utils/format";
import { CoverLetterActions } from "./cover-letter-actions";

interface CoverLetterDetailProps {
  id: string;
}

export function CoverLetterDetail(props: CoverLetterDetailProps): ReactElement {
  const { id } = props;
  const query = useQuery(coverLetterQueries.detail(id));
  const letter = query.data;

  if (query.isPending) {
    return <DetailSkeleton heights={[72, 480]} />;
  }

  if (!letter) {
    return isNotFound(query.error) ? (
      <EmptyState
        title="Cover letter not found"
        description="It may have been deleted, or the link is incorrect."
      />
    ) : (
      <QueryError title="Couldn't load this cover letter." onRetry={() => void query.refetch()} />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={letter.company ?? "Cover letter"}
        title={letter.jobTitle ?? "Untitled role"}
        backHref="/documents/cover-letters"
        actions={
          <>
            {letter.jobUrl && (
              <Button variant="outlined" startIcon={<Launch fontSize="md" />} href={letter.jobUrl}>
                Open posting
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<PictureAsPdf fontSize="md" />}
              href={`${API_BASE_URL}/api/cover-letters/${letter.id}/pdf`}
            >
              Open PDF
            </Button>
            <CoverLetterActions id={letter.id} />
          </>
        }
      />

      <SectionCard
        title="Cover letter"
        actions={<StatusChip domain="source" value={letter.source} />}
      >
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
          {letter.content}
        </Typography>
        <Typography variant="captionMuted" sx={{ display: "block", mt: 2 }}>
          Saved {formatAbsoluteTime(letter.createdAt)}
        </Typography>
      </SectionCard>
    </>
  );
}
