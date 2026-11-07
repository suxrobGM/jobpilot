"use client";

import type { ReactElement } from "react";
import type { PilotChange } from "@jobpilot/contracts/pilot";
import { CheckCircleOutlined, LightbulbOutlined, UndoOutlined } from "@mui/icons-material";
import { Button, Stack, Typography } from "@mui/material";
import { useDecideChange } from "../../changes/use-changes";

const STATUS_NOTES: Record<PilotChange["status"], string> = {
  proposed: "Suggested · waiting for you",
  applied: "Done",
  undone: "Undone",
  dismissed: "Dismissed",
};

interface ChangeRowProps {
  change: PilotChange;
}

/** A change as one line; a proposal's full card waits at the bottom of the thread. */
export function ChangeRow(props: ChangeRowProps): ReactElement {
  const { change } = props;
  const decide = useDecideChange(change.id);
  const proposed = change.status === "proposed";
  const Icon = proposed ? LightbulbOutlined : CheckCircleOutlined;
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", px: 1 }}>
      <Icon fontSize="sm" color={change.status === "applied" ? "success" : "disabled"} />
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
        {change.summary}
        <Typography component="span" variant="body2Muted">
          {`  ${STATUS_NOTES[change.status]}`}
        </Typography>
      </Typography>
      {change.canUndo && (
        <Button
          size="small"
          color="inherit"
          startIcon={<UndoOutlined fontSize="sm" />}
          loading={decide.isPending}
          onClick={() => decide.mutate("undo")}
        >
          Undo
        </Button>
      )}
    </Stack>
  );
}
