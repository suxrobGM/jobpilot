"use client";

import { type ReactElement, useState } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Box, Button, Divider, Drawer, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { DetailSkeleton, QueryError } from "@/components/ui/feedback";
import { Composer } from "./composer";
import { GetStarted } from "./get-started";
import { HeadsUp } from "./side/heads-up";
import { NeedsYou } from "./side/needs-you";
import { RulesSummary } from "./side/rules-summary";
import { SearchesSummary } from "./side/searches-summary";
import { StealthCodeBanner } from "./side/stealth-code-banner";
import { StatusLine } from "./status-line";
import { Thread } from "./thread/thread";

interface SideColumnProps {
  state: PilotState;
}

function SideColumn(props: SideColumnProps): ReactElement {
  const { state } = props;
  return (
    <Stack spacing={3}>
      <Stack spacing={3} divider={<Divider />}>
        <NeedsYou />
        <HeadsUp />
        <SearchesSummary />
        <RulesSummary state={state} />
      </Stack>
      <StealthCodeBanner />
    </Stack>
  );
}

/** The pilot's home: what it's doing, what it did, and what it needs from you. */
export function PilotHome(): ReactElement {
  const stateQuery = useQuery(pilotQueries.state());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState("");
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
        // The thread scrolls inside the page, so the status line and right column stay put.
        height: { md: `calc(100dvh - ${theme.spacing(12)})` },
        minHeight: theme.spacing(60),
      })}
    >
      <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
        <StatusLine state={state} />
        <Button
          variant="outlined"
          sx={{ display: { md: "none" } }}
          onClick={() => setSheetOpen(true)}
        >
          Needs you, heads up, searches and rules
        </Button>
        <GetStarted state={state} />
        <Thread onPrompt={setDraft} />
        <Composer state={state} text={draft} onTextChange={setDraft} />
      </Stack>
      <Box
        sx={{ display: { xs: "none", md: "block" }, width: 300, flexShrink: 0, overflowY: "auto" }}
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
