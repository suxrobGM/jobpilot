"use client";

import type { ReactElement } from "react";
import type { PilotChange } from "@jobpilot/contracts/pilot";
import { Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { RelativeTime } from "@/components/ui/display";
import { describeAction } from "./describe-action";
import { useDecideChange } from "./use-changes";

const SOURCE_LABELS: Record<PilotChange["source"], string> = {
  user: "You",
  chat: "From chat",
  pilot: "Pilot",
  notice: "Pilot noticed",
};

const CLOSED_LABELS: Partial<Record<PilotChange["status"], string>> = {
  undone: "Undone",
  dismissed: "Dismissed",
};

interface ChangeCardProps {
  change: PilotChange;
}

/** An applied change with Undo, or a proposal with Apply and Dismiss. */
export function ChangeCard(props: ChangeCardProps): ReactElement {
  const { change } = props;
  const decide = useDecideChange(change.id);
  const searches = useQuery(pilotQueries.searches()).data ?? [];
  const names = new Map(searches.map((search) => [search.id, search.name]));
  const proposed = change.status === "proposed";
  const closed = CLOSED_LABELS[change.status];

  return (
    <Card variant={proposed ? "accent" : "outlined"}>
      <CardContent>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
            <Typography variant="body2Strong" sx={{ flex: 1, minWidth: 0 }}>
              {change.summary}
            </Typography>
            <Typography variant="captionMuted" sx={{ whiteSpace: "nowrap" }}>
              {proposed ? `${SOURCE_LABELS[change.source]} suggests` : SOURCE_LABELS[change.source]}
            </Typography>
            <RelativeTime value={change.createdAt} sx={{ whiteSpace: "nowrap" }} />
          </Stack>
          <Typography variant="body2Muted" sx={{ whiteSpace: "pre-line" }}>
            {change.actions.map((action) => describeAction(action, names)).join("\n")}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ justifyContent: "flex-end", alignItems: "center" }}
          >
            {closed && <Typography variant="captionMuted">{closed}</Typography>}
            {change.canUndo && (
              <Button size="small" loading={decide.isPending} onClick={() => decide.mutate("undo")}>
                Undo
              </Button>
            )}
            {proposed && (
              <>
                <Button
                  size="small"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate("dismiss")}
                >
                  Dismiss
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  loading={decide.isPending}
                  onClick={() => decide.mutate("apply")}
                >
                  Apply
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
