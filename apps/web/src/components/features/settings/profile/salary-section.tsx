"use client";

import {
  SALARY_CURRENCIES,
  type SalaryCurrency,
  type SalaryPeriod,
  type SalaryPreferenceInput,
  USER_DEFAULT_VALUES,
} from "@jobpilot/contracts/user";
import { Grid } from "@mui/material";
import { FieldRowList, FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";

const EMPTY_SALARY_PREFERENCE: SalaryPreferenceInput = {
  appliesTo: "",
  minAmount: undefined,
  maxAmount: undefined,
  currency: "USD",
  period: "yearly",
};

const PERIODS: { value: SalaryPeriod; label: string }[] = [
  { value: "yearly", label: "Per year" },
  { value: "monthly", label: "Per month" },
  { value: "hourly", label: "Per hour" },
];

const CURRENCY_SYMBOLS: Record<SalaryCurrency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
  INR: "₹",
};
const CURRENCIES = SALARY_CURRENCIES.map((code) => ({ value: code, label: code }));

export const SalarySection = withForm({
  defaultValues: USER_DEFAULT_VALUES,
  render: function SalarySection({ form }) {
    return (
      <FormSection
        title="Salary preferences"
        description="Optional. The agent uses the best-matching entry to answer salary questions on application forms; with no match it asks you."
      >
        <form.AppField name="salaryPreferences" mode="array">
          {(field) => {
            const prefs = field.state.value ?? [];
            return (
              <FieldRowList
                count={prefs.length}
                addLabel="Add salary preference"
                rowLabel={(i) => `Salary preference ${i + 1}`}
                max={5}
                onAdd={() => field.pushValue(EMPTY_SALARY_PREFERENCE)}
                onRemove={(i) => field.removeValue(i)}
              >
                {(i) => (
                  <>
                    <form.AppField name={`salaryPreferences[${i}].appliesTo`}>
                      {(sub) => (
                        <sub.TextField
                          label="Applies to"
                          placeholder="e.g. Senior/Staff engineering roles"
                        />
                      )}
                    </form.AppField>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <form.AppField name={`salaryPreferences[${i}].minAmount`}>
                          {(sub) => (
                            <sub.Currency
                              label="Minimum"
                              allowDecimals
                              symbol={CURRENCY_SYMBOLS[prefs[i].currency]}
                            />
                          )}
                        </form.AppField>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <form.AppField name={`salaryPreferences[${i}].maxAmount`}>
                          {(sub) => (
                            <sub.Currency
                              label="Maximum"
                              allowDecimals
                              symbol={CURRENCY_SYMBOLS[prefs[i].currency]}
                            />
                          )}
                        </form.AppField>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <form.AppField name={`salaryPreferences[${i}].period`}>
                          {(sub) => <sub.Select label="Period" items={PERIODS} />}
                        </form.AppField>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <form.AppField name={`salaryPreferences[${i}].currency`}>
                          {(sub) => <sub.Select label="Currency" items={CURRENCIES} />}
                        </form.AppField>
                      </Grid>
                    </Grid>
                  </>
                )}
              </FieldRowList>
            );
          }}
        </form.AppField>
      </FormSection>
    );
  },
});
