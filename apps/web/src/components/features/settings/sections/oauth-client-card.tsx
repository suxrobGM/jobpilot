"use client";

import type { ReactElement } from "react";
import { oauthClientUpsertSchema, type OAuthClientUpsertInput } from "@jobpilot/contracts/email";
import { CheckCircle, ContentCopy } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Link,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { EmailAccountStatus, OAuthClientStatus } from "@/api/types";
import { LoadingSpinner } from "@/components/ui/feedback";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout/section-card";
import { useConfirm } from "@/providers/confirm-provider";
import { useToast } from "@/providers/notification-provider";

/** "https://www.googleapis.com/auth/gmail.send" → "gmail.send". */
const shortScope = (scope: string): string => scope.split("/").pop() ?? scope;

const CARD_DESCRIPTION =
  "JobPilot connects Gmail through your own Google OAuth app, so it needs no Google verification. Create one in Google Cloud, then paste its Client ID and secret here.";

interface OAuthClientCardProps {
  /** SSR-fetched seed; omitted in client-only contexts (onboarding) where it fetches itself. */
  initialConfig?: OAuthClientStatus;
  initialStatus?: EmailAccountStatus;
}

/**
 * Step 1 — the user's own Google OAuth app. Reads its config and the mailbox
 * status (seeded by the SSR page, shared keys dedupe with the connect card),
 * then mounts the form once data is present so initial values are correct.
 */
export function OAuthClientCard(props: OAuthClientCardProps): ReactElement {
  const { initialConfig, initialStatus } = props;
  const config = useApiQuery<OAuthClientStatus>(
    queryKeys.email.oauthClient(),
    () => api.email.oauth.client.get(),
    { initialData: initialConfig },
  );
  const status = useApiQuery<EmailAccountStatus>(
    queryKeys.email.account(),
    () => api.email.account.get(),
    { initialData: initialStatus },
  );

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
  const toast = useToast();
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
    defaultValues: { clientId: config.clientId ?? "", clientSecret: "" } as OAuthClientUpsertInput,
    validators: { onSubmit: oauthClientUpsertSchema },
    onSubmit: ({ value }) => {
      save.mutate({ clientId: value.clientId, clientSecret: value.clientSecret });
    },
  });

  const copyRedirect = async (): Promise<void> => {
    await navigator.clipboard.writeText(config.redirectUri);
    toast.success("Redirect URI copied");
  };

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
            Create a project in{" "}
            <Link
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener"
            >
              Google Cloud Console
            </Link>{" "}
            and an OAuth 2.0 Client ID (type <strong>Web application</strong>).
          </Typography>
          <Typography component="li" variant="body2Muted">
            Enable the <strong>Gmail API</strong> for the project.
          </Typography>
          <Typography component="li" variant="body2Muted">
            Add the redirect URI below to the client&apos;s authorized redirect URIs.
          </Typography>
          <Typography component="li" variant="body2Muted">
            Add the scopes below, then add yourself as a Test user.
          </Typography>
          <Typography component="li" variant="body2Muted">
            Paste the Client ID and secret here and save.
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Redirect URI
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                flex: 1,
                px: 1.5,
                py: 1,
                borderRadius: 1,
                bgcolor: "action.hover",
                fontFamily: "monospace",
                fontSize: 13,
                overflowX: "auto",
                whiteSpace: "nowrap",
              }}
            >
              {config.redirectUri}
            </Box>
            <Tooltip title="Copy">
              <IconButton onClick={copyRedirect} aria-label="Copy redirect URI">
                <ContentCopy fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
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
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <Stack spacing={2} sx={{ maxWidth: 420 }}>
            <form.AppField name="clientId">
              {(field) => <field.TextField label="Client ID" />}
            </form.AppField>
            <form.AppField name="clientSecret">
              {(field) => (
                <field.TextField
                  label="Client secret"
                  type="password"
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
