"use client";

import { PROFILE_DEFAULT_VALUES } from "@jobpilot/contracts/profile";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";

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

const RACE = [
  { value: "American Indian or Alaska Native", label: "American Indian or Alaska Native" },
  { value: "Asian", label: "Asian" },
  { value: "Black or African American", label: "Black or African American" },
  {
    value: "Native Hawaiian or Other Pacific Islander",
    label: "Native Hawaiian or Other Pacific Islander",
  },
  { value: "White", label: "White" },
  { value: "Two or more races", label: "Two or more races" },
  { value: PNTD, label: PNTD },
];

export const EeoSection = withForm({
  defaultValues: PROFILE_DEFAULT_VALUES,
  render: function EeoSection({ form }) {
    return (
      <FormSection
        title="EEO"
        description="Used only when an application asks. Default is 'Prefer not to disclose'."
      >
        <form.AppField name="eeoGender">
          {(field) => <field.Select label="Gender" items={GENDER} optional />}
        </form.AppField>
        <form.AppField name="eeoRace">
          {(field) => <field.Select label="Race" items={RACE} optional />}
        </form.AppField>
        <form.AppField name="eeoHispanicOrLatino">
          {(field) => <field.Select label="Hispanic or Latino" items={YES_NO_PNTD} optional />}
        </form.AppField>
        <form.AppField name="eeoVeteranStatus">
          {(field) => <field.Select label="Veteran status" items={VETERAN} optional />}
        </form.AppField>
        <form.AppField name="eeoDisabilityStatus">
          {(field) => <field.Select label="Disability status" items={DISABILITY} optional />}
        </form.AppField>
      </FormSection>
    );
  },
});
