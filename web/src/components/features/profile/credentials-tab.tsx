"use client";

import { Add, Delete } from "@mui/icons-material";
import { Box, Button, IconButton, Stack, Typography } from "@mui/material";
import { useState, type ReactElement } from "react";
import { ConfirmDialog } from "@/components/ui/feedback/confirm-dialog";
import { SectionCard } from "@/components/ui/layout/section-card";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api-client";
import type { CredentialInput } from "@/lib/schemas/credential";
import { CredentialFormDialog } from "./credential-form-dialog";

interface Credential {
  id: number;
  scope: string;
  email: string;
  password: string;
}

export function CredentialsTab(): ReactElement {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Credential | null>(null);

  const credentials = useApiQuery<Credential[]>(
    ["credentials"],
    () => apiClient.get<Credential[]>("/api/credentials"),
  );

  const create = useApiMutation<Credential, CredentialInput>(
    (vars) => apiClient.post<Credential>("/api/credentials", vars),
    {
      successMessage: "Credential added",
      invalidate: [["credentials"]],
      onSuccess: () => setDialogOpen(false),
    },
  );

  const remove = useApiMutation<{ deleted: number }, number>(
    (id) => apiClient.del<{ deleted: number }>(`/api/credentials/${id}`),
    {
      successMessage: "Credential removed",
      invalidate: [["credentials"]],
      onSuccess: () => setPendingDelete(null),
    },
  );

  const rows = credentials.data ?? [];

  return (
    <SectionCard
      title="Login credentials"
      description="Used by skills to log into job boards. Stored locally in plaintext on your machine."
      actions={
        <Button startIcon={<Add />} variant="contained" onClick={() => setDialogOpen(true)}>
          Add credential
        </Button>
      }
    >
      {rows.length === 0 ? (
        <Box sx={{ py: 3, textAlign: "center" }}>
          <Typography variant="body2Muted">
            No credentials yet. Add a "default" credential, or one per board domain
            (e.g. <code>linkedin.com</code>).
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {rows.map((c) => (
            <Stack
              key={c.id}
              direction="row"
              spacing={2}
              sx={(t) => ({
                alignItems: "center",
                p: 1.5,
                borderRadius: t.radii.sm,
                border: `1px solid ${t.palette.line.divider}`,
              })}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {c.scope}
                </Typography>
                <Typography variant="captionMuted">{c.email}</Typography>
              </Box>
              <IconButton onClick={() => setPendingDelete(c)} aria-label="Delete credential">
                <Delete sx={{ fontSize: 18 }} />
              </IconButton>
            </Stack>
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
        message={
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
