"use client";

import { type ReactElement, useState } from "react";
import { MAX_PAGE_SIZE } from "@jobpilot/contracts/pagination";
import type { PilotChangeAction, PilotState } from "@jobpilot/contracts/pilot";
import { Stack } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod/v4";
import { pilotQueries, pipelineQueries } from "@/api/queries";
import { useAppForm } from "@/components/ui/form/tanstack";
import { useMakeChange } from "../changes/use-changes";
import { GoalsChangeDialog, type GoalsImpact, type GoalsRetirement } from "./goals-change-dialog";

const goalsSchema = z.object({
  goals: z.string().trim().min(1, "Write what you want the pilot to do."),
});

const GOALS_CHANGED_REASON = "Goals changed before this was applied to.";

interface PendingGoals {
  goals: string;
  impact: GoalsImpact;
  searchIds: string[];
  approved: { campaignId: string; key: string }[];
}

interface GoalsFormProps {
  state: PilotState;
}

export function GoalsForm(props: GoalsFormProps): ReactElement {
  const { state } = props;
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingGoals | null>(null);
  const save = useMakeChange(() => setPending(null));

  const commit = async (goals: string, actions: PilotChangeAction[]) => {
    await save.mutateAsync({
      summary: "Rewrote the goals",
      actions: [{ type: "goals.set", goals }, ...actions],
    });
    form.reset({ goals });
  };

  const form = useAppForm({
    defaultValues: { goals: state.instructionsGoals },
    validators: { onSubmit: goalsSchema },
    onSubmit: async ({ value }) => {
      if (value.goals === state.instructionsGoals) return;
      // Read on save, not on mount, so the dialog sees what the old goals left running now.
      const [searches, toApply] = await Promise.all([
        queryClient.fetchQuery(pilotQueries.searches()),
        queryClient.fetchQuery(
          pipelineQueries.jobs({ view: "toApply", page: 1, limit: MAX_PAGE_SIZE }),
        ),
      ]);
      const approved = toApply.items.filter((job) => job.status === "approved");
      if (searches.length === 0 && approved.length === 0) {
        await commit(value.goals, []);
        return;
      }
      setPending({
        goals: value.goals,
        impact: { searchNames: searches.map((s) => s.name), approvedJobs: approved.length },
        searchIds: searches.map((s) => s.id),
        approved: approved.map((job) => ({ campaignId: job.campaignId, key: job.key })),
      });
    },
  });

  const confirm = (retire: GoalsRetirement): void => {
    if (!pending) return;
    const actions: PilotChangeAction[] = [];
    if (retire.rebuildSearches) {
      actions.push(
        ...pending.searchIds.map((searchId) => ({ type: "search.delete" as const, searchId })),
      );
    }
    if (retire.dropApprovedJobs) {
      actions.push({ type: "jobs.skip", refs: pending.approved, reason: GOALS_CHANGED_REASON });
    }
    void commit(pending.goals, actions);
  };

  return (
    <Stack
      component="form"
      spacing={2}
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.AppField name="goals">
        {(field) => (
          <field.TextField
            label="Goals"
            required
            multiline
            minRows={6}
            maxRows={20}
            placeholder="e.g. Senior frontend roles at Series A-C startups, remote or NYC. Must sponsor F1/OPT. Skip crypto and agencies."
            helperText="Roles, priorities and constraints in plain words. The pilot builds and re-runs its searches from these."
            // Goals are the pilot's whole steering input, so let the user drag the box taller.
            sx={{ "& textarea": { resize: "vertical" } }}
          />
        )}
      </form.AppField>
      <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
        <form.AppForm>
          <form.SubmitButton>Save goals</form.SubmitButton>
        </form.AppForm>
      </Stack>
      <GoalsChangeDialog
        impact={pending?.impact ?? null}
        saving={save.isPending}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </Stack>
  );
}
