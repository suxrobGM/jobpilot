import type { ReactNode } from "react";
import { Grid, Stack, Typography } from "@mui/material";
import { cacheLife } from "next/cache";
import { api } from "@/api/client";
import { JobCard } from "@/components/features/jobs";
import { LinkButton } from "@/components/ui/buttons";
import { Section } from "../section";
import { SectionEyebrow } from "../section-eyebrow";

const SHOWN = 6;

/**
 * Renders nothing when the index is empty or the API is down - never 500 over a decorative section.
 * Cached so the fetch runs inside the prerender instead of as a dynamic hole; the scope also covers
 * the cards' `Date.now()` ages, which go stale with the entry.
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
        <Stack spacing={1}>
          <SectionEyebrow>FRESH FROM THE FLEET</SectionEyebrow>
          <Typography variant="h2">Jobs the agents found this week.</Typography>
          <Typography variant="body2Muted">
            Scraped across every board, deduped into one listing each.
          </Typography>
        </Stack>
        <LinkButton href="/jobs" variant="outlined">
          Browse all jobs
        </LinkButton>
      </Stack>
      <Grid container spacing={2}>
        {jobs.map((job) => (
          <Grid key={job.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <JobCard job={job} maxTech={4} />
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
      // Logged, not swallowed: a down API used to look exactly like an empty index.
      console.error("live jobs strip: job index unavailable", error.value);
      return [];
    }
    return data?.items ?? [];
  } catch (error) {
    console.error("live jobs strip: job index unreachable", error);
    return [];
  }
}
