"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import { Box, Stack, Tab, Tabs, useMediaQuery } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { CountLabel } from "@/components/ui/display";
import { DetailSkeleton, QueryError } from "@/components/ui/feedback";
import { useNeedsYouCount } from "../attention/use-needs-you";
import { Composer } from "./composer";
import { NeedsYouList } from "./needs-you/needs-you-list";
import { PilotHeader } from "./pilot-header";
import { PilotOverview } from "./side/pilot-overview";
import { THREAD_WIDTH, Thread } from "./thread/thread";

type PhoneTab = "chat" | "needsYou" | "overview";

function Conversation(): ReactElement {
  return (
    <>
      <Thread />
      <Box sx={{ maxWidth: THREAD_WIDTH, width: "100%", mx: "auto" }}>
        <Composer />
      </Box>
    </>
  );
}

interface ScrollPaneProps {
  children: ReactNode;
}

function ScrollPane(props: ScrollPaneProps): ReactElement {
  const { children } = props;
  return <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", py: 1 }}>{children}</Box>;
}

/** The "Needs you" queue beside the conversation. */
export function PilotHome(): ReactElement {
  const stateQuery = useQuery(pilotQueries.state());
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up("md"));
  // Wide enough for a third column, so the overview leaves the queue for its own.
  const wide = useMediaQuery((theme) => theme.breakpoints.up("xl"));
  const [tab, setTab] = useState<PhoneTab>("chat");
  const needsYouTotal = useNeedsYouCount();

  if (!stateQuery.data) {
    return (
      <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
        {stateQuery.isLoading ? (
          <DetailSkeleton heights={[56, 480]} />
        ) : (
          <QueryError title="Couldn't load the pilot." onRetry={() => void stateQuery.refetch()} />
        )}
      </Box>
    );
  }

  const queue = <NeedsYouList />;
  const overview = <PilotOverview />;

  const renderMain = (): ReactNode => {
    if (isDesktop || tab === "chat") {
      return <Conversation />;
    }
    return <ScrollPane>{tab === "needsYou" ? queue : overview}</ScrollPane>;
  };

  return (
    <Stack
      direction="row"
      // Basis 0 fills what the top bar leaves. A workspace, not a page: the side panels pin to the
      // screen edges under the full-width top bar, and the thread centers in the middle column.
      sx={{ flex: "1 1 0", minHeight: 0 }}
    >
      <PilotHeader />
      {isDesktop && (
        <Stack
          component="aside"
          aria-label="Needs you"
          spacing={4}
          sx={{
            width: 340,
            flexShrink: 0,
            overflowY: "auto",
            p: 2.5,
            borderRight: 1,
            borderColor: "divider",
          }}
        >
          {queue}
          {!wide && overview}
        </Stack>
      )}
      <Stack
        sx={{
          flex: 1,
          minWidth: 0,
          px: { xs: 1.5, sm: 3 },
          pt: { xs: 1, md: 2 },
          pb: 2,
        }}
      >
        {!isDesktop && (
          <Tabs
            value={tab}
            onChange={(_, value: PhoneTab) => setTab(value)}
            variant="fullWidth"
            sx={{ mb: 1 }}
          >
            <Tab value="chat" label="Chat" />
            <Tab
              value="needsYou"
              label={<CountLabel label="Needs you" count={needsYouTotal || null} />}
            />
            <Tab value="overview" label="Overview" />
          </Tabs>
        )}
        {renderMain()}
      </Stack>
      {isDesktop && wide && (
        <Box
          component="aside"
          aria-label="Overview"
          sx={{
            width: 300,
            flexShrink: 0,
            overflowY: "auto",
            p: 2.5,
            borderLeft: 1,
            borderColor: "divider",
          }}
        >
          {overview}
        </Box>
      )}
    </Stack>
  );
}
