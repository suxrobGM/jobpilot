"use client";

import type { ReactElement } from "react";
import type { PilotJournalEntry } from "@jobpilot/contracts/pilot";
import { Summarize } from "@mui/icons-material";
import { Card, CardContent, Stack, Typography } from "@mui/material";
import { RelativeTime } from "@/components/ui/display";
import { humanizeIsoInText } from "@/utils/format";
import { DigestCounts } from "../../journal/journal-row";

interface DigestCardProps {
  entry: PilotJournalEntry;
}

export function DigestCard(props: DigestCardProps): ReactElement {
  const { entry } = props;
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Summarize fontSize="sm" color="success" />
            <Typography variant="body2Strong" sx={{ flex: 1 }}>
              Morning summary
            </Typography>
            <RelativeTime value={entry.createdAt} sx={{ whiteSpace: "nowrap" }} />
          </Stack>
          <Typography variant="body2">{humanizeIsoInText(entry.summary)}</Typography>
          <DigestCounts detail={entry.detail} />
        </Stack>
      </CardContent>
    </Card>
  );
}
