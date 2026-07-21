import type { ReactElement } from "react";
import { Card, CardActionArea, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import type { JobListingSummaryDto } from "@/api/types";
import { fontFamilies } from "@/theme";
import { formatRelativeTime } from "@/utils/format";
import { TechChips } from "./tech-chips";

interface JobCardProps {
  job: JobListingSummaryDto;
  /** Cap the chips on dense grids; the detail page shows the full stack. */
  maxTech?: number;
}

/** A listing in the public index; the whole card is one link. */
export function JobCard(props: JobCardProps): ReactElement {
  const { job, maxTech = 5 } = props;

  return (
    <Card variant="lift">
      {/* CardActionArea is a ButtonBase, so the theme's NextLink default turns a plain href into a
          client-side link - no `component` prop, and this card stays a server component. */}
      <CardActionArea href={`/jobs/${job.slug}` as Route} sx={{ height: "100%" }}>
        <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Stack spacing={0.5}>
            {/* Scraped titles can be one long unbroken token; on a phone that overflows the card. */}
            <Typography variant="h4" component="h3" sx={{ overflowWrap: "anywhere" }}>
              {job.title}
            </Typography>
            <Typography variant="body2Muted">{job.company}</Typography>
          </Stack>

          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}>
            {job.remote && <Chip label="Remote" size="small" color="success" variant="outlined" />}
            {job.location && <Typography variant="captionMuted">{job.location}</Typography>}
            {job.salary && (
              <Typography
                variant="caption"
                sx={{ fontFamily: fontFamilies.mono, color: "accent.primary" }}
              >
                {job.salary}
              </Typography>
            )}
          </Stack>

          <TechChips tech={job.techStack} max={maxTech} />

          <Stack
            direction="row"
            sx={{ mt: "auto", flexWrap: "wrap", gap: 1, alignItems: "center" }}
          >
            <Typography variant="captionMuted">
              Seen {formatRelativeTime(job.lastSeenAt)} ago
            </Typography>
            {job.sourceCount > 1 && (
              <Typography variant="captionMuted">· {job.sourceCount} boards</Typography>
            )}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
