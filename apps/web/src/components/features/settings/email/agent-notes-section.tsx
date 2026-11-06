"use client";

import { USER_DEFAULT_VALUES } from "@jobpilot/contracts/user";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";

export const AgentNotesSection = withForm({
  defaultValues: USER_DEFAULT_VALUES,
  render: function AgentNotesSection({ form }) {
    return (
      <FormSection
        title="Agent instructions"
        description="Standing guidance the agent applies on every run — for example, years of experience to state or topics to avoid. It steers the agent's answers and writing; it does not change your profile fields."
      >
        <form.AppField name="agentNotes">
          {(field) => (
            <field.TextField
              label="Instructions"
              multiline
              minRows={4}
              helperText="Up to 2000 characters. Per-question answers are managed under Saved answers."
            />
          )}
        </form.AppField>
      </FormSection>
    );
  },
});
