"use client";

import { type ReactElement, useState } from "react";
import type { CampaignStatus } from "@jobpilot/contracts/campaign";
import { isTerminalNetworkingStatus } from "@jobpilot/contracts/networking";
import { Alert, Button, Chip, Grid, Stack, Typography } from "@mui/material";
import type { GridRowSelectionModel } from "@mui/x-data-grid";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { campaignQueries, emailQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import type { CampaignSummaryDto, NetworkingConfigDto } from "@/api/types";
import { AgentOnlyButton } from "@/components/ui/buttons";
import { DataTable } from "@/components/ui/data/data-table";
import { StatCard } from "@/components/ui/display";
import { useAgent } from "@/providers/agent-provider";
import { EMPTY_SELECTION, resolveSelectedRows } from "@/utils/grid-selection";
import { networkingMessageColumns, openActionColumn } from "./networking-message-columns";
import { NetworkingMessageDialog } from "./networking-message-dialog";

function emptyMessage(status: CampaignStatus): string {
  if (status === "in_progress") {
    return "Discovering contacts…";
  }
  if (status === "paused") {
    return "No contacts yet - use Resume above to discover contacts and draft messages.";
  }
  return "No contacts were added.";
}

interface NetworkingBoardProps {
  campaignId: string;
  status: CampaignStatus;
  summary: Extract<CampaignSummaryDto, { kind: "networking" }>;
  config?: NetworkingConfigDto;
}

export function NetworkingBoard(props: NetworkingBoardProps): ReactElement {
  const { campaignId, status, summary, config } = props;
  const agent = useAgent();
  const [openId, setOpenId] = useState<string | null>(null);
  const [selection, setSelection] = useState<GridRowSelectionModel>(EMPTY_SELECTION);

  const messagesQuery = useApiQuery(campaignQueries.networking(campaignId));
  const accountQuery = useApiQuery(emailQueries.account());

  const invalidate = [
    queryKeys.campaigns.networking(campaignId),
    queryKeys.campaigns.detail(campaignId),
  ];

  const approveSelected = useApiMutation<string[], string[]>(
    async (ids) => {
      for (const id of ids) {
        const res = await api.campaigns({ id: campaignId }).networking({ messageId: id }).patch({
          status: "approved",
        });
        if (res.error) {
          return { data: null, error: res.error };
        }
      }
      return { data: ids, error: null };
    },
    {
      invalidate,
      successMessage: "Approved selected",
      onSuccess: () => setSelection(EMPTY_SELECTION),
    },
  );

  const messages = messagesQuery.data?.items ?? [];
  const canSend = accountQuery.data?.canSend ?? false;
  const openMessage = messages.find((m) => m.id === openId) ?? null;
  const selectedIds = resolveSelectedRows(selection, messages)
    .filter((m) => !isTerminalNetworkingStatus(m.status))
    .map((m) => m.id);

  const regenerateSelected = (): void => {
    void agent.injectSkill(
      "networking",
      `--campaign ${campaignId} --rewrite ${selectedIds.join(",")}`,
    );
    setSelection(EMPTY_SELECTION);
  };

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label="Discovered" value={summary.discovered} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label="Drafted" value={summary.drafted} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label="Sent" value={summary.sent} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label="Replied" value={summary.replied} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label="Bounced" value={summary.bounced} />
        </Grid>
      </Grid>

      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}>
        {config?.channels.map((c) => (
          <Chip key={c} size="small" label={c} variant="outlined" />
        ))}
        {config?.autonomy && <Chip size="small" label={`autonomy: ${config.autonomy}`} />}
      </Stack>

      {config?.channels.includes("email") && !canSend && (
        <Alert severity="warning">
          Your mailbox can&apos;t send yet - reconnect Gmail in Settings to enable email sends.
        </Alert>
      )}

      {selectedIds.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="body2Muted">{selectedIds.length} selected</Typography>
          <AgentOnlyButton size="small" variant="outlined" onClick={regenerateSelected}>
            Regenerate selected
          </AgentOnlyButton>
          <Button
            size="small"
            variant="outlined"
            onClick={() => approveSelected.mutate(selectedIds)}
            disabled={approveSelected.isPending}
          >
            Approve selected
          </Button>
        </Stack>
      )}

      <DataTable
        rows={messages}
        columns={[...networkingMessageColumns, openActionColumn(setOpenId)]}
        loading={messagesQuery.isLoading}
        getRowId={(row) => row.id}
        checkboxSelection
        rowSelectionModel={selection}
        onRowSelectionModelChange={setSelection}
        autoHeight
        emptyMessage={emptyMessage(status)}
      />

      {openMessage && (
        <NetworkingMessageDialog
          campaignId={campaignId}
          message={openMessage}
          onClose={() => setOpenId(null)}
        />
      )}
    </Stack>
  );
}
