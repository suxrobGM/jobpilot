import type { ReactElement, ReactNode } from "react";
import { Description, Handshake, Inbox, SmartToy, ViewKanban } from "@mui/icons-material";
import { Box, Card, Stack, Typography } from "@mui/material";
import { JobPilotMark } from "@/components/brand/jobpilot-mark";
import { RailLabel, railTile } from "@/components/layout/rail-tile";
import { WindowBar } from "./panel-frame";

const RAIL = [
  { page: "pilot", label: "Pilot", icon: SmartToy },
  { page: "pipeline", label: "Pipeline", icon: ViewKanban },
  { page: "inbox", label: "Inbox", icon: Inbox },
  { page: "resumes", label: "Resumes", icon: Description },
  { page: "upwork", label: "Upwork", icon: Handshake },
] as const;

type AppWindowPage = (typeof RAIL)[number]["page"];

interface AppWindowProps {
  page: AppWindowPage;
  title: string;
  /** Right side of the top bar, as in the app. */
  actions?: ReactNode;
  children: ReactNode;
}

/** A small copy of the dashboard - rail, top bar, page - built from the app's own parts. */
export function AppWindow(props: AppWindowProps): ReactElement {
  const { page, title, actions, children } = props;
  return (
    // Inert: the real components inside are focusable, and this is a picture.
    <Card aria-hidden inert variant="showcase">
      <WindowBar label={`jobpilot · ${page}`} />
      <Stack direction="row" sx={{ minHeight: 380 }}>
        <Stack
          spacing={0.5}
          sx={{
            width: 72,
            flexShrink: 0,
            alignItems: "center",
            px: 0.5,
            py: 1.25,
            borderRight: 1,
            borderColor: "line.divider",
            backgroundColor: "surfaces.panel",
          }}
        >
          <JobPilotMark size={24} />
          {RAIL.map((item) => {
            const active = item.page === page;
            return (
              <Box key={item.page} sx={railTile(active)}>
                <item.icon fontSize="md" sx={{ color: active ? "accent.primary" : undefined }} />
                <RailLabel>{item.label}</RailLabel>
              </Box>
            );
          })}
        </Stack>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: "center",
              minHeight: 44,
              px: 2,
              borderBottom: 1,
              borderColor: "line.divider",
            }}
          >
            <Typography variant="h4" component="p" sx={{ flex: 1 }} noWrap>
              {title}
            </Typography>
            {actions}
          </Stack>
          <Box sx={{ p: 2, flex: 1, minWidth: 0 }}>{children}</Box>
        </Stack>
      </Stack>
    </Card>
  );
}
