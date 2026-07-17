"use client";

import { useApiQuery } from "@/api/hooks";
import { jobBoardQueries } from "@/api/queries";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { INSTRUCTIONS_FORM_DEFAULTS } from "../instructions-form-schema";

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
            <field.Multiselect
              label="Parked boards"
              options={domains}
              helperText="Boards the pilot set aside after repeated failures (board-health questions write these). Remove one to resume using it."
            />
          )}
        </form.AppField>
      </FormSection>
    );
  },
});
