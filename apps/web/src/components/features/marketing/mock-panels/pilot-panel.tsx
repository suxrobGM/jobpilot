import type { ReactElement, ReactNode } from "react";
import { ArrowUpward, SmartToy } from "@mui/icons-material";
import { Box, Divider, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AppWindow } from "./app-window";

const WORK = [
  { line: "Applied · ML Engineer, New Grad · Duolingo", score: 82 },
  { line: "Applied · Research Assistant · CMU Robotics", score: 77 },
  { line: "Scored 24 jobs for ML engineer, new grad", score: null },
];

interface TurnProps {
  at: string;
  children: ReactNode;
}

function Turn(props: TurnProps): ReactElement {
  const { at, children } = props;
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
      <Box
        sx={(theme) => ({
          width: 24,
          height: 24,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          borderRadius: theme.radii.md,
          color: "accent.primary",
          backgroundColor: alpha(theme.palette.accent.primary, 0.14),
        })}
      >
        <SmartToy fontSize="xs" />
      </Box>
      <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "baseline" }}>
          <Typography variant="body2Strong">Pilot</Typography>
          <Typography variant="captionMuted">{at}</Typography>
        </Stack>
        {children}
      </Stack>
    </Stack>
  );
}

export function PilotPanel(): ReactElement {
  return (
    <AppWindow page="pilot" title="Pilot">
      <Stack spacing={1.75}>
        <Turn at="9:10–9:52">
          <Box
            sx={(theme) => ({
              border: 1,
              borderColor: "line.border",
              borderRadius: theme.radii.lg,
              backgroundColor: "surfaces.card",
            })}
          >
            {WORK.map((item, index) => (
              <Box key={item.line}>
                {index > 0 && <Divider />}
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", px: 1.5, py: 0.75 }}>
                  <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                    {item.line}
                  </Typography>
                  {item.score !== null && (
                    <Typography variant="monoCaption" color="success">
                      {item.score}
                    </Typography>
                  )}
                </Stack>
              </Box>
            ))}
          </Box>
        </Turn>
        <Box
          sx={(theme) => ({
            alignSelf: "flex-end",
            maxWidth: "80%",
            px: 1.5,
            py: 1,
            border: 1,
            borderColor: "line.borderHi",
            borderRadius: "12px 12px 4px 12px",
            backgroundColor: theme.palette.surfaces.elevated,
          })}
        >
          <Typography variant="body2">
            Stop applying to jobs that need clearance, and add university labs in PA.
          </Typography>
        </Box>
        <Turn at="9:53">
          <Typography variant="body2">Done. Added a rule and a search.</Typography>
          <Stack direction="row" sx={{ justifyContent: "space-between" }}>
            <Typography variant="captionMuted">+ Skip jobs that need clearance</Typography>
            <Typography variant="caption" color="primary">
              Undo
            </Typography>
          </Stack>
        </Turn>
        <Stack
          direction="row"
          sx={(theme) => ({
            alignItems: "center",
            pl: 1.5,
            pr: 0.75,
            py: 0.75,
            border: 1,
            borderColor: "line.borderHi",
            borderRadius: theme.radii.lg * 1.5,
            backgroundColor: "surfaces.card",
          })}
        >
          <Typography variant="body2" color="textDisabled" sx={{ flex: 1 }} noWrap>
            Ask the pilot, change a rule, or paste job links…
          </Typography>
          <Box
            sx={(theme) => ({
              width: 26,
              height: 26,
              display: "grid",
              placeItems: "center",
              borderRadius: theme.radii.md,
              color: "surfaces.base",
              backgroundColor: "text.primary",
            })}
          >
            <ArrowUpward fontSize="xs" />
          </Box>
        </Stack>
      </Stack>
    </AppWindow>
  );
}
