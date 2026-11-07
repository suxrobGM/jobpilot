import type { ReactElement, ReactNode } from "react";
import { SmartToy } from "@mui/icons-material";
import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/** Avatar width plus the gap: lines that belong to the pilot but carry no avatar indent by this. */
export const TURN_INDENT = 5.25;

interface PilotTurnProps {
  /** A clock time, or a label such as a time span; "Now" for the live lines at the bottom. */
  at?: Date | string;
  children: ReactNode;
}

/** One thing the pilot said: its avatar, name and time, then the message under them. */
export function PilotTurn(props: PilotTurnProps): ReactElement {
  const { at, children } = props;
  const label = at instanceof Date ? timeFormat.format(at) : (at ?? "Now");
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
      <Box
        aria-hidden
        sx={(theme) => ({
          width: 30,
          height: 30,
          flexShrink: 0,
          display: { xs: "none", sm: "grid" },
          placeItems: "center",
          borderRadius: theme.radii.lg,
          color: "accent.primary",
          backgroundColor: alpha(theme.palette.accent.primary, 0.14),
        })}
      >
        <SmartToy fontSize="sm" />
      </Box>
      <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
          <Typography variant="body2Strong">Pilot</Typography>
          <Typography variant="captionMuted">{label}</Typography>
        </Stack>
        {children}
      </Stack>
    </Stack>
  );
}

export function formatClockSpan(start: Date, end: Date): string {
  const from = timeFormat.format(start);
  const to = timeFormat.format(end);
  return from === to ? to : `${from}–${to}`;
}
