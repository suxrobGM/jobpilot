"use client";

import {
  SALARY_CURRENCIES,
  type SalaryCurrency,
  type SalaryPreferenceInput,
  USER_DEFAULT_VALUES,
} from "@jobpilot/contracts/user";
import { Add, Delete } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { useKeyedList } from "@/hooks/use-keyed-list";

const EMPTY_SALARY_PREFERENCE: SalaryPreferenceInput = {
  appliesTo: "",
  minAmount: undefined,
  maxAmount: undefined,
  currency: "USD",
  period: "yearly",
};

const PERIODS = [
  { value: "yearly", label: "Per year" },
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
              <Stack spacing={2}>
                {prefs.map((pref, i) => (
                  <Card key={keys[i]}>
                    <CardHeader
                      title={<Typography variant="overlineMuted">Preference {i + 1}</Typography>}
                      action={
                        <IconButton
                          aria-label={`Remove salary preference ${i + 1}`}
                          size="small"
                          onClick={() => {
                            onRemove(i);
                            field.removeValue(i);
                          }}
                        >
                          <Delete fontSize="sm" />
                        </IconButton>
                      }
                    />
                    <CardContent>
                      <Stack spacing={2}>
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
                                symbol={CURRENCY_SYMBOLS[pref.currency]}
                              />
                            )}
                          </form.AppField>
                          <form.AppField name={`salaryPreferences[${i}].maxAmount`}>
                            {(sub) => (
                              <sub.Currency
                                label="Maximum"
                                allowDecimals
                                symbol={CURRENCY_SYMBOLS[pref.currency]}
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
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
                {prefs.length < 5 && (
                  <Box>
                    <Button
                      variant="outlined"
                      startIcon={<Add fontSize="sm" />}
                      onClick={() => {
                        onAdd();
                        field.pushValue(EMPTY_SALARY_PREFERENCE);
                      }}
                    >
                      Add salary preference
                    </Button>
                  </Box>
                )}
              </Stack>
            );
          }}
        </form.AppField>
      </FormSection>
    );
  },
});
