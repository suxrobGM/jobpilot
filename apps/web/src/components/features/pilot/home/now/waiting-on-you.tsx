"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import { Button, Paper, Stack, Typography } from "@mui/material";
import type { PipelineJobDto } from "@/api/types";
import { JobDrawer } from "@/components/features/pipeline/jobs/job-drawer";
import { QuestionCard } from "../../attention/question-card";
import { type Pending, useNeedsYou } from "../../attention/use-needs-you";
import { ChangeCard } from "../../changes/change-card";
import { PilotTurn } from "../thread/pilot-turn";

interface ParkedJobProps {
  job: PipelineJobDto;
  onOpen: () => void;
}

function ParkedJob(props: ParkedJobProps): ReactElement {
  const { job, onOpen } = props;
  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1.5 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2Strong" noWrap>{`${job.title} · ${job.company}`}</Typography>
          <Typography variant="captionMuted" noWrap>
            {job.failReason ?? "Parked until you take a look"}
          </Typography>
        </Stack>
        <Button size="small" variant="outlined" onClick={onOpen}>
          Open
        </Button>
      </Stack>
    </Paper>
  );
}

function intro(count: number): string {
  return count === 1 ? "One thing needs you:" : `${count} things need you:`;
}

/** Open questions, proposals and parked jobs, answered right here instead of in a side list. */
export function WaitingOnYou(): ReactNode {
  const items = useNeedsYou();
  const [openJob, setOpenJob] = useState<PipelineJobDto | null>(null);
  if (items.length === 0) {
    return null;
  }

  const render = (item: Pending): ReactNode => {
    switch (item.type) {
      case "question":
        return <QuestionCard key={item.id} question={item.question} />;
      case "change":
        return <ChangeCard key={item.id} change={item.change} />;
      case "job":
        return <ParkedJob key={item.id} job={item.job} onOpen={() => setOpenJob(item.job)} />;
    }
  };

  return (
    <PilotTurn>
      <Typography variant="body2">{intro(items.length)}</Typography>
      {items.map(render)}
      <JobDrawer job={openJob} onClose={() => setOpenJob(null)} />
    </PilotTurn>
  );
}
