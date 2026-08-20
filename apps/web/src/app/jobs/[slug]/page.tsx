import { cache, type ReactElement } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/api/client";
import { dataOrThrow } from "@/api/error";
import { getPublicFetchOptions } from "@/api/server";
import { JobDetail } from "@/components/features/jobs";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbLd, jobPostingLd } from "@/lib/structured-data";

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
      `${job.title} at ${job.company}. Apply with your own JobPilot AI agent.`,
    alternates: { canonical: `/jobs/${job.slug}` },
    openGraph: { title, type: "article" },
  };
}

export default async function JobPage(props: JobPageProps): Promise<ReactElement> {
  const { slug } = await props.params;
  const job = await getJob(slug);
  if (!job) {
    notFound();
  }

  return (
    <>
      <JsonLd
        data={[
          jobPostingLd({ ...job, firstSeenAt: new Date(job.firstSeenAt) }),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Jobs", path: "/jobs" },
            { name: job.title, path: `/jobs/${job.slug}` },
          ]),
        ]}
      />
      <JobDetail job={job} />
    </>
  );
}
