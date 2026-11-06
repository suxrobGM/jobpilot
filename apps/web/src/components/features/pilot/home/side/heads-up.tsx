"use client";

import type { ReactElement } from "react";
import type { PilotNotice } from "@jobpilot/contracts/pilot";
import { Button, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { LinkButton } from "@/components/ui/buttons";
import { CHANGE_INVALIDATE } from "../../changes/use-changes";
import { SideSection } from "./side-section";

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

interface NoticeRowProps {
  notice: PilotNotice;
}

function NoticeRow(props: NoticeRowProps): ReactElement {
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
    <Stack spacing={0.5}>
      <Typography variant="body2Strong">{notice.title}</Typography>
      <Typography variant="body2Muted">{notice.body}</Typography>
      <Stack direction="row" spacing={1}>
        {action.kind === "link" ? (
          <LinkButton href={action.href as Route} size="small">
            {action.label}
          </LinkButton>
        ) : (
          <Button size="small" loading={act.isPending} onClick={() => act.mutate(action)}>
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
  );
}

/** Patterns the pilot spotted in your data. */
export function HeadsUp(): ReactElement {
  const { data: notices = [] } = useQuery(pilotQueries.notices());
  return (
    <SideSection title="Heads up">
      {notices.length === 0 ? (
        <Typography variant="body2Muted">Nothing to flag.</Typography>
      ) : (
        <Stack spacing={2}>
          {notices.map((notice) => (
            <NoticeRow key={notice.key} notice={notice} />
          ))}
        </Stack>
      )}
    </SideSection>
  );
}
