import type { ReactElement } from "react";
import { Launch, PictureAsPdf } from "@mui/icons-material";
import { Button, Chip, Typography } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { API_BASE_URL } from "@/api/base-url";
import { api } from "@/api/client";
import { getFetchOptions } from "@/api/server";
import { CoverLetterActions } from "@/components/features/cover-letters";
import { PageHeader, PageShell, SectionCard } from "@/components/ui/layout";
import { formatAbsoluteTime } from "@/utils/format";

export const metadata: Metadata = { title: "Cover letter" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CoverLetterDetailPage(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;

  const opts = await getFetchOptions();
  const { data: letter } = await api["cover-letters"]({ id }).get(opts);

  if (!letter) {
    notFound();
  }

  return (
    <PageShell maxWidth="md">
      <PageHeader
        eyebrow={letter.company ?? "Cover letter"}
        title={letter.jobTitle ?? "Untitled role"}
        backHref="/documents/cover-letters"
        actions={
          <>
            {letter.jobUrl && (
              <Button
                variant="outlined"
                startIcon={<Launch fontSize="md" />}
                component="a"
                href={letter.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open posting
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<PictureAsPdf fontSize="md" />}
              component="a"
              href={`${API_BASE_URL}/api/cover-letters/${letter.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open PDF
            </Button>
            <CoverLetterActions id={letter.id} />
          </>
        }
      />

      <SectionCard
        title="Cover letter"
        actions={
          <Chip
            size="small"
            label={letter.source}
            variant="outlined"
            sx={{ textTransform: "none" }}
          />
        }
      >
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
          {letter.content}
        </Typography>
        <Typography variant="captionMuted" sx={{ display: "block", mt: 2 }}>
          Saved {formatAbsoluteTime(letter.createdAt)}
        </Typography>
      </SectionCard>
    </PageShell>
  );
}
