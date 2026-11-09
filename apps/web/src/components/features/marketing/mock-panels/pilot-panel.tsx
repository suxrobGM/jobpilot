import type { ReactElement, ReactNode } from "react";
import { ArrowUpward, SmartToy } from "@mui/icons-material";
import { Box, Button, Card, Divider, Stack, Typography } from "@mui/material";
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
          backgroundColor: theme.tints.selected,
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
          <Card>
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
          </Card>
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
        <Card
          variant="field"
          component={Stack}
          direction="row"
          sx={{ alignItems: "center", pl: 1.5, pr: 0.75, py: 0.75 }}
        >
          <Typography variant="body2" color="textDisabled" sx={{ flex: 1 }} noWrap>
            Ask the pilot, change a rule, or paste job links…
          </Typography>
          <Button
            variant="contained"
            size="small"
            tabIndex={-1}
            aria-hidden
            sx={{ minWidth: 0, px: 1 }}
          >
            <ArrowUpward fontSize="xs" />
          </Button>
        </Card>
      </Stack>
    </AppWindow>
  );
}
