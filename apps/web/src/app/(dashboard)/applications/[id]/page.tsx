import { type ReactElement, Suspense } from "react";
import { Skeleton, Stack } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplicationDetail } from "@/components/features/applications";

export const metadata: Metadata = { title: "Application" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ApplicationDetailPage(props: PageProps): ReactElement {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Application params={props.params} />
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

async function Application(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;

  if (!id) {
    notFound();
  }

  return <ApplicationDetail applicationId={id} />;
}
