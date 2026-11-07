"use client";

import { type ReactElement, useState } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Box, Button, Divider, Drawer, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { DetailSkeleton, QueryError } from "@/components/ui/feedback";
import { Composer } from "./composer";
import { PilotHeader } from "./pilot-header";
import { RulesSummary } from "./side/rules-summary";
import { SearchesSummary } from "./side/searches-summary";
import { StealthCodeBanner } from "./side/stealth-code-banner";
import { WeekSummary } from "./side/week-summary";
import { THREAD_WIDTH, Thread } from "./thread/thread";

interface SideColumnProps {
  state: PilotState;
}

function SideColumn(props: SideColumnProps): ReactElement {
  const { state } = props;
  return (
    <Stack spacing={3}>
      <Stack spacing={3} divider={<Divider />}>
        <WeekSummary />
        <SearchesSummary />
        <RulesSummary state={state} />
      </Stack>
      <StealthCodeBanner />
    </Stack>
  );
}

/** A conversation with the pilot: what it did and needs in its own words, and how the week is going. */
export function PilotHome(): ReactElement {
  const stateQuery = useQuery(pilotQueries.state());
  const [sheetOpen, setSheetOpen] = useState(false);
  const state = stateQuery.data;

  if (stateQuery.isLoading) {
    return <DetailSkeleton heights={[56, 480]} />;
  }
  if (!state) {
    return (
      <QueryError title="Couldn't load the pilot." onRetry={() => void stateQuery.refetch()} />
    );
  }

  return (
    <Stack
      direction="row"
      spacing={3}
      sx={(theme) => ({
        // The thread scrolls inside the page, so the header, composer and side column stay put.
        height: { md: `calc(100dvh - ${theme.spacing(12)})` },
        minHeight: theme.spacing(60),
      })}
    >
      <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
        <PilotHeader state={state} />
        <Button
          variant="outlined"
          sx={{ display: { md: "none" } }}
          onClick={() => setSheetOpen(true)}
        >
          This week, searches and rules
        </Button>
        <Divider />
        <Thread state={state} />
        <Box sx={{ maxWidth: THREAD_WIDTH, width: "100%", mx: "auto" }}>
          <Composer state={state} />
        </Box>
      </Stack>
      <Box
        sx={{ display: { xs: "none", md: "block" }, width: 280, flexShrink: 0, overflowY: "auto" }}
      >
        <SideColumn state={state} />
      </Box>
      <Drawer anchor="bottom" open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <Box sx={{ p: 2 }}>
          <SideColumn state={state} />
        </Box>
      </Drawer>
    </Stack>
  );
}
