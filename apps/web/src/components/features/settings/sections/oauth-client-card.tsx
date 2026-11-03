"use client";

import type { ReactElement } from "react";
import {
  type EmailProvider,
  type OAuthClientUpsertInput,
  oauthClientUpsertSchema,
} from "@jobpilot/contracts/email";
import { CheckCircle } from "@mui/icons-material";
import { Alert, Box, Button, Chip, Link, Stack, Tooltip, Typography } from "@mui/material";
import type { z } from "zod/v4";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { emailQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import type { OAuthClientStatus } from "@/api/types";
import { CopyField } from "@/components/ui/display";
import { LoadingSpinner } from "@/components/ui/feedback";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout/section-card";
import { useConfirm } from "@/providers/confirm-provider";

/** "https://www.googleapis.com/auth/gmail.send" → "gmail.send". */
const shortScope = (scope: string): string => scope.split("/").pop() ?? scope;

const CARD_DESCRIPTION =
  "JobPilot connects Gmail through your own Google OAuth app, so it needs no Google verification. Create one in Google Cloud, then paste its Client ID and secret here.";

/**
 * Step 1 - the user's own Google OAuth app. Reads its config and the mailbox
 * status (shared keys dedupe with the connect card), then mounts the form
 * once data is present so initial values are correct.
 */
export function OAuthClientCard({ provider }: { provider: EmailProvider }): ReactElement {
  const config = useApiQuery(emailQueries.oauthClient(provider));
  const status = useApiQuery(emailQueries.account());

  if (!config.data || !status.data) {
    return (
      <SectionCard
        title="Mailbox OAuth client"
        description={
          provider === "microsoft"
            ? "Connect Microsoft 365 using your own Entra application."
            : CARD_DESCRIPTION
        }
      >
        <LoadingSpinner />
      </SectionCard>
    );
  }

  return (
    <OAuthClientForm
      key={provider}
      config={config.data}
      connected={status.data.connected && status.data.provider === provider}
    />
  );
}

interface OAuthClientFormProps {
  config: OAuthClientStatus;
  connected: boolean;
}

function OAuthClientForm(props: OAuthClientFormProps): ReactElement {
  const { config, connected } = props;
  const provider = config.provider;
  const microsoft = provider === "microsoft";
  const confirm = useConfirm();

  const save = useApiMutation((vars: OAuthClientUpsertInput) => api.email.oauth.client.put(vars), {
    successMessage: "OAuth client saved",
    invalidate: [queryKeys.email.all],
  });
  const remove = useApiMutation(
    () => api.email.oauth.client.delete(undefined, { query: { provider } }),
    {
      successMessage: "OAuth client removed",
      invalidate: [queryKeys.email.all],
    },
  );

  const form = useAppForm({
    defaultValues: {
      provider,
      clientId: config.clientId ?? "",
      clientSecret: "",
      tenantId: config.tenantId ?? "",
      mailbox: config.mailbox ?? "",
      allowSend: config.allowSend,
    } as z.input<typeof oauthClientUpsertSchema>,
    validators: { onSubmit: oauthClientUpsertSchema },
    onSubmit: ({ value }) => {
      save.mutate(oauthClientUpsertSchema.parse(value));
    },
  });

  const handleRemove = async (): Promise<void> => {
    const confirmed = await confirm({
      title: "Remove OAuth client?",
      description: "JobPilot will need this provider’s OAuth client before connecting again.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (confirmed) {
      remove.mutate();
    }
  };

  return (
    <SectionCard
      title={microsoft ? "Microsoft 365 OAuth client" : "Google OAuth client"}
      description={
        microsoft
          ? "Register your own Entra application, then save its tenant, client ID and secret. Your Microsoft account must already have access to the chosen mailbox."
          : CARD_DESCRIPTION
      }
    >
      <Stack spacing={2.5}>
        {config.configured && (
          <Alert severity="success" icon={<CheckCircle fontSize="inherit" />}>
            OAuth client configured.
          </Alert>
        )}

        {microsoft && (
          <Alert severity="info">
            Register a Web application in{" "}
            <Link href="https://entra.microsoft.com/" target="_blank" rel="noopener">
              Microsoft Entra
            </Link>
            , add the redirect URI below, and allow the listed delegated Graph permissions. Tenant
            policy may require administrator consent.{" "}
            <Link href="/docs/email-setup">Setup instructions</Link>
          </Alert>
        )}
        {!microsoft && (
          <Box component="ol" sx={{ pl: 2.5, m: 0 }}>
            <Typography component="li" variant="body2Muted">
              In the{" "}
              <Link
                href="https://console.cloud.google.com/projectcreate"
                target="_blank"
                rel="noopener"
              >
                Google Cloud Console
              </Link>
              , create or select a project, then enable the <strong>Gmail API</strong> (APIs &amp;
              Services &rarr; Library).
            </Typography>
            <Typography component="li" variant="body2Muted">
              Open <strong>Google Auth Platform &rarr; Branding</strong>, set the app name and
              support email, and choose audience type <strong>External</strong>.
            </Typography>
            <Typography component="li" variant="body2Muted">
              Under <strong>Data Access &rarr; Add or remove scopes</strong>, add the scopes listed
              below (they aren&apos;t set on the client screen).
            </Typography>
            <Typography component="li" variant="body2Muted">
              Under <strong>Audience &rarr; Test users</strong>, add your own Google account (the
              app can stay in Testing mode).
            </Typography>
            <Typography component="li" variant="body2Muted">
              Under <strong>Clients</strong>, create an <strong>OAuth client ID</strong> of type{" "}
              <strong>Web application</strong> and paste the redirect URI below into its{" "}
              <strong>Authorized redirect URIs</strong>.
            </Typography>
            <Typography component="li" variant="body2Muted">
              Copy the generated <strong>Client ID</strong> and <strong>Client secret</strong> into
              the fields below and save.
            </Typography>
          </Box>
        )}

        <Box>
          <Typography variant="overlineMuted" gutterBottom>
            Redirect URI
          </Typography>
          <CopyField
            value={config.redirectUri}
            copyMessage="Redirect URI copied"
            ariaLabel="Copy redirect URI"
          />
        </Box>

        <Box>
          <Typography variant="overlineMuted" gutterBottom>
            Scopes
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {config.scopes.map((scope) => (
              <Chip key={scope} label={shortScope(scope)} size="small" variant="outlined" />
            ))}
          </Stack>
          {!microsoft && (
            <Typography variant="captionMuted" sx={{ display: "block", mt: 0.5 }}>
              gmail.readonly is a restricted scope, but works in your own Testing-mode project
              without a CASA audit.
            </Typography>
          )}
        </Box>

        <Box
          component="form"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <Stack spacing={2} sx={{ maxWidth: 420 }}>
            {microsoft && (
              <>
                <form.AppField name="tenantId">
                  {(field) => (
                    <field.TextField
                      label="Directory (tenant) ID"
                      disabled={connected}
                      helperText="Microsoft 365 tenant UUID"
                    />
                  )}
                </form.AppField>
                <form.AppField name="mailbox">
                  {(field) => (
                    <field.TextField
                      label="Shared mailbox address (optional)"
                      disabled={connected}
                      helperText="Leave blank for your own work mailbox. Disconnect before changing mailboxes."
                    />
                  )}
                </form.AppField>
                <form.AppField name="allowSend">
                  {(field) => <field.Switch label="Request permission to send mail" />}
                </form.AppField>
              </>
            )}
            <form.AppField name="clientId">
              {(field) => (
                <field.TextField
                  label="Client ID"
                  disabled={connected}
                  autoComplete="off"
                  placeholder={
                    microsoft
                      ? "Application (client) ID"
                      : "1234567890-abc123def456.apps.googleusercontent.com"
                  }
                  helperText={config.configured ? `Current: ${config.clientId}` : undefined}
                />
              )}
            </form.AppField>
            <form.AppField name="clientSecret">
              {(field) => (
                <field.TextField
                  label="Client secret"
                  type="password"
                  autoComplete="new-password"
                  placeholder={
                    microsoft ? "Client secret value" : "GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
                  }
                  helperText={
                    config.configured ? "Leave blank to keep the current secret" : undefined
                  }
                />
              )}
            </form.AppField>
            <Stack direction="row" spacing={1.5}>
              <form.AppForm>
                <form.SubmitButton disabled={save.isPending}>
                  {config.configured ? "Update client" : "Save client"}
                </form.SubmitButton>
              </form.AppForm>
              {config.configured && (
                <Tooltip title={connected ? "Disconnect the mailbox first" : ""}>
                  <span>
                    <Button
                      variant="outlined"
                      color="error"
                      disabled={connected || remove.isPending}
                      onClick={() => void handleRemove()}
                    >
                      Remove client
                    </Button>
                  </span>
                </Tooltip>
              )}
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </SectionCard>
  );
}
