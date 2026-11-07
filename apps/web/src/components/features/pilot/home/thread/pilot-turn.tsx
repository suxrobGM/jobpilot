import type { ReactElement, ReactNode } from "react";
import { Stack, Typography } from "@mui/material";

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

interface PilotTurnProps {
  /** A clock time, or a label such as a time span; none for the live lines at the bottom. */
  at?: Date | string;
  children: ReactNode;
}

/** The header names the pilot, so its turns are bare text under a time, like an assistant reply. */
export function PilotTurn(props: PilotTurnProps): ReactElement {
  const { at, children } = props;
  const label = at instanceof Date ? timeFormat.format(at) : at;
  return (
    <Stack spacing={1}>
      {label && <Typography variant="captionMuted">{label}</Typography>}
      {children}
    </Stack>
  );
}

export function formatClockSpan(start: Date, end: Date): string {
  const from = timeFormat.format(start);
  const to = timeFormat.format(end);
  return from === to ? to : `${from}–${to}`;
}
