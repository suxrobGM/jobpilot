import { cache, type ReactElement, type ReactNode, Suspense } from "react";
import { Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/api/client";
import { dataOrThrow } from "@/api/error";
import { getPublicFetchOptions } from "@/api/server";
import { JobDetail, JobList } from "@/components/features/jobs";
import { JsonLd } from "@/components/seo/json-ld";
import { DetailSkeleton, TableSkeleton } from "@/components/ui/feedback";
import { jobPostingLd } from "@/lib/job-posting-ld";
import { breadcrumbLd } from "@/lib/structured-data";

interface JobPageProps {
  params: Promise<{ slug: string }>;
}

/** Called by both generateMetadata and the page; `cache` collapses that to one request. */
const getJob = cache(async (slug: string) =>
  dataOrThrow(
    await api.public.jobs({ slug }).get(await getPublicFetchOptions()),
    "Couldn't load this job listing",
  ),
);

export async function generateMetadata(props: JobPageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const job = await getJob(slug);
  if (!job) {
    return { title: "Job not found" };
  }

  const where = job.remote ? "Remote" : (job.location ?? "");
  const title = `${job.title} at ${job.company}${where ? ` · ${where}` : ""}`;

  return {
    title,
    description:
      job.descriptionExcerpt ??
      `${job.title} at ${job.company}. Let your JobPilot agent apply for you.`,
    alternates: { canonical: `/jobs/${job.slug}` },
    openGraph: { title, type: "article" },
  };
}

export default function JobPage(props: JobPageProps): ReactElement {
  return (
    <Stack spacing={6}>
      <Suspense fallback={<DetailSkeleton heights={[220, 400]} />}>
        <Job params={props.params} />
      </Suspense>
      <Suspense fallback={<TableSkeleton />}>
        <SimilarJobs params={props.params} />
      </Suspense>
    </Stack>
  );
}

async function Job(props: JobPageProps): Promise<ReactElement> {
  const { slug } = await props.params;
  const job = await getJob(slug);
  if (!job) {
    notFound();
  }

  const posting = jobPostingLd(job);
  const breadcrumb = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Jobs", path: "/jobs" },
    { name: job.title, path: `/jobs/${job.slug}` },
  ]);

  return (
    <>
      <JsonLd data={posting ? [posting, breadcrumb] : [breadcrumb]} />
      <JobDetail job={job} />
    </>
  );
}

/** Renders nothing on failure or no match: it is a browse aid, not part of the listing. */
async function SimilarJobs(props: JobPageProps): Promise<ReactNode> {
  const { slug } = await props.params;
  const { data } = await api.public.jobs({ slug }).similar.get(await getPublicFetchOptions());
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Stack component="section" spacing={2}>
      <Typography variant="h3" component="h2">
        Similar jobs
      </Typography>
      <JobList jobs={data} />
    </Stack>
  );
}
