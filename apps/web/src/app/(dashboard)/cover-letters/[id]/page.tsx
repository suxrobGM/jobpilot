import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { CoverLetterDetail } from "@/components/features/cover-letters";
import { DetailSkeleton } from "@/components/ui/feedback";
import { PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Cover letter" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CoverLetterDetailPage(props: PageProps): ReactElement {
  return (
    <PageShell maxWidth="md">
      <Suspense fallback={<DetailSkeleton heights={[72, 480]} />}>
        <CoverLetter params={props.params} />
      </Suspense>
    </PageShell>
  );
}

async function CoverLetter(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;
  return <CoverLetterDetail id={id} />;
}
