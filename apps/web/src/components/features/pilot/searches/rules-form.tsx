"use client";

import type { ReactElement } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Grid, Stack } from "@mui/material";
import { z } from "zod/v4";
import { useAppForm } from "@/components/ui/form/tanstack";
import { useToast } from "@/providers/toast-provider";
import { useMakeChange } from "../changes/use-changes";

const rulesSchema = z.object({
  dailyApplyCap: z.number().int().min(0),
  minScore: z.number().min(0).max(100),
  dealBreakers: z.array(z.string().trim().min(1)),
  preferCapExempt: z.boolean(),
});

interface RulesFormProps {
  state: PilotState;
  /** Runs after a save, e.g. to close the dialog the form sits in. */
  onSaved?: () => void;
}

/** The cap, min score, deal-breakers and cap-exempt preference, as one change with Undo. */
export function RulesForm(props: RulesFormProps): ReactElement {
  const { state, onSaved } = props;
  const toast = useToast();
  const { dailyApplyCap, minScore, dealBreakers, preferCapExempt } = state.config;
  const save = useMakeChange(onSaved);

  const form = useAppForm({
    defaultValues: { dailyApplyCap, minScore, dealBreakers, preferCapExempt },
    validators: { onSubmit: rulesSchema },
    onSubmitInvalid: () => toast.error("Fix the highlighted fields"),
    onSubmit: async ({ value }) => {
      await save.mutateAsync({
        summary: "Updated the rules",
        actions: [{ type: "rules.set", ...value }],
      });
      form.reset(value);
    },
  });

  return (
    <Stack
      component="form"
      spacing={2}
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <form.AppField name="dailyApplyCap">
            {(field) => (
              <field.TextField
                label="Daily apply cap"
                type="number"
                helperText="Most jobs applied to in a day."
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
              />
            )}
          </form.AppField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <form.AppField name="minScore">
            {(field) => (
              <field.TextField
                label="Min score"
                type="number"
                helperText="Only apply to matches at or above this (0–100)."
                slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
              />
            )}
          </form.AppField>
        </Grid>
      </Grid>
      <form.AppField name="dealBreakers">
        {(field) => (
          <field.MultiSelect
            label="Deal-breakers"
            placeholder="e.g. security clearance, unpaid, relocation"
            helperText="The pilot skips any job that hits one of these. Type one and press Enter."
          />
        )}
      </form.AppField>
      <form.AppField name="preferCapExempt">
        {(field) => <field.Switch label="Prefer H-1B cap-exempt employers" />}
      </form.AppField>
      <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
        <form.AppForm>
          <form.SubmitButton>Save rules</form.SubmitButton>
        </form.AppForm>
      </Stack>
    </Stack>
  );
}
