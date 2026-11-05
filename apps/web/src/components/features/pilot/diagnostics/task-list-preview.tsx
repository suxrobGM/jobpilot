"use client";

import type { ReactElement } from "react";
import type { TaskList } from "@jobpilot/contracts/pilot";
import { Refresh } from "@mui/icons-material";
import { Box, Chip, Divider, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { LinkButton, TooltipIconButton } from "@/components/ui/buttons";
import { RelativeTime } from "@/components/ui/display";
import { EmptyState, QuerySection } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";
import { formatTimeUntil } from "@/utils/format";
import { taskTypeLabel } from "../task-types";
import { useTaskList } from "./use-task-list";

const PREVIEW_COUNT = 6;

interface TaskListEmptyProps {
  reason: TaskList["emptyReason"];
  budget: TaskList["budget"];
}

function TaskListEmpty(props: TaskListEmptyProps): ReactElement {
  const { reason, budget } = props;
  if (reason === "capReached") {
    return (
      <EmptyState
        variant="inline"
        title="Daily cap reached."
        description={`Applied ${budget.appliedToday}/${budget.dailyApplyCap} - resets in ${formatTimeUntil(budget.resetsAt)}.`}
      />
    );
  }
  if (reason === "awaitingSetup") {
    return (
      <EmptyState
        variant="inline"
        title="Getting set up."
        description="The pilot derives goals and saved searches from your profile - this finishes on an upcoming cycle."
        action={
          <LinkButton size="small" href="/pilot/goals">
            Edit instructions
          </LinkButton>
        }
      />
    );
  }
  // No description: the status bar already carries the next-wake countdown.
  return <EmptyState variant="inline" title="No tasks right now." />;
}

interface TaskListPreviewProps {
  running: boolean;
}

export function TaskListPreview(props: TaskListPreviewProps): ReactElement {
  const { running } = props;
  const query = useTaskList(running);
  const refresh = useApiMutation(() => api.pilot.tasks.refresh.post(), {
    invalidate: [pilotQueries.taskList().queryKey],
  });

  const taskList = query.data;
  const visible = taskList?.tasks.slice(0, PREVIEW_COUNT) ?? [];

  return (
    <SectionCard
      fullHeight
      title="Up next"
      description="What the pilot plans to work on next cycle."
      actions={
        running && (
          <TooltipIconButton
            title="Refresh task list"
            disabled={query.isFetching || refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            <Refresh fontSize="sm" />
          </TooltipIconButton>
        )
      }
    >
      {!running && (
        <EmptyState
          variant="inline"
          title="The pilot is off."
          description="Start it and it plans its next tasks here."
        />
      )}
      {running && (
        <QuerySection
          query={query}
          errorTitle="Couldn't load the task list."
          isEmpty={!taskList}
          empty={
            <EmptyState
              variant="inline"
              title="No current task list."
              description="Refresh to build the pilot's next task list."
            />
          }
        >
          {taskList && (
            <Stack spacing={2}>
              {visible.length === 0 ? (
                <TaskListEmpty reason={taskList.emptyReason} budget={taskList.budget} />
              ) : (
                <Stack spacing={1.5} divider={<Divider />}>
                  {visible.map((task, index) => (
                    <Stack
                      key={task.id}
                      direction="row"
                      spacing={1.5}
                      sx={{ alignItems: "center" }}
                    >
                      <Typography variant="overlineMuted" sx={{ width: 16, flexShrink: 0 }}>
                        {index + 1}
                      </Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="captionMuted">
                          {taskTypeLabel(task.taskType)}
                        </Typography>
                        <Typography variant="body2" noWrap>
                          {task.title}
                        </Typography>
                      </Box>
                      <Chip variant="outlined" label={task.subjectType} />
                    </Stack>
                  ))}
                </Stack>
              )}
              {taskList.tasks.length > PREVIEW_COUNT && (
                <Typography variant="captionMuted">
                  +{taskList.tasks.length - PREVIEW_COUNT} more
                </Typography>
              )}
              <RelativeTime prefix="Built" value={taskList.builtAt} />
            </Stack>
          )}
        </QuerySection>
      )}
    </SectionCard>
  );
}
