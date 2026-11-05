import type { ReactNode } from "react";
import { Grid, Stack } from "@mui/material";
import { cacheLife } from "next/cache";
import { api } from "@/api/client";
import { JobCard } from "@/components/features/jobs";
import { LinkButton } from "@/components/ui/buttons";
import { Section } from "../section";
import { SectionHeading } from "../section-heading";

const SHOWN = 6;

/**
 * A decorative section must never 500, so failure renders nothing. Cached to run in the prerender;
 * the cards' `Date.now()` ages go stale with the entry.
 */
export async function LiveJobsStrip(): Promise<ReactNode> {
  "use cache";
  cacheLife("hours");

  const jobs = await recentJobs();

  if (jobs.length === 0) {
    return null;
  }

  return (
    <Section>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ mb: 4, alignItems: { sm: "flex-end" }, justifyContent: "space-between" }}
      >
        <SectionHeading
          eyebrow="Job listings"
          title="Recently found jobs."
          lead="Every job a JobPilot agent finds is listed once, with links to each board it appeared on."
        />
        <LinkButton href="/jobs" variant="outlined" sx={{ flexShrink: 0 }}>
          Browse all jobs
        </LinkButton>
      </Stack>
      <Grid container spacing={2}>
        {jobs.map((job) => (
          <Grid key={job.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <JobCard job={job} />
          </Grid>
        ))}
      </Grid>
    </Section>
  );
}

async function recentJobs() {
  try {
    const { data, error } = await api.public.jobs.get({ query: { page: 1, limit: SHOWN } });
    if (error) {
      // Log it, or a down API looks exactly like an empty index.
      console.error("live jobs strip: job index unavailable", error.value);
      return [];
    }
    return data?.items ?? [];
  } catch (error) {
    console.error("live jobs strip: job index unreachable", error);
    return [];
  }
}
