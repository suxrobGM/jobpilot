"use client";

import type { ReactElement } from "react";
import type { PilotJournalEntry } from "@jobpilot/contracts/pilot";
import { Stack, Typography } from "@mui/material";
import { RelativeTime } from "@/components/ui/display";
import { humanizeIsoInText } from "@/utils/format";
import { KIND_META } from "../../journal/journal-row";
import { TURN_INDENT } from "./pilot-turn";

interface NoteRowProps {
  entry: PilotJournalEntry;
  /** How many identical notes in a row this line stands for. */
  repeats: number;
}

/** A journal line outside any run: host reports, restarts, breaks. */
export function NoteRow(props: NoteRowProps): ReactElement {
  const { entry, repeats } = props;
  const Icon = KIND_META[entry.kind].icon;
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "center", pl: { xs: 0, sm: TURN_INDENT } }}
    >
      <Icon fontSize="sm" color="disabled" />
      <Typography variant="captionMuted" sx={{ flex: 1, minWidth: 0 }}>
        {humanizeIsoInText(entry.summary)}
        {repeats > 1 && ` (${repeats} times)`}
      </Typography>
      <RelativeTime value={entry.createdAt} sx={{ whiteSpace: "nowrap" }} />
    </Stack>
  );
}
