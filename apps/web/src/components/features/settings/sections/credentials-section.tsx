"use client";

import { type ReactElement, useState } from "react";
import type { CredentialInput } from "@jobpilot/contracts/credential";
import { Add, Delete, Key, Lock } from "@mui/icons-material";
import { Box, Button, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { credentialQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import type { CredentialDto } from "@/api/types";
import { TooltipIconButton } from "@/components/ui/buttons";
import { ItemList, ItemRow } from "@/components/ui/display";
import { EmptyState, LoadingSpinner } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";
import { useConfirm } from "@/providers/confirm-provider";
import { CredentialFormDialog, PROVIDER_LABELS } from "./credential-form-dialog";

/** What the credential is for: its board, "Default", or its captcha provider. */
function credentialLabel(credential: CredentialDto): string {
  if (credential.board) {
    return credential.board.name;
  }
  if (credential.provider) {
    return PROVIDER_LABELS[credential.provider];
  }
  return "Default";
}

export function CredentialsSection(): ReactElement {
  const [dialogOpen, setDialogOpen] = useState(false);
  const confirm = useConfirm();

  const credentials = useApiQuery(credentialQueries.list());

  const create = useApiMutation((vars: CredentialInput) => api.credentials.post(vars), {
    successMessage: "Credential added",
    invalidate: [queryKeys.credentials.all],
    onSuccess: () => setDialogOpen(false),
  });

  const remove = useApiMutation((id: string) => api.credentials({ id }).delete(), {
    successMessage: "Credential removed",
    invalidate: [queryKeys.credentials.all],
  });

  const handleDelete = async (credential: CredentialDto): Promise<void> => {
    const confirmed = await confirm({
      title: "Delete credential?",
      description: `Remove the "${credentialLabel(credential)}" credential? Board logins fall back to the default.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (confirmed) {
      remove.mutate(credential.id);
    }
  };

  const rows = credentials.data ?? [];
  const groups = [
    {
      title: "Job board logins",
      items: rows.filter((c) => c.kind !== "service"),
      icon: <Lock fontSize="md" color="action" />,
      secondary: (c: CredentialDto) => c.email ?? "",
    },
    {
      title: "Captcha services",
      items: rows.filter((c) => c.kind === "service"),
      icon: <Key fontSize="md" color="action" />,
      secondary: (c: CredentialDto) => (c.hasApiKey ? "API key saved" : "No API key"),
    },
  ];

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
        <EmptyState
          variant="inline"
          title="No credentials yet"
          description="Add a default login, or one per board (e.g. LinkedIn)."
        />
      ) : (
        <Stack spacing={3}>
          {groups
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <CredentialGroup key={group.title} title={group.title}>
                {group.items.map((c) => (
                  <ItemRow
                    key={c.id}
                    icon={group.icon}
                    primary={credentialLabel(c)}
                    secondary={group.secondary(c)}
                    action={
                      <TooltipIconButton
                        title="Delete credential"
                        onClick={() => void handleDelete(c)}
                      >
                        <Delete fontSize="sm" />
                      </TooltipIconButton>
                    }
                  />
                ))}
              </CredentialGroup>
            ))}
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
      <Typography variant="overlineMuted" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <ItemList>{children}</ItemList>
    </Box>
  );
}
