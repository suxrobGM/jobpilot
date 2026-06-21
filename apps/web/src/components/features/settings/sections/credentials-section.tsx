"use client";

import { useState, type ReactElement } from "react";
import type { CredentialInput } from "@jobpilot/contracts/credential";
import { Add, Delete, Key, Lock } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { api } from "@/api/eden";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { CredentialDto } from "@/api/types";
import { ConfirmDialog } from "@/components/ui/feedback/confirm-dialog";
import { SectionCard } from "@/components/ui/layout/section-card";
import { CredentialFormDialog } from "./credential-form-dialog";

export function CredentialsSection(): ReactElement {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CredentialDto | null>(null);

  const credentials = useApiQuery<CredentialDto[]>(queryKeys.credentials.list(), () =>
    api.credentials.get(),
  );

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
      onSuccess: () => setPendingDelete(null),
    },
  );

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
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={24} />
        </Box>
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
                  onDelete={() => setPendingDelete(c)}
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
                  onDelete={() => setPendingDelete(c)}
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete credential?"
        description={
          pendingDelete
            ? `Remove the "${pendingDelete.scope}" credential? Skills using this scope will fall back to the next match.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
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
