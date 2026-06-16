"use client";

import { useState, type ReactElement } from "react";
import type { CredentialInput } from "@jobpilot/contracts/credential";
import { Add, Delete } from "@mui/icons-material";
import { Box, Button, Card, CardContent, IconButton, Stack, Typography } from "@mui/material";
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

  const remove = useApiMutation<{ deleted: number }, number>(
    (id) => api.credentials({ id }).delete(),
    {
      successMessage: "Credential removed",
      invalidate: [queryKeys.credentials.all],
      onSuccess: () => setPendingDelete(null),
    },
  );

  const rows = credentials.data ?? [];

  const subtitle = (c: CredentialDto): string =>
    c.apiKey ? `API key ••••${c.apiKey.slice(-4)}` : (c.email ?? "");

  return (
    <SectionCard
      title="Login credentials"
      description="Used by skills to log into job boards, plus captcha-service API keys (2Captcha / CapSolver). Stored locally in plaintext on your machine."
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
      {rows.length === 0 ? (
        <Box sx={{ py: 3, textAlign: "center" }}>
          <Typography variant="body2Muted">
            No credentials yet. Add a &ldquo;default&rdquo; credential, or one per board domain
            (e.g. <code>linkedin.com</code>).
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {rows.map((c) => (
            <Card key={c.id}>
              <CardContent>
                <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {c.scope}
                    </Typography>
                    <Typography variant="captionMuted">{subtitle(c)}</Typography>
                  </Box>
                  <IconButton onClick={() => setPendingDelete(c)} aria-label="Delete credential">
                    <Delete fontSize="md" />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          ))}
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
