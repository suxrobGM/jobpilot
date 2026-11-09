"use client";

import type { ReactElement } from "react";
import type { PilotNotice } from "@jobpilot/contracts/pilot";
import { Button, Card, CardContent, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { LinkButton } from "@/components/ui/buttons";
import { CHANGE_INVALIDATE } from "../changes/use-changes";

const INVALIDATE = [pilotQueries.notices().queryKey, ...CHANGE_INVALIDATE];

type ActedNotice = Exclude<PilotNotice["action"], { kind: "link" }>;

function runAction(action: ActedNotice) {
  switch (action.kind) {
    case "request":
      return api.pilot.requests.post({ ...action.request, source: "notice" });
    case "message":
      return api.pilot.messages.post({ body: action.body });
    case "change":
      return api.pilot.changes.post({
        summary: action.summary,
        actions: action.actions,
        source: "notice",
        propose: false,
      });
  }
}

const ACTED_MESSAGES: Record<ActedNotice["kind"], string> = {
  request: "Asked the pilot.",
  message: "Sent to the pilot. Its reply shows in the thread.",
  change: "Changed. You can undo it from the thread.",
};

interface NoticeCardProps {
  notice: PilotNotice;
}

/** Something the pilot spotted that needs a decision: one action, or dismiss. */
export function NoticeCard(props: NoticeCardProps): ReactElement {
  const { notice } = props;
  const { action } = notice;
  const dismiss = () => api.pilot.notices({ key: notice.key }).dismiss.post();

  const dismissNotice = useApiMutation(dismiss, { invalidate: INVALIDATE });
  // Acting hides the notice too, so its button can't queue the same work twice.
  const act = useApiMutation(
    async (acted: ActedNotice) => {
      const result = await runAction(acted);
      return result.error ? result : dismiss();
    },
    { invalidate: INVALIDATE, successMessage: (_data, acted) => ACTED_MESSAGES[acted.kind] },
  );

  return (
    <Card variant="accent">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack spacing={0.5}>
            <Typography variant="body1Strong">{notice.title}</Typography>
            <Typography variant="body2Muted">{notice.body}</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            {action.kind === "link" ? (
              <LinkButton href={action.href as Route} size="small" variant="contained">
                {action.label}
              </LinkButton>
            ) : (
              <Button
                size="small"
                variant="contained"
                loading={act.isPending}
                onClick={() => act.mutate(action)}
              >
                {action.label}
              </Button>
            )}
            <Button
              size="small"
              color="inherit"
              disabled={dismissNotice.isPending}
              onClick={() => dismissNotice.mutate()}
            >
              Dismiss
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
