import type { ReactElement } from "react";
import { Launch, PictureAsPdf } from "@mui/icons-material";
import { Button, Chip, Container, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { serverApi } from "@/api/server-api";
import { CoverLetterActions } from "@/components/features/cover-letters";
import { PageHeader, SectionCard } from "@/components/ui/layout";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CoverLetterDetailPage(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;

  const api = await serverApi();
  const { data: letter } = await api["cover-letters"]({ id }).get();
  if (!letter) {
    notFound();
  }

  return (
    <Container maxWidth="md" sx={{ gap: 2 }}>
      <PageHeader
        eyebrow={letter.company ?? "Cover letter"}
        title={letter.jobTitle ?? "Untitled role"}
        backHref="/cover-letters"
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
              href={`/api/cover-letters/${letter.id}/pdf`}
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
          Saved {new Date(letter.createdAt).toLocaleString()}
        </Typography>
      </SectionCard>
    </Container>
  );
}
