"use client";

import type { ReactElement } from "react";
import { type PortfolioSettingsPatch, usernameSchema } from "@jobpilot/contracts/user";
import { OpenInNew } from "@mui/icons-material";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { userQueries } from "@/api/queries";
import type { PortfolioSettingsDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { TOP_BAR_HEIGHT } from "@/components/layout/shell-config";
import { CopyField } from "@/components/ui/display";
import { LoadingSpinner } from "@/components/ui/feedback";
import { useAppForm } from "@/components/ui/form/tanstack";
import { PageActions, SectionCard } from "@/components/ui/layout";
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
    // Settings beside the page they shape, so every change is checked against the preview.
    <Box
      component="form"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      sx={{
        display: "grid",
        gap: 3,
        alignItems: "start",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "380px minmax(0, 1fr)" },
      }}
    >
      <PageActions>
        <Button href={publicUrl} variant="outlined" endIcon={<OpenInNew />}>
          View public page
        </Button>
      </PageActions>
      <Box
        sx={(theme) => ({
          position: { lg: "sticky" },
          top: `calc(${TOP_BAR_HEIGHT.desktop}px + ${theme.spacing(3)})`,
        })}
      >
        <SectionCard
          title="Public portfolio"
          description="Your hire-me page, built from your primary resume and search activity."
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

            <CopyField value={publicUrl} copyMessage="Portfolio link copied" />

            <form.AppForm>
              <form.SubmitButton>Save settings</form.SubmitButton>
            </form.AppForm>
          </Stack>
        </SectionCard>
      </Box>

      <SectionCard
        title="Preview"
        description="Exactly what visitors see - drawn from your primary resume."
      >
        <PortfolioPreview />
      </SectionCard>
    </Box>
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
