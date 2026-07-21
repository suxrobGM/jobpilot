"use client";

import type { ReactNode } from "react";
import { Chip, Stack, Typography } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { jobBoardQueries } from "@/api/queries";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { INSTRUCTIONS_FORM_DEFAULTS } from "./form-schema";

export const BoardsSection = withForm({
  defaultValues: INSTRUCTIONS_FORM_DEFAULTS,
  render: function BoardsSection({ form }) {
    const boardsQuery = useApiQuery(jobBoardQueries.list());
    const domains = boardsQuery.data?.map((board) => board.domain) ?? [];

    return (
      <FormSection title="Boards" description="Which configured job boards the pilot works.">
        <form.AppField name="boards">
          {(field) => (
            <field.Multiselect
              label="Boards"
              options={domains}
              helperText="Boards the pilot may use. Empty = all configured boards."
            />
          )}
        </form.AppField>
        <form.AppField name="parkedBoards">
          {(field) => (
            <ParkedBoards
              parked={field.state.value ?? []}
              onRemove={(domain) =>
                field.handleChange(field.state.value.filter((d) => d !== domain))
              }
            />
          )}
        </form.AppField>
      </FormSection>
    );
  },
});

interface ParkedBoardsProps {
  parked: string[];
  onRemove: (domain: string) => void;
}

/** Remove-only chips, hidden while empty - parking happens via board-health questions, and an
 *  add-capable input here would read as another exclude list. */
function ParkedBoards(props: ParkedBoardsProps): ReactNode {
  const { parked, onRemove } = props;
  if (parked.length === 0) {
    return null;
  }

  return (
    <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
      <Typography variant="overlineMuted">Parked boards</Typography>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        {parked.map((domain) => (
          <Chip key={domain} label={domain} onDelete={() => onRemove(domain)} />
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Set aside by the pilot after repeated failures. Remove one to resume using it.
      </Typography>
    </Stack>
  );
}
