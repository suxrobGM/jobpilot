"use client";

import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { FormMultiselectField } from "@/components/ui/form/form-multiselect-field";
import { FormSection } from "@/components/ui/form/form-section";
import { FormSelectField } from "@/components/ui/form/form-select-field";
import { FormTextField } from "@/components/ui/form/form-text-field";
import type { AnyReactForm } from "@/components/ui/form/types";

const CONFIRM_MODES = [
  { value: "batch", label: "Confirm in batch (recommended)" },
  { value: "auto", label: "Auto-apply (no confirm)" },
];

interface AutopilotTabProps {
  form: AnyReactForm;
}

export function AutopilotTab(props: AutopilotTabProps): ReactElement {
  const { form } = props;
  return (
    <FormSection
      title="Autopilot"
      description="Defaults used by the autopilot and apply-batch skills."
    >
      <Stack direction="row" spacing={2}>
        <FormTextField
          form={form}
          name="autopilot.minMatchScore"
          label="Min match score (0-10)"
          type="number"
        />
        <FormTextField
          form={form}
          name="autopilot.maxApplicationsPerRun"
          label="Max applications per run"
          type="number"
        />
      </Stack>
      <FormSelectField
        form={form}
        name="autopilot.confirmMode"
        label="Confirmation mode"
        items={CONFIRM_MODES}
      />
      <Stack direction="row" spacing={2}>
        <FormTextField form={form} name="autopilot.minSalary" label="Min salary" type="number" />
        <FormTextField form={form} name="autopilot.maxSalary" label="Max salary" type="number" />
      </Stack>
      <FormTextField
        form={form}
        name="autopilot.salaryExpectation"
        label="Salary expectation (free text)"
      />
      <FormTextField
        form={form}
        name="autopilot.defaultStartDate"
        label="Default start date answer"
      />
      <FormMultiselectField
        form={form}
        name="autopilot.skipCompanies"
        label="Skip companies"
        placeholder="Add a company name"
      />
      <FormMultiselectField
        form={form}
        name="autopilot.skipTitleKeywords"
        label="Skip title keywords"
        placeholder="Add a keyword"
      />
    </FormSection>
  );
}
