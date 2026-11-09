import type { ReactElement, ReactNode } from "react";
import { Box, Card, Stack, Typography } from "@mui/material";
import { JobPilotMark } from "@/components/brand/jobpilot-mark";
import { RailLabel, railTile } from "@/components/layout/rail-tile";
import { NAV_GROUPS } from "@/components/layout/shell-config";
import { WindowBar } from "./panel-frame";

const PAGES = ["pilot", "pipeline", "inbox", "resumes", "upwork"] as const;

type AppWindowPage = (typeof PAGES)[number];

const RAIL = NAV_GROUPS.flatMap((group) => group.items).filter((item) =>
  PAGES.some((page) => item.href === `/${page}`),
);

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
          {RAIL.map((item) => (
            <Box key={item.href} sx={railTile(item.href === `/${page}`)}>
              <item.icon fontSize="md" />
              <RailLabel>{item.label}</RailLabel>
            </Box>
          ))}
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
