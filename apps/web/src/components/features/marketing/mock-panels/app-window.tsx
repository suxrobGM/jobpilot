import type { ReactElement, ReactNode } from "react";
import { Description, Handshake, Inbox, SmartToy, ViewKanban } from "@mui/icons-material";
import { Box, Card, Stack, Typography } from "@mui/material";
import { JobPilotMark } from "@/components/brand/jobpilot-mark";

const TRAFFIC_LIGHTS = ["error.main", "warning.main", "success.main"] as const;

const RAIL = [
  { page: "pilot", icon: SmartToy },
  { page: "pipeline", icon: ViewKanban },
  { page: "inbox", icon: Inbox },
  { page: "resumes", icon: Description },
  { page: "upwork", icon: Handshake },
] as const;

type AppWindowPage = (typeof RAIL)[number]["page"];

interface AppWindowProps {
  page: AppWindowPage;
  title: string;
  /** Right side of the top bar, as in the app. */
  actions?: ReactNode;
  children: ReactNode;
}

/** A small copy of the dashboard - rail, top bar, page - so the tour shows the app as it is. */
export function AppWindow(props: AppWindowProps): ReactElement {
  const { page, title, actions, children } = props;
  return (
    <Card aria-hidden variant="showcase">
      <Stack
        direction="row"
        spacing={0.75}
        sx={{
          alignItems: "center",
          paddingInline: 1.5,
          paddingBlock: 1,
          borderBottom: 1,
          borderColor: "line.divider",
          backgroundColor: "surfaces.elevated",
        }}
      >
        {TRAFFIC_LIGHTS.map((color) => (
          <Box
            key={color}
            sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color }}
          />
        ))}
        <Typography variant="monoCaption" sx={{ pl: 1 }}>
          jobpilot · {page}
        </Typography>
      </Stack>
      <Stack direction="row" sx={{ minHeight: 380 }}>
        <Stack
          spacing={0.75}
          sx={{
            width: 48,
            flexShrink: 0,
            alignItems: "center",
            py: 1.25,
            borderRight: 1,
            borderColor: "line.divider",
            backgroundColor: "surfaces.panel",
          }}
        >
          <JobPilotMark size={24} />
          {RAIL.map((item) => {
            const Icon = item.icon;
            const active = item.page === page;
            return (
              <Box
                key={item.page}
                sx={(theme) => ({
                  width: 32,
                  height: 32,
                  mt: 0.5,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: theme.radii.md,
                  color: active ? "accent.primary" : "text.secondary",
                  backgroundColor: active ? theme.tints.selected : "transparent",
                })}
              >
                <Icon fontSize="sm" />
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
