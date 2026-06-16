"use client";

import { useState, type ReactElement } from "react";
import type { CampaignStatus } from "@jobpilot/contracts/campaign";
import {
  OUTREACH_MESSAGE_TERMINAL_STATUSES,
  type OutreachMessageStatus,
} from "@jobpilot/contracts/outreach";
import { Alert, Button, Chip, Grid, Stack, Typography } from "@mui/material";
import {
  DataGrid,
  type GridColDef,
  type GridRowSelectionModel,
  type GridRowsProp,
} from "@mui/x-data-grid";
import { api } from "@/api/eden";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type {
  CampaignSummaryDto,
  EmailAccountStatus,
  OutreachConfigDto,
  OutreachMessageDto,
} from "@/api/types";
import { EmptyState } from "@/components/ui/data";
import { ExternalLink, StatCard } from "@/components/ui/display";
import { useAgent } from "@/providers/agent-provider";
import { EMPTY_SELECTION, resolveSelectedRows } from "@/utils/grid-selection";
import { OutreachMessageDialog } from "./outreach-message-dialog";

const STATUS_COLOR: Record<
  OutreachMessageStatus,
  "default" | "info" | "primary" | "success" | "error" | "warning"
> = {
  draft: "default",
  approved: "info",
  sent: "primary",
  replied: "success",
  bounced: "warning",
  failed: "error",
  skipped: "default",
};

function emptyMessage(status: CampaignStatus): string {
  if (status === "in_progress") {
    return "Discovering contacts…";
  }
  if (status === "paused" || status === "interrupted") {
    return "No contacts yet — use Resume above to discover contacts and draft messages.";
  }
  return "No contacts were added.";
}

interface OutreachBoardProps {
  campaignId: string;
  status: CampaignStatus;
  summary: CampaignSummaryDto;
  config?: OutreachConfigDto;
}

export function OutreachBoard(props: OutreachBoardProps): ReactElement {
  const { campaignId, status, summary, config } = props;
  const agent = useAgent();
  const [openId, setOpenId] = useState<number | null>(null);
  const [selection, setSelection] = useState<GridRowSelectionModel>(EMPTY_SELECTION);

  const messagesQuery = useApiQuery<OutreachMessageDto[]>(
    queryKeys.campaigns.outreach(campaignId),
    () => api.campaigns({ id: campaignId }).outreach.get(),
  );
  const accountQuery = useApiQuery<EmailAccountStatus>(queryKeys.email.account(), () =>
    api.email.account.get(),
  );

  const invalidate = [
    queryKeys.campaigns.outreach(campaignId),
    queryKeys.campaigns.detail(campaignId),
  ];

  const skip = useApiMutation<unknown, number>(
    (id) =>
      api
        .campaigns({ id: campaignId })
        .outreach({ messageId: id })
        .result.post({ outcome: "skipped" }),
    { invalidate, successMessage: "Skipped" },
  );

  const approveSelected = useApiMutation<number[], number[]>(
    async (ids) => {
      for (const id of ids) {
        const res = await api.campaigns({ id: campaignId }).outreach({ messageId: id }).patch({
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

  const messages = messagesQuery.data ?? [];
  const canSend = accountQuery.data?.canSend ?? false;
  const openMessage = messages.find((m) => m.id === openId) ?? null;
  const selectedIds = resolveSelectedRows(selection, messages)
    .filter((m) => !OUTREACH_MESSAGE_TERMINAL_STATUSES.includes(m.status))
    .map((m) => m.id);

  const regenerateSelected = (): void => {
    void agent.injectSkill(
      "outreach",
      `--campaign ${campaignId} --rewrite ${selectedIds.join(",")}`,
    );
    setSelection(EMPTY_SELECTION);
  };

  const columns: GridColDef<OutreachMessageDto>[] = [
    {
      field: "status",
      headerName: "Status",
      width: 110,
      sortable: false,
      renderCell: (p) => (
        <Chip
          size="small"
          label={p.row.status}
          color={STATUS_COLOR[p.row.status]}
          variant="outlined"
        />
      ),
    },
    {
      field: "name",
      headerName: "Contact",
      flex: 1.2,
      minWidth: 180,
      valueGetter: (_v, row) => row.contact.name,
      renderCell: (p) =>
        p.row.contact.linkedinUrl ? (
          <ExternalLink href={p.row.contact.linkedinUrl}>{p.row.contact.name}</ExternalLink>
        ) : (
          p.row.contact.name
        ),
    },
    {
      field: "company",
      headerName: "Company",
      flex: 1,
      minWidth: 140,
      valueGetter: (_v, row) => row.contact.company ?? "",
      renderCell: (p) =>
        p.row.contact.relatedJobUrl ? (
          <ExternalLink href={p.row.contact.relatedJobUrl}>
            {p.row.contact.company ?? "View role"}
          </ExternalLink>
        ) : (
          (p.row.contact.company ?? "")
        ),
    },
    {
      field: "channel",
      headerName: "Channel",
      width: 130,
      valueGetter: (_v, row) =>
        row.channel === "linkedin"
          ? `LinkedIn${row.linkedinKind ? ` · ${row.linkedinKind}` : ""}`
          : "Email",
    },
    {
      field: "subject",
      headerName: "Subject / preview",
      flex: 1.4,
      minWidth: 200,
      valueGetter: (_v, row) => row.subject ?? row.body.slice(0, 80),
    },
    {
      field: "actions",
      headerName: "",
      width: 96,
      sortable: false,
      filterable: false,
      align: "right",
      headerAlign: "right",
      renderCell: (p) => (
        <Button size="small" variant="outlined" onClick={() => setOpenId(p.row.id)}>
          Open
        </Button>
      ),
    },
  ];

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
          Your mailbox can&apos;t send yet — reconnect Gmail in Settings to enable email sends.
        </Alert>
      )}

      {selectedIds.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="body2Muted">{selectedIds.length} selected</Typography>
          <Button size="small" variant="outlined" onClick={regenerateSelected}>
            Regenerate selected
          </Button>
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

      <DataGrid
        rows={messages as GridRowsProp}
        columns={columns as GridColDef[]}
        loading={messagesQuery.isLoading}
        getRowId={(row) => (row as OutreachMessageDto).id}
        checkboxSelection
        rowSelectionModel={selection}
        onRowSelectionModelChange={setSelection}
        autoHeight
        slots={{
          noRowsOverlay: () => <EmptyState variant="inline" title={emptyMessage(status)} />,
        }}
      />

      {openMessage && (
        <OutreachMessageDialog
          campaignId={campaignId}
          message={openMessage}
          canSend={canSend}
          invalidate={invalidate}
          onClose={() => setOpenId(null)}
          onSkip={() => {
            skip.mutate(openMessage.id);
            setOpenId(null);
          }}
        />
      )}
    </Stack>
  );
}
