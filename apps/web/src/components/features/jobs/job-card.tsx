import type { ReactElement } from "react";
import { Card, CardActionArea, CardContent, Stack, Typography } from "@mui/material";
import type { JobListingSummaryDto } from "@/api/types";
import { jobHref } from "@/utils/routes";
import { jobMetaLine, RemoteBadge } from "./job-meta";
import { SkillChips } from "./skill-chips";

interface JobCardProps {
  job: JobListingSummaryDto;
}

export function JobCard(props: JobCardProps): ReactElement {
  const { job } = props;

  return (
    <Card variant="lift">
      {/* The theme's ButtonBase NextLink default makes `href` a client link, so this stays RSC. */}
      <CardActionArea href={jobHref(job.slug)} sx={{ height: "100%" }}>
        <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Stack spacing={0.5}>
            {/* Scraped titles can be one long unbroken token; on a phone that overflows the card. */}
            <Typography variant="h4" component="h3" sx={{ overflowWrap: "anywhere" }}>
              {job.title}
            </Typography>
            <Typography variant="body2Muted">{job.company}</Typography>
          </Stack>

          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}>
            <RemoteBadge job={job} />
            {job.location && <Typography variant="captionMuted">{job.location}</Typography>}
            {job.salary && <Typography variant="body2Strong">{job.salary}</Typography>}
          </Stack>

          <SkillChips skills={job.skills} max={4} />

          <Typography variant="captionMuted" sx={{ mt: "auto" }}>
            {jobMetaLine(job)}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
