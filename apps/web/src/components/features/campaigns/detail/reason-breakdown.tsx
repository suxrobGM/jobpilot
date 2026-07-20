"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { Box, Button, Chip, Collapse, Grid, Stack, Typography } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { campaignQueries } from "@/api/queries";
import { type CampaignDetailDto, type CampaignJobReasonDto, jobSummary } from "@/api/types";
import { SectionCard } from "@/components/ui/layout";

interface ReasonCount {
  reason: string;
  count: number;
}

/** Re-collapses the server's per-reason groups: it counts raw strings, but score-threshold
 * variants ("(35 < 50)", "(40 < 50)") read as one cause, so strip the numeric tail and sum. */
function groupReasons(
  rows: ReadonlyArray<CampaignJobReasonDto>,
  kind: CampaignJobReasonDto["kind"],
): ReasonCount[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (row.kind !== kind) {
      continue;
    }
    const reason = row.reason.replace(/\s*\([^)]*\d[^)]*\)\s*$/, "").trim() || "Unspecified";
    counts.set(reason, (counts.get(reason) ?? 0) + row.count);
  }

  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

function ReasonList(props: { title: string; reasons: ReasonCount[] }): ReactElement {
  const { title, reasons } = props;
  return (
    <Stack spacing={1}>
      <Typography variant="overlineMuted">{title}</Typography>
      {reasons.length === 0 ? (
        <Typography variant="captionMuted">None</Typography>
      ) : (
        <Box sx={{ maxHeight: { xs: 320, sm: 420 }, overflowY: "auto", pr: 1 }}>
          <Stack spacing={1}>
            {reasons.map((r) => (
              <Stack
                key={r.reason}
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <Typography variant="body2" sx={{ minWidth: 0, wordBreak: "break-word" }}>
                  {r.reason}
                </Typography>
                <Chip size="small" label={r.count} variant="outlined" />
              </Stack>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

interface CampaignReasonBreakdownProps {
  campaign: CampaignDetailDto;
}

/** Groups skip/fail reasons by frequency so the user can see why jobs dropped out. */
export function CampaignReasonBreakdown(props: CampaignReasonBreakdownProps): ReactNode {
  const { campaign } = props;
  const [open, setOpen] = useState(true);

  const reasons = useApiQuery(campaignQueries.reasons(campaign.campaignId));
  const rows = reasons.data ?? [];
  const skipped = groupReasons(rows, "skipped");
  const failed = groupReasons(rows, "failed");
  const summary = jobSummary(campaign);

  if (skipped.length === 0 && failed.length === 0) {
    return null;
  }

  return (
    <SectionCard
      title="Why jobs dropped out"
      actions={
        <Button
          size="small"
          variant="text"
          startIcon={open ? <ExpandLess fontSize="sm" /> : <ExpandMore fontSize="sm" />}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "Show"}
        </Button>
      }
    >
      <Collapse in={open}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <ReasonList
              title={`Skipped (${summary?.skipped ?? skipped.length})`}
              reasons={skipped}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <ReasonList title={`Failed (${summary?.failed ?? failed.length})`} reasons={failed} />
          </Grid>
        </Grid>
      </Collapse>
    </SectionCard>
  );
}
