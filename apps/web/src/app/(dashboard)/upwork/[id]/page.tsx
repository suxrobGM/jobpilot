import { type ReactElement, Suspense } from "react";
import { Skeleton, Stack } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProposalDetail } from "@/components/features/upwork";

export const metadata: Metadata = { title: "Proposal" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProposalDetailPage(props: PageProps): ReactElement {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Proposal params={props.params} />
    </Suspense>
  );
}

function DetailSkeleton(): ReactElement {
  return (
    <Stack spacing={3}>
      <Skeleton variant="rounded" height={72} />
      <Skeleton variant="rounded" height={420} />
    </Stack>
  );
}

async function Proposal(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;

  if (!id) {
    notFound();
  }

  return <ProposalDetail id={id} />;
}
