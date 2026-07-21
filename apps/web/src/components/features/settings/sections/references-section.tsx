"use client";

import { type ReferenceInput, USER_DEFAULT_VALUES } from "@jobpilot/contracts/user";
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
          {(field) => {
            const refs = field.state.value ?? [];
            return (
              <Stack spacing={2}>
                {refs.map((_, i) => (
                  <Card key={keys[i]}>
                    <CardHeader
                      title={<Typography variant="overlineMuted">Reference {i + 1}</Typography>}
                      action={
                        <IconButton
                          aria-label={`Remove reference ${i + 1}`}
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
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
                {refs.length < 3 && (
                  <Box>
                    <Button
                      variant="outlined"
                      startIcon={<Add fontSize="sm" />}
                      onClick={() => {
                        onAdd();
                        field.pushValue(EMPTY_REFERENCE);
                      }}
                    >
                      Add reference
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
