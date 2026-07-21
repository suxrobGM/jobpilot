import type { ReactElement } from "react";
import { Box, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import type { JobListingDto } from "@/api/types";
import { LinkButton } from "@/components/ui/buttons";
import { ExternalLink } from "@/components/ui/display";
import { fontFamilies } from "@/theme";
import { formatDate, formatRelativeTime } from "@/utils/format";
import { TechChips } from "./tech-chips";

interface JobDetailProps {
  job: JobListingDto;
}

export function JobDetail(props: JobDetailProps): ReactElement {
  const { job } = props;

  return (
    <Stack spacing={4}>
      <Stack spacing={1.5}>
        <Typography variant="displayMd" sx={{ overflowWrap: "anywhere" }}>
          {job.title}
        </Typography>
        <Typography variant="h4" component="h2" sx={{ color: "text.secondary" }}>
          {job.company}
        </Typography>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          {job.remote && <Chip label="Remote" size="small" color="success" variant="outlined" />}
          {job.location && <Typography variant="body2Muted">{job.location}</Typography>}
          {job.employmentType && <Typography variant="body2Muted">{job.employmentType}</Typography>}
          {job.salary && (
            <Typography sx={{ fontFamily: fontFamilies.mono, color: "accent.primary" }}>
              {job.salary}
            </Typography>
          )}
        </Stack>
      </Stack>

      <Card variant="accent">
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
          >
            <Stack spacing={0.5}>
              <Typography variant="h4" component="h3">
                Apply with JobPilot
              </Typography>
              <Typography variant="body2Muted">
                Your own AI agent tailors your resume and fills the form - on your machine, on your
                Claude or Codex plan.
              </Typography>
            </Stack>
            <LinkButton href="/install" variant="contained">
              Get the agent
            </LinkButton>
          </Stack>
        </CardContent>
      </Card>

      {job.techStack.length > 0 && (
        <Stack spacing={1.5}>
          <Typography variant="h4" component="h3">
            Tech stack
          </Typography>
          <TechChips tech={job.techStack} linked />
        </Stack>
      )}

      {job.descriptionExcerpt && (
        <Stack spacing={1.5}>
          <Typography variant="h4" component="h3">
            About the role
          </Typography>
          {/* pre-line alone still only wraps at whitespace: one long scraped token would overflow. */}
          <Typography
            variant="body1Muted"
            sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}
          >
            {job.descriptionExcerpt}
          </Typography>
        </Stack>
      )}

      <Divider />

      <Stack spacing={1.5}>
        <Typography variant="h4" component="h3">
          Where this was posted
        </Typography>
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1 }}>
          {job.sources.map((source) => (
            <Box
              component="li"
              key={source.url}
              sx={{ fontFamily: fontFamilies.mono, fontSize: "0.8rem", wordBreak: "break-all" }}
            >
              <ExternalLink href={source.url}>{source.board ?? source.url}</ExternalLink>
            </Box>
          ))}
        </Box>
        {job.sourceCount > 1 && (
          <Typography variant="captionMuted">
            The same posting was found on {job.sourceCount} boards and deduped into this page.
          </Typography>
        )}
        <Typography variant="captionMuted">
          Seen {formatRelativeTime(job.lastSeenAt)} ago · first found {formatDate(job.firstSeenAt)}
        </Typography>
      </Stack>
    </Stack>
  );
}
