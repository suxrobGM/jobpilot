"use client";

import type { ReactElement } from "react";
import { FormSection } from "@/components/ui/form/form-section";
import { FormSelectField } from "@/components/ui/form/form-select-field";
import type { AnyReactForm } from "@/components/ui/form/types";

const PNTD = "Prefer not to disclose";
const YES_NO_PNTD = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
  { value: PNTD, label: PNTD },
];

const GENDER = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Non-binary", label: "Non-binary" },
  { value: PNTD, label: PNTD },
];

const VETERAN = [
  { value: "I am not a protected veteran", label: "Not a protected veteran" },
  { value: "I am a protected veteran", label: "Protected veteran" },
  { value: PNTD, label: PNTD },
];

const DISABILITY = [
  { value: "Yes, I have a disability", label: "Yes" },
  { value: "No, I do not have a disability", label: "No" },
  { value: PNTD, label: PNTD },
];

interface EeoTabProps {
  form: AnyReactForm;
}

export function EeoTab(props: EeoTabProps): ReactElement {
  const { form } = props;
  return (
    <FormSection
      title="EEO"
      description="Used only when an application asks. Default is 'Prefer not to disclose'."
    >
      <FormSelectField form={form} name="eeoGender" label="Gender" items={GENDER} optional />
      <FormSelectField
        form={form}
        name="eeoRace"
        label="Race"
        items={[
          { value: "American Indian or Alaska Native", label: "American Indian or Alaska Native" },
          { value: "Asian", label: "Asian" },
          { value: "Black or African American", label: "Black or African American" },
          { value: "Native Hawaiian or Other Pacific Islander", label: "Native Hawaiian or Other Pacific Islander" },
          { value: "White", label: "White" },
          { value: "Two or more races", label: "Two or more races" },
          { value: PNTD, label: PNTD },
        ]}
        optional
      />
      <FormSelectField form={form} name="eeoHispanicOrLatino" label="Hispanic or Latino" items={YES_NO_PNTD} optional />
      <FormSelectField form={form} name="eeoVeteranStatus" label="Veteran status" items={VETERAN} optional />
      <FormSelectField form={form} name="eeoDisabilityStatus" label="Disability status" items={DISABILITY} optional />
    </FormSection>
  );
}
