"use client";

import type { ReactElement, ReactNode } from "react";
import { Chip, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import type { PipelineJobDto } from "@/api/types";
import { QuestionCard } from "../../attention/question-card";
import { type Pending, useNeedsYou } from "../../attention/use-needs-you";
import { ChangeCard } from "../../changes/change-card";
import { NoticeCard } from "./notice-card";
import { ParkedJobCard } from "./parked-job-card";

interface NeedsYouListProps {
  selectedJobId: string | null;
  onOpenJob: (job: PipelineJobDto) => void;
}

/** Everything waiting on the user, answered in place; parked jobs open beside the conversation. */
export function NeedsYouList(props: NeedsYouListProps): ReactElement {
  const { selectedJobId, onOpenJob } = props;
  const { data: notices = [] } = useQuery(pilotQueries.notices());
  const items = useNeedsYou();
  const total = notices.length + items.length;

  const render = (item: Pending): ReactNode => {
    switch (item.type) {
      case "question":
        return <QuestionCard key={item.id} question={item.question} />;
      case "change":
        return <ChangeCard key={item.id} change={item.change} />;
      case "job":
        return (
          <ParkedJobCard
            key={item.id}
            job={item.job}
            selected={item.job.id === selectedJobId}
            onOpen={() => onOpenJob(item.job)}
          />
        );
    }
  };

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", px: 0.5 }}>
        <Typography variant="overline">Needs you</Typography>
        {total > 0 && <Chip label={total} color="primary" size="small" />}
      </Stack>
      {total === 0 && (
        <Typography variant="body2Muted" sx={{ px: 0.5 }}>
          Nothing is waiting on you. I'll ask here when something is.
        </Typography>
      )}
      {notices.map((notice) => (
        <NoticeCard key={notice.key} notice={notice} />
      ))}
      {items.map(render)}
    </Stack>
  );
}
