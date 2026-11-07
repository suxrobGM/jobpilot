import type { ReactElement, ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

interface MockTab {
  label: string;
  count: number;
}

interface MockTabsProps {
  tabs: MockTab[];
  active: string;
}

/** The page tabs under the app's top bar. */
export function MockTabs(props: MockTabsProps): ReactElement {
  const { tabs, active } = props;
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{ mb: 1.5, borderBottom: 1, borderColor: "line.divider", overflow: "hidden" }}
    >
      {tabs.map((tab) => {
        const selected = tab.label === active;
        return (
          <Stack
            key={tab.label}
            direction="row"
            spacing={0.5}
            sx={{
              alignItems: "baseline",
              pb: 0.75,
              borderBottom: 2,
              borderColor: selected ? "accent.primary" : "transparent",
            }}
          >
            <Typography variant={selected ? "body2Strong" : "body2Muted"} noWrap>
              {tab.label}
            </Typography>
            <Typography variant="monoCaption">{tab.count}</Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}

interface MockRowProps {
  lead: ReactNode;
  title: string;
  meta: string;
  end: ReactNode;
}

function MockRow(props: MockRowProps): ReactElement {
  const { lead, title, meta, end } = props;
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", px: 1.5, py: 1 }}>
      {lead}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2Strong" noWrap sx={{ display: "block" }}>
          {title}
        </Typography>
        <Typography variant="captionMuted" noWrap sx={{ display: "block" }}>
          {meta}
        </Typography>
      </Box>
      {end}
    </Stack>
  );
}

interface MockListProps {
  rows: (MockRowProps & { id: string })[];
}

/** Rows in a bordered card, as every list in the app is laid out. */
export function MockList(props: MockListProps): ReactElement {
  const { rows } = props;
  return (
    <Box
      sx={(theme) => ({
        border: 1,
        borderColor: "line.border",
        borderRadius: theme.radii.lg,
        backgroundColor: "surfaces.card",
        "& > * + *": { borderTop: 1, borderColor: "line.divider" },
      })}
    >
      {rows.map((row) => (
        <MockRow key={row.id} {...row} />
      ))}
    </Box>
  );
}
