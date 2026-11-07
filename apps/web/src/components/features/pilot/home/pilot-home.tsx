"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Box, Stack, Tab, Tabs, useMediaQuery } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import type { PipelineJobDto } from "@/api/types";
import { DetailSkeleton, QueryError } from "@/components/ui/feedback";
import { useAgentAvailable } from "@/providers/agent-provider";
import { useNeedsYou, useNeedsYouCount } from "../attention/use-needs-you";
import { Composer } from "./composer";
import { JobPane } from "./job-pane";
import { NeedsYouList } from "./needs-you/needs-you-list";
import { PilotHeader } from "./pilot-header";
import { PilotOverview } from "./side/pilot-overview";
import { THREAD_WIDTH, Thread } from "./thread/thread";

type PhoneTab = "chat" | "needsYou" | "overview";

/** The thread's reading width plus the column's gutters and scrollbar. */
const CONVERSATION_WIDTH = THREAD_WIDTH + 96;

interface ConversationProps {
  state: PilotState;
}

function Conversation(props: ConversationProps): ReactElement {
  const { state } = props;
  return (
    <>
      <Thread state={state} />
      <Box sx={{ maxWidth: THREAD_WIDTH, width: "100%", mx: "auto" }}>
        <Composer state={state} />
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

/** The "Needs you" queue beside the conversation; a parked job opens in the conversation's place. */
export function PilotHome(): ReactElement {
  const stateQuery = useQuery(pilotQueries.state());
  const isDesktop = useAgentAvailable();
  // Wide enough for a third column, so the overview leaves the queue for its own.
  const wide = useMediaQuery((theme) => theme.breakpoints.up("xl"));
  const [tab, setTab] = useState<PhoneTab>("chat");
  const [openJob, setOpenJob] = useState<PipelineJobDto | null>(null);
  const parkedJobs = useNeedsYou().flatMap((item) => (item.type === "job" ? [item.job] : []));
  const needsYouTotal = useNeedsYouCount();
  const state = stateQuery.data;

  if (stateQuery.isLoading) {
    return (
      <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
        <DetailSkeleton heights={[56, 480]} />
      </Box>
    );
  }
  if (!state) {
    return (
      <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
        <QueryError title="Couldn't load the pilot." onRetry={() => void stateQuery.refetch()} />
      </Box>
    );
  }

  const step = (direction: 1 | -1): void => {
    const at = parkedJobs.findIndex((job) => job.id === openJob?.id);
    const next = parkedJobs[at + direction];
    if (next) {
      setOpenJob(next);
    }
  };

  const queue = <NeedsYouList selectedJobId={openJob?.id ?? null} onOpenJob={setOpenJob} />;
  const overview = <PilotOverview state={state} />;

  const renderMain = (): ReactNode => {
    if (openJob) {
      return <JobPane job={openJob} onBack={() => setOpenJob(null)} onStep={step} />;
    }
    if (isDesktop || tab === "chat") {
      return <Conversation state={state} />;
    }
    return <ScrollPane>{tab === "needsYou" ? queue : overview}</ScrollPane>;
  };

  return (
    <Stack
      direction="row"
      // Basis 0 fills what the top bar leaves; the columns center as one block on wide screens.
      sx={{ flex: "1 1 0", minHeight: 0, justifyContent: "center" }}
    >
      <PilotHeader state={state} />
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
            // Once the columns float centered, the queue needs its outer edge too.
            borderLeft: { xl: 1 },
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
          // Capped only beside both side columns; narrower, it fills and centers the thread itself.
          maxWidth: { xl: CONVERSATION_WIDTH },
          px: { xs: 1.5, sm: 3 },
          pt: { xs: 1, md: 2 },
          pb: 2,
        }}
      >
        {!isDesktop && !openJob && (
          <Tabs
            value={tab}
            onChange={(_, value: PhoneTab) => setTab(value)}
            variant="fullWidth"
            sx={{ mb: 1 }}
          >
            <Tab value="chat" label="Chat" />
            <Tab
              value="needsYou"
              label={needsYouTotal > 0 ? `Needs you (${needsYouTotal})` : "Needs you"}
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
            borderInline: 1,
            borderColor: "divider",
          }}
        >
          {overview}
        </Box>
      )}
    </Stack>
  );
}
