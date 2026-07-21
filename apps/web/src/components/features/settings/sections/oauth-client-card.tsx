"use client";

import type { ReactElement } from "react";
import { type OAuthClientUpsertInput, oauthClientUpsertSchema } from "@jobpilot/contracts/email";
import { CheckCircle } from "@mui/icons-material";
import { Alert, Box, Button, Chip, Link, Stack, Tooltip, Typography } from "@mui/material";
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
export function OAuthClientCard(): ReactElement {
  const config = useApiQuery(emailQueries.oauthClient());
  const status = useApiQuery(emailQueries.account());

  if (!config.data || !status.data) {
    return (
      <SectionCard title="Google OAuth client" description={CARD_DESCRIPTION}>
        <LoadingSpinner />
      </SectionCard>
    );
  }

  return <OAuthClientForm config={config.data} connected={status.data.connected} />;
}

interface OAuthClientFormProps {
  config: OAuthClientStatus;
  connected: boolean;
}

function OAuthClientForm(props: OAuthClientFormProps): ReactElement {
  const { config, connected } = props;
  const confirm = useConfirm();

  const save = useApiMutation<OAuthClientStatus, OAuthClientUpsertInput>(
    (vars) => api.email.oauth.client.put(vars),
    { successMessage: "OAuth client saved", invalidate: [queryKeys.email.all] },
  );
  const remove = useApiMutation<{ deleted: boolean }, void>(() => api.email.oauth.client.delete(), {
    successMessage: "OAuth client removed",
    invalidate: [queryKeys.email.all],
  });

  const form = useAppForm({
    defaultValues: { clientId: "", clientSecret: "" } as OAuthClientUpsertInput,
    validators: { onSubmit: oauthClientUpsertSchema },
    onSubmit: ({ value }) => {
      save.mutate({ clientId: value.clientId, clientSecret: value.clientSecret });
    },
  });

  const handleRemove = async (): Promise<void> => {
    const confirmed = await confirm({
      title: "Remove OAuth client?",
      description: "JobPilot won't be able to connect Gmail until you add a client again.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (confirmed) {
      remove.mutate();
    }
  };

  return (
    <SectionCard title="Google OAuth client" description={CARD_DESCRIPTION}>
      <Stack spacing={2.5}>
        {config.configured && (
          <Alert severity="success" icon={<CheckCircle fontSize="inherit" />}>
            OAuth client configured.
          </Alert>
        )}

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
            Open <strong>Google Auth Platform &rarr; Branding</strong>, set the app name and support
            email, and choose audience type <strong>External</strong>.
          </Typography>
          <Typography component="li" variant="body2Muted">
            Under <strong>Data Access &rarr; Add or remove scopes</strong>, add the scopes listed
            below (they aren&apos;t set on the client screen).
          </Typography>
          <Typography component="li" variant="body2Muted">
            Under <strong>Audience &rarr; Test users</strong>, add your own Google account (the app
            can stay in Testing mode).
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
          <Typography variant="captionMuted" sx={{ display: "block", mt: 0.5 }}>
            gmail.readonly is a restricted scope, but works in your own Testing-mode project without
            a CASA audit.
          </Typography>
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
            <form.AppField name="clientId">
              {(field) => (
                <field.TextField
                  label="Client ID"
                  autoComplete="off"
                  placeholder="1234567890-abc123def456.apps.googleusercontent.com"
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
                  placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
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
