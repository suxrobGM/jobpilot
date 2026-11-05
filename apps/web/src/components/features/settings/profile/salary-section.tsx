"use client";

import {
  SALARY_CURRENCIES,
  type SalaryCurrency,
  type SalaryPeriod,
  type SalaryPreferenceInput,
  USER_DEFAULT_VALUES,
} from "@jobpilot/contracts/user";
import { Stack } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { FieldRowList, FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { useKeyedList } from "@/hooks/use-keyed-list";

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
    const count = useSelector(form.store, (s) => s.values.salaryPreferences?.length ?? 0);
    const { keys, onRemove, onAdd } = useKeyedList(count);

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
                keys={keys}
                addLabel="Add salary preference"
                rowLabel={(i) => `Salary preference ${i + 1}`}
                max={5}
                onAdd={() => {
                  onAdd();
                  field.pushValue(EMPTY_SALARY_PREFERENCE);
                }}
                onRemove={(i) => {
                  onRemove(i);
                  field.removeValue(i);
                }}
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
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <form.AppField name={`salaryPreferences[${i}].minAmount`}>
                        {(sub) => (
                          <sub.Currency
                            label="Minimum"
                            allowDecimals
                            symbol={CURRENCY_SYMBOLS[prefs[i].currency]}
                          />
                        )}
                      </form.AppField>
                      <form.AppField name={`salaryPreferences[${i}].maxAmount`}>
                        {(sub) => (
                          <sub.Currency
                            label="Maximum"
                            allowDecimals
                            symbol={CURRENCY_SYMBOLS[prefs[i].currency]}
                          />
                        )}
                      </form.AppField>
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <form.AppField name={`salaryPreferences[${i}].period`}>
                        {(sub) => <sub.Select label="Period" items={PERIODS} />}
                      </form.AppField>
                      <form.AppField name={`salaryPreferences[${i}].currency`}>
                        {(sub) => <sub.Select label="Currency" items={CURRENCIES} />}
                      </form.AppField>
                    </Stack>
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
