"use client";

import { type ReactElement, useState } from "react";
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
import { plural } from "@/utils/format";

/** What the old goals left running, read when the user saves new ones. */
export interface GoalsImpact {
  searches: { id: string; name: string }[];
  approvedJobs: number;
}

export interface GoalsRetirement {
  rebuildSearches: boolean;
  dropApprovedJobs: boolean;
}

interface GoalsChangeDialogProps {
  impact: GoalsImpact | null;
  saving: boolean;
  onConfirm: (retire: GoalsRetirement) => void;
  onCancel: () => void;
}

/** Searches and approved jobs outlive a goals edit, so without this the pilot keeps the old plan. */
export function GoalsChangeDialog(props: GoalsChangeDialogProps): ReactElement {
  const { impact, saving, onConfirm, onCancel } = props;
  const [rebuildSearches, setRebuildSearches] = useState(true);
  const [dropApprovedJobs, setDropApprovedJobs] = useState(true);
  const searchCount = impact?.searches.length ?? 0;
  const approvedJobs = impact?.approvedJobs ?? 0;

  return (
    <Dialog open={impact !== null} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Your goals changed</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <DialogContentText>
            The pilot keeps working from what it already set up. Pick what to leave behind. You can
            undo all of it from the Pilot page.
          </DialogContentText>
          {searchCount > 0 && (
            <Stack spacing={0.25}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={rebuildSearches}
                    onChange={(e) => setRebuildSearches(e.target.checked)}
                  />
                }
                label={`Rebuild ${plural(searchCount, "search", "searches")} from the new goals`}
              />
              <Typography variant="captionMuted" sx={{ paddingInlineStart: 4 }}>
                {impact?.searches.map((search) => search.name).join(" · ")}
              </Typography>
            </Stack>
          )}
          {approvedJobs > 0 && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={dropApprovedJobs}
                  onChange={(e) => setDropApprovedJobs(e.target.checked)}
                />
              }
              label={`Drop ${plural(approvedJobs, "approved job")} that may no longer fit`}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          loading={saving}
          onClick={() =>
            onConfirm({
              rebuildSearches: searchCount > 0 && rebuildSearches,
              dropApprovedJobs: approvedJobs > 0 && dropApprovedJobs,
            })
          }
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
