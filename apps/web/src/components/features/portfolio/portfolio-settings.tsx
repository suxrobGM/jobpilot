"use client";

import type { ReactElement } from "react";
import { type PortfolioSettingsPatch, usernameSchema } from "@jobpilot/contracts/user";
import { OpenInNew } from "@mui/icons-material";
import { Button, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { userQueries } from "@/api/queries";
import type { PortfolioSettingsDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { CopyField } from "@/components/ui/display";
import { LoadingSpinner } from "@/components/ui/feedback";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { toPortfolioFormValues } from "./portfolio-form-values";
import { PortfolioView } from "./portfolio-view";
import { PortfolioVisibilityFields } from "./portfolio-visibility-fields";

const AVAILABILITY_ITEMS = [
  { value: "open", label: "Open to work" },
  { value: "not_looking", label: "Not looking" },
] as const;

export function PortfolioSettings(): ReactElement {
  const settingsQuery = useQuery(userQueries.portfolio());

  if (!settingsQuery.data) {
    return (
      <SectionCard title="Public portfolio">
        <LoadingSpinner />
      </SectionCard>
    );
  }

  return <PortfolioForm settings={settingsQuery.data} />;
}

interface PortfolioFormProps {
  settings: PortfolioSettingsDto;
}

function PortfolioForm(props: PortfolioFormProps): ReactElement {
  const { settings } = props;

  const save = useApiMutation((body: PortfolioSettingsPatch) => api.user.portfolio.patch(body), {
    successMessage: "Portfolio settings saved",
    invalidate: [userQueries.portfolio().queryKey, userQueries.portfolioPreview().queryKey],
  });

  const form = useAppForm({
    defaultValues: toPortfolioFormValues(settings),
    onSubmit: async ({ value }) => {
      const { availability, ...rest } = value;
      await save.mutateAsync({ ...rest, availability: availability === "" ? null : availability });
    },
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = `${origin}/u/${settings.username}`;

  return (
    <Stack
      component="form"
      spacing={3}
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <SectionCard
        title="Public portfolio"
        description="Your always-on hire-me page, built from your active resume and job-search activity. Pick a memorable username to share it."
      >
        <Stack spacing={2.5}>
          <form.AppField
            name="username"
            validators={{
              onChange: usernameSchema,
              onChangeAsyncDebounceMs: 350,
              // The caller's own username always reads as free, so skip the round trip.
              onChangeAsync: async ({ value }) => {
                if (value === settings.username) {
                  return undefined;
                }
                const { data } = await api.user.portfolio.available.get({
                  query: { username: value },
                });
                return data?.available ? undefined : "That username is already taken.";
              },
            }}
          >
            {(field) => (
              <field.TextField
                label="Username"
                transform={(v) => v.toLowerCase()}
                helperText="Your page lives at /u/<username>."
              />
            )}
          </form.AppField>

          <form.AppField name="availability">
            {(field) => (
              <field.Select
                label="Availability"
                items={AVAILABILITY_ITEMS}
                optional
                emptyLabel="Not shown"
                helperText="Shown as a badge on your page."
              />
            )}
          </form.AppField>

          <PortfolioVisibilityFields form={form} />

          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1 }}>
            <form.AppForm>
              <form.SubmitButton>Save settings</form.SubmitButton>
            </form.AppForm>
            <Button href={publicUrl} variant="outlined" endIcon={<OpenInNew />}>
              View public page
            </Button>
          </Stack>

          <CopyField value={publicUrl} copyMessage="Portfolio link copied" />
        </Stack>
      </SectionCard>

      <SectionCard
        title="Preview"
        description="Exactly what visitors see - drawn from your primary resume."
      >
        <PortfolioPreview />
      </SectionCard>
    </Stack>
  );
}

function PortfolioPreview(): ReactElement {
  const previewQuery = useQuery(userQueries.portfolioPreview());

  if (previewQuery.isPending) {
    return <LoadingSpinner />;
  }
  if (!previewQuery.data) {
    return <Typography variant="body2Muted">Add a primary resume to see your preview.</Typography>;
  }
  return <PortfolioView portfolio={previewQuery.data} showFooter={false} />;
}
