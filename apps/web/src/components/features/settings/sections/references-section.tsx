"use client";

import { type ReferenceInput, USER_DEFAULT_VALUES } from "@jobpilot/contracts/user";
import { Stack } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { FieldRowList, FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { useKeyedList } from "@/hooks/use-keyed-list";

const EMPTY_REFERENCE: ReferenceInput = {
  name: "",
  relationship: "",
  company: "",
  email: "",
  phone: "",
};

export const ReferencesSection = withForm({
  defaultValues: USER_DEFAULT_VALUES,
  render: function ReferencesSection({ form }) {
    const count = useSelector(form.store, (s) => s.values.references?.length ?? 0);
    const { keys, onRemove, onAdd } = useKeyedList(count);

    return (
      <FormSection
        title="References"
        description="Up to 3 professional references, used to fill reference fields on application forms."
      >
        <form.AppField name="references" mode="array">
          {(field) => (
            <FieldRowList
              count={field.state.value?.length ?? 0}
              keys={keys}
              addLabel="Add reference"
              rowLabel={(i) => `Reference ${i + 1}`}
              max={3}
              onAdd={() => {
                onAdd();
                field.pushValue(EMPTY_REFERENCE);
              }}
              onRemove={(i) => {
                onRemove(i);
                field.removeValue(i);
              }}
            >
              {(i) => (
                <>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <form.AppField name={`references[${i}].name`}>
                      {(sub) => <sub.TextField label="Name" />}
                    </form.AppField>
                    <form.AppField name={`references[${i}].relationship`}>
                      {(sub) => <sub.TextField label="Relationship" />}
                    </form.AppField>
                  </Stack>
                  <form.AppField name={`references[${i}].company`}>
                    {(sub) => <sub.TextField label="Company" />}
                  </form.AppField>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <form.AppField name={`references[${i}].email`}>
                      {(sub) => <sub.TextField label="Email" type="email" />}
                    </form.AppField>
                    <form.AppField name={`references[${i}].phone`}>
                      {(sub) => <sub.Phone label="Phone" />}
                    </form.AppField>
                  </Stack>
                </>
              )}
            </FieldRowList>
          )}
        </form.AppField>
      </FormSection>
    );
  },
});
