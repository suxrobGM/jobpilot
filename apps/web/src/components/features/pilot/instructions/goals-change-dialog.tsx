"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import {
  NO_INSTRUCTIONS_CHANGE,
  type PilotInstructionsChange,
  type PilotInstructionsImpact,
} from "@jobpilot/contracts/pilot";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from "@mui/material";
import { LoadingSpinner } from "@/components/ui/feedback";
import { formatRelativeTime, plural } from "@/utils/format";

interface GoalsChangeDialogProps {
  open: boolean;
  impact: PilotInstructionsImpact | undefined;
  isLoading: boolean;
  saving: boolean;
  onConfirm: (change: PilotInstructionsChange) => void;
  onCancel: () => void;
}

const ALL_CHECKED: PilotInstructionsChange = {
  rederiveSearches: true,
  completeCampaigns: true,
  dropApprovedJobs: true,
};

interface Option {
  key: keyof PilotInstructionsChange;
  label: string;
  detail: ReactNode;
}

function options(impact: PilotInstructionsImpact): Option[] {
  const list: Option[] = [];
  if (impact.searches.length > 0) {
    list.push({
      key: "rederiveSearches",
      label: `Re-derive ${plural(impact.searches.length, "search", "searches")} from the new goals`,
      detail: impact.searches.map((s) => s.query).join(" · "),
    });
  }
  if (impact.campaigns.length > 0) {
    list.push({
      key: "completeCampaigns",
      label: `Complete ${plural(impact.campaigns.length, "campaign")} started under the old goals`,
      detail: impact.campaigns.map((c) => c.query).join(" · "),
    });
  }
  if (impact.approvedJobs > 0) {
    list.push({
      key: "dropApprovedJobs",
      label: `Drop ${plural(impact.approvedJobs, "approved job")} not yet applied to`,
      detail: impact.oldestApprovedAt
        ? `Oldest found ${formatRelativeTime(impact.oldestApprovedAt)} ago.`
        : null,
    });
  }
  return list;
}

/**
 * Asked before saving changed goals. Searches, campaigns and the approved backlog all outlive an
 * instructions edit, so without this the pilot goes straight back to the old plan on the next cycle.
 */
export function GoalsChangeDialog(props: GoalsChangeDialogProps): ReactElement {
  const { open, impact, isLoading, saving, onConfirm, onCancel } = props;
  const [change, setChange] = useState<PilotInstructionsChange>(ALL_CHECKED);

  const available = impact ? options(impact) : [];

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Your goals changed</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <LoadingSpinner py={3} />
        ) : (
          <Stack spacing={2}>
            <DialogContentText>
              The pilot keeps working from what it already set up. Pick what to retire alongside the
              new goals.
            </DialogContentText>
            {available.map((option) => (
              <Stack key={option.key} spacing={0.25}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={change[option.key]}
                      onChange={(e) => setChange({ ...change, [option.key]: e.target.checked })}
                    />
                  }
                  label={option.label}
                />
                {option.detail && (
                  <Typography variant="captionMuted" sx={{ paddingInlineStart: 4 }}>
                    {option.detail}
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => onConfirm(NO_INSTRUCTIONS_CHANGE)} disabled={saving || isLoading}>
          Save, keep everything
        </Button>
        <Button
          onClick={() => onConfirm(change)}
          variant="contained"
          disabled={saving || isLoading}
        >
          {saving ? "Saving" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
