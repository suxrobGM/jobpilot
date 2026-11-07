"use client";

import type { ReactElement } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Dialog, DialogContent } from "@mui/material";
import { DialogHeader } from "@/components/ui/feedback";
import { RulesForm } from "../../goals/rules-form";

interface RulesDialogProps {
  state: PilotState;
  open: boolean;
  onClose: () => void;
}

/** The daily cap, score bar and deal-breakers, from the overview or the composer. */
export function RulesDialog(props: RulesDialogProps): ReactElement {
  const { state, open, onClose } = props;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogHeader title="Rules" onClose={onClose} />
      <DialogContent>
        <RulesForm state={state} onSaved={onClose} />
      </DialogContent>
    </Dialog>
  );
}
