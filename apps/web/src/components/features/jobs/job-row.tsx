import type { ReactElement } from "react";
import { ListItemButton, Stack, Typography } from "@mui/material";
import type { JobListingSummaryDto } from "@/api/types";
import { jobHref } from "@/utils/routes";
import { jobMetaLine, RemoteBadge } from "./job-meta";
import { SkillChips } from "./skill-chips";

interface JobRowProps {
  job: JobListingSummaryDto;
}

export function JobRow(props: JobRowProps): ReactElement {
  const { job } = props;

  return (
    // ListItemButton is a ButtonBase, so the theme's NextLink default makes `href` a client link.
    <ListItemButton
      href={jobHref(job.slug)}
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) auto" },
        columnGap: 3,
        rowGap: 1,
        alignItems: "start",
        paddingBlock: 1.75,
        paddingInline: { xs: 1.5, sm: 2.5 },
      }}
    >
      <Stack spacing={0.75} sx={{ minWidth: 0 }}>
        {/* Scraped titles can be one long unbroken token; on a phone that overflows the row. */}
        <Typography variant="h5" component="h3" sx={{ overflowWrap: "anywhere" }}>
          {job.title}
        </Typography>
        <Stack
          direction="row"
          sx={{ flexWrap: "wrap", columnGap: 1, rowGap: 0.5, alignItems: "center" }}
        >
          <Typography variant="body2">{job.company}</Typography>
          {job.location && <Typography variant="body2Muted">{job.location}</Typography>}
          <RemoteBadge job={job} />
        </Stack>
        <SkillChips skills={job.skills} max={4} />
      </Stack>

      <Stack
        direction={{ xs: "row", sm: "column" }}
        sx={{
          flexWrap: "wrap",
          columnGap: 1.5,
          rowGap: 0.5,
          alignItems: { xs: "baseline", sm: "flex-end" },
          textAlign: { sm: "right" },
        }}
      >
        {job.salary && <Typography variant="body2Strong">{job.salary}</Typography>}
        <Typography variant="captionMuted">{jobMetaLine(job)}</Typography>
      </Stack>
    </ListItemButton>
  );
}
