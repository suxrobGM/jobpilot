"use client";

import { type ReactElement, useState } from "react";
import type { CredentialInput } from "@jobpilot/contracts/credential";
import { Add, Delete, Key, Lock } from "@mui/icons-material";
import { Box, Button, Card, CardContent, IconButton, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { credentialQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import type { CredentialDto } from "@/api/types";
import { LoadingSpinner } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout/section-card";
import { useConfirm } from "@/providers/confirm-provider";
import { CredentialFormDialog } from "./credential-form-dialog";

interface CredentialsSectionProps {
  /** SSR-fetched seed; omitted in client-only contexts (onboarding) where it fetches itself. */
  initialCredentials?: CredentialDto[];
}

export function CredentialsSection(props: CredentialsSectionProps): ReactElement {
  const { initialCredentials } = props;
  const [dialogOpen, setDialogOpen] = useState(false);
  const confirm = useConfirm();

  const credentials = useApiQuery(credentialQueries.list(), { initialData: initialCredentials });

  const create = useApiMutation<CredentialDto, CredentialInput>(
    (vars) => api.credentials.post(vars),
    {
      successMessage: "Credential added",
      invalidate: [queryKeys.credentials.all],
      onSuccess: () => setDialogOpen(false),
    },
  );

  const remove = useApiMutation<{ deleted: string }, string>(
    (id) => api.credentials({ id }).delete(),
    {
      successMessage: "Credential removed",
      invalidate: [queryKeys.credentials.all],
    },
  );

  const handleDelete = async (credential: CredentialDto): Promise<void> => {
    const confirmed = await confirm({
      title: "Delete credential?",
      description: `Remove the "${credential.scope}" credential? Skills using this scope will fall back to the next match.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (confirmed) {
      remove.mutate(credential.id);
    }
  };

  const rows = credentials.data ?? [];
  const logins = rows.filter((c) => !c.apiKey);
  const services = rows.filter((c) => c.apiKey);

  return (
    <SectionCard
      title="Login credentials"
      description="Used by skills to log into job boards, plus captcha-service API keys (2Captcha / CapSolver). Secrets are encrypted at rest."
      actions={
        <Button
          size="small"
          startIcon={<Add />}
          variant="contained"
          onClick={() => setDialogOpen(true)}
        >
          Add credential
        </Button>
      }
    >
      {credentials.isLoading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <Box sx={{ py: 3, textAlign: "center" }}>
          <Typography variant="body2Muted">
            No credentials yet. Add a &ldquo;default&rdquo; credential, or one per board domain
            (e.g. <code>linkedin.com</code>).
          </Typography>
        </Box>
      ) : (
        <Stack spacing={3}>
          {logins.length > 0 && (
            <CredentialGroup title="Job board logins">
              {logins.map((c) => (
                <CredentialRow
                  key={c.id}
                  credential={c}
                  icon={<Lock fontSize="small" color="action" />}
                  subtitle={c.email ?? ""}
                  onDelete={() => void handleDelete(c)}
                />
              ))}
            </CredentialGroup>
          )}
          {services.length > 0 && (
            <CredentialGroup title="Captcha services">
              {services.map((c) => (
                <CredentialRow
                  key={c.id}
                  credential={c}
                  icon={<Key fontSize="small" color="action" />}
                  subtitle={`API key ••••${c.apiKey?.slice(-4) ?? ""}`}
                  onDelete={() => void handleDelete(c)}
                />
              ))}
            </CredentialGroup>
          )}
        </Stack>
      )}

      <CredentialFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={(values) => create.mutate(values)}
        submitting={create.isPending}
      />
    </SectionCard>
  );
}

interface CredentialGroupProps {
  title: string;
  children: ReactElement[];
}

function CredentialGroup(props: CredentialGroupProps): ReactElement {
  const { title, children } = props;
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Stack spacing={1}>{children}</Stack>
    </Box>
  );
}

interface CredentialRowProps {
  credential: CredentialDto;
  icon: ReactElement;
  subtitle: string;
  onDelete: () => void;
}

function CredentialRow(props: CredentialRowProps): ReactElement {
  const { credential, icon, subtitle, onDelete } = props;
  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          {icon}
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {credential.scope}
            </Typography>
            <Typography variant="captionMuted">{subtitle}</Typography>
          </Box>
          <IconButton onClick={onDelete} aria-label="Delete credential">
            <Delete fontSize="small" />
          </IconButton>
        </Stack>
      </CardContent>
    </Card>
  );
}
