import type { ReactElement, ReactNode } from "react";
import { OpenInNew } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import type { JobListingDto } from "@/api/types";
import { BackLink, LinkButton } from "@/components/ui/buttons";
import { formatDate, formatRelativeTime } from "@/utils/format";
import { RemoteBadge } from "./job-meta";
import { JobSources } from "./job-sources";
import { SkillChips } from "./skill-chips";

interface JobDetailProps {
  job: JobListingDto;
}

export function JobDetail(props: JobDetailProps): ReactElement {
  const { job } = props;

  return (
    <Stack spacing={4}>
      <Stack spacing={3}>
        <BackLink href="/jobs">All jobs</BackLink>
        <JobHeader job={job} />
      </Stack>

      <Grid container spacing={{ xs: 3, md: 4 }} sx={{ alignItems: "flex-start" }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={4}>
            {job.descriptionExcerpt && (
              <Section title="About the role">
                {/* pre-line alone still only wraps at whitespace: one long scraped token would overflow. */}
                <Typography
                  variant="body1Muted"
                  sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}
                >
                  {job.descriptionExcerpt}
                </Typography>
              </Section>
            )}

            {job.requirements.length > 0 && (
              <Section title="Requirements">
                <BulletList items={job.requirements} />
              </Section>
            )}

            {job.responsibilities.length > 0 && (
              <Section title="What you'll do">
                <BulletList items={job.responsibilities} />
              </Section>
            )}

            <Divider />

            <Section title="Where this was posted">
              <JobSources sources={job.sources} />
            </Section>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <ApplyCard />
        </Grid>
      </Grid>
    </Stack>
  );
}

function JobHeader(props: JobDetailProps): ReactElement {
  const { job } = props;
  const latest = job.sources[0];

  return (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <Typography variant="displayMd" component="h1" sx={{ overflowWrap: "anywhere" }}>
          {job.title}
        </Typography>
        <Typography variant="h4" component="p" sx={{ color: "text.secondary" }}>
          {job.company}
        </Typography>
      </Stack>

      <Stack
        direction="row"
        sx={{ flexWrap: "wrap", columnGap: 1.5, rowGap: 1, alignItems: "center" }}
      >
        {job.salary && <Typography variant="body1Strong">{job.salary}</Typography>}
        {job.location && <Typography variant="body2Muted">{job.location}</Typography>}
        {job.employmentType && <Typography variant="body2Muted">{job.employmentType}</Typography>}
        <RemoteBadge job={job} />
        {job.yearsExperience !== null && (
          <Chip label={`${job.yearsExperience}+ years`} variant="outlined" />
        )}
      </Stack>

      <SkillChips skills={job.skills} linked />

      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ columnGap: 2, rowGap: 1.5, alignItems: { xs: "stretch", sm: "center" } }}
      >
        {latest && <ApplyOnBoard source={latest} />}
        <Typography variant="captionMuted">
          Seen {formatRelativeTime(job.lastSeenAt)} ago · first found {formatDate(job.firstSeenAt)}
        </Typography>
      </Stack>
    </Stack>
  );
}

interface ApplyOnBoardProps {
  source: JobListingDto["sources"][number];
}

/** The most recent sighting is the link most likely to still be open. */
function ApplyOnBoard(props: ApplyOnBoardProps): ReactElement {
  const { source } = props;
  return (
    // The theme routes ButtonBase hrefs through next/link, which is wrong for an off-site URL.
    <Button
      variant="contained"
      href={source.url}
      LinkComponent="a"
      endIcon={<OpenInNew fontSize="sm" />}
    >
      {source.board ? `Apply on ${source.board}` : "Apply on the original posting"}
    </Button>
  );
}

interface SectionProps {
  title: string;
  children: ReactNode;
}

function Section(props: SectionProps): ReactElement {
  const { title, children } = props;
  return (
    <Stack spacing={1.5}>
      <Typography variant="h4" component="h2">
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

interface BulletListProps {
  items: string[];
}

function BulletList(props: BulletListProps): ReactElement {
  const { items } = props;
  return (
    <Box component="ul" sx={{ m: 0, pl: 3, display: "grid", gap: 1 }}>
      {items.map((item) => (
        <Typography component="li" key={item} variant="body1Muted">
          {item}
        </Typography>
      ))}
    </Box>
  );
}

/** The agent pitch sits beside the board link, not above it: applying on the board comes first. */
function ApplyCard(): ReactElement {
  return (
    <Card variant="accent">
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="h4" component="h2">
            Apply with JobPilot
          </Typography>
          <Typography variant="body2Muted">
            Your own AI agent tailors your resume and fills the form - on your machine, on your
            Claude or Codex plan.
          </Typography>
          <LinkButton href="/install" variant="outlined" fullWidth>
            Get the agent
          </LinkButton>
        </Stack>
      </CardContent>
    </Card>
  );
}
