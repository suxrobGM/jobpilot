"use client";

import type { ReactElement, ReactNode } from "react";
import type { TaskList } from "@jobpilot/contracts/pilot";
import { taskTypeLabel } from "@jobpilot/contracts/pilot";
import { Refresh } from "@mui/icons-material";
import { Box, Chip, Divider, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { TooltipIconButton } from "@/components/ui/buttons";
import { RelativeTime } from "@/components/ui/display";

const SHOWN = 6;

interface RefreshTaskListButtonProps {
  busy: boolean;
}

/** Rebuilds the server's task list now instead of at the next cycle. */
export function RefreshTaskListButton(props: RefreshTaskListButtonProps): ReactElement {
  const { busy } = props;
  const refresh = useApiMutation(() => api.pilot.tasks.refresh.post(), {
    invalidate: [pilotQueries.taskList().queryKey],
  });
  return (
    <TooltipIconButton
      title="Rebuild the task list"
      disabled={busy || refresh.isPending}
      onClick={() => refresh.mutate()}
    >
      <Refresh fontSize="sm" />
    </TooltipIconButton>
  );
}

interface TaskQueueProps {
  taskList: TaskList | null | undefined;
}

/** The tasks waiting behind the one the server picks; nothing when there are none. */
export function TaskQueue(props: TaskQueueProps): ReactNode {
  const { taskList } = props;
  if (!taskList || taskList.tasks.length === 0) {
    return null;
  }
  const shown = taskList.tasks.slice(0, SHOWN);
  return (
    <Box sx={{ mt: 2 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", mb: 1 }}>
        <Typography variant="overlineMuted">Up next</Typography>
        <RelativeTime prefix="Built" value={taskList.builtAt} />
      </Stack>
      <Stack spacing={1} divider={<Divider />}>
        {shown.map((task, index) => (
          <Stack key={task.id} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Typography variant="monoCaption" sx={{ width: 16, flexShrink: 0 }}>
              {index + 1}
            </Typography>
            <Typography variant="captionMuted" sx={{ width: 140, flexShrink: 0 }} noWrap>
              {taskTypeLabel(task.taskType)}
            </Typography>
            <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
              {task.title}
            </Typography>
            <Chip variant="outlined" label={task.subjectType} />
          </Stack>
        ))}
      </Stack>
      {taskList.tasks.length > SHOWN && (
        <Typography variant="captionMuted" sx={{ display: "block", mt: 1 }}>
          +{taskList.tasks.length - SHOWN} more
        </Typography>
      )}
    </Box>
  );
}
