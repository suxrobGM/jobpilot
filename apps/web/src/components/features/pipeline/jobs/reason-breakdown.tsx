"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { Box, Button, Chip, Collapse, Grid, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { feedQueries } from "@/api/queries";
import type { JobReasonDto } from "@/api/types";
import { SectionCard } from "@/components/ui/layout";

interface ReasonCount {
  reason: string;
  count: number;
}

/** The server groups raw strings, but "(35 < 50)" and "(40 < 50)" are one cause, so strip the tail. */
function groupReasons(
  rows: ReadonlyArray<JobReasonDto>,
  kind: JobReasonDto["kind"],
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

interface ReasonListProps {
  title: string;
  reasons: ReasonCount[];
}

function ReasonList(props: ReasonListProps): ReactElement {
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
                <Chip label={r.count} variant="outlined" />
              </Stack>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

interface ReasonBreakdownProps {
  feedId: string;
}

/** Groups one search's skip and fail reasons by frequency, so the user sees why jobs dropped out. */
export function ReasonBreakdown(props: ReasonBreakdownProps): ReactNode {
  const { feedId } = props;
  const [open, setOpen] = useState(true);

  const rows = useQuery(feedQueries.reasons(feedId)).data ?? [];
  const skipped = groupReasons(rows, "skipped");
  const failed = groupReasons(rows, "failed");
  const total = (reasons: ReasonCount[]) => reasons.reduce((sum, r) => sum + r.count, 0);

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
            <ReasonList title={`Skipped (${total(skipped)})`} reasons={skipped} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <ReasonList title={`Failed (${total(failed)})`} reasons={failed} />
          </Grid>
        </Grid>
      </Collapse>
    </SectionCard>
  );
}
