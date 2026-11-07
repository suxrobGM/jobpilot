import type { ReactElement } from "react";
import type { PilotJournalEntry } from "@jobpilot/contracts/pilot";
import { Typography } from "@mui/material";
import { humanizeIsoInText } from "@/utils/format";
import { PilotTurn } from "./pilot-turn";

/** Every count in the digest is zero, so the whole summary says nothing. */
function isQuiet(entry: PilotJournalEntry): boolean {
  return Object.values(entry.detail).every((value) => typeof value !== "number" || value === 0);
}

interface DigestTurnProps {
  entry: PilotJournalEntry;
}

/** The morning summary, said by the pilot; a day with nothing to report folds to one line. */
export function DigestTurn(props: DigestTurnProps): ReactElement {
  const { entry } = props;
  if (isQuiet(entry)) {
    return (
      <PilotTurn at={entry.createdAt}>
        <Typography variant="body1Muted">
          Quiet day. Nothing new since yesterday morning.
        </Typography>
      </PilotTurn>
    );
  }
  return (
    <PilotTurn at={entry.createdAt}>
      <Typography variant="body1">{humanizeIsoInText(entry.summary)}</Typography>
    </PilotTurn>
  );
}
