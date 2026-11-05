"use client";

import { useQuery } from "@tanstack/react-query";
import { jobBoardQueries } from "@/api/queries";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { INSTRUCTIONS_FORM_DEFAULTS } from "./form-schema";

export const BoardsSection = withForm({
  defaultValues: INSTRUCTIONS_FORM_DEFAULTS,
  render: function BoardsSection({ form }) {
    const boardsQuery = useQuery(jobBoardQueries.list());
    const domains = boardsQuery.data?.map((board) => board.domain) ?? [];

    return (
      <FormSection
        title="Boards"
        description="Which job boards the pilot searches, and in what order."
      >
        <form.AppField name="boards">
          {(field) => (
            <field.Multiselect
              label="Boards"
              options={domains}
              helperText="The pilot moves to the next board each cycle, so all of them get worked. Empty = whichever board each saved search was created with."
            />
          )}
        </form.AppField>
      </FormSection>
    );
  },
});
