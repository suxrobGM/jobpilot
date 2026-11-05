"use client";

import { type ReactElement, useState } from "react";
import { isTerminalNetworkingStatus } from "@jobpilot/contracts/networking";
import { PersonSearch } from "@mui/icons-material";
import { Box, Button, Stack, Tooltip, Typography } from "@mui/material";
import type { GridRowSelectionModel } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { api } from "@/api/client";
import { networkingQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { AgentOnlyButton } from "@/components/ui/buttons";
import { PaginationFooter } from "@/components/ui/data";
import { DataTable } from "@/components/ui/data/data-table";
import { usePaginationParams } from "@/hooks/use-pagination";
import { useAgent } from "@/providers/agent-provider";
import { EMPTY_SELECTION, resolveSelectedRows } from "@/utils/grid-selection";
import { FindContactsDialog } from "./find-contacts-dialog";
import { networkingMessageColumns, openActionColumn } from "./networking-message-columns";
import { NetworkingMessageDialog } from "./networking-message-dialog";

const EMPTY_MESSAGE = "No outreach yet. The pilot drafts intros as it applies.";

/** Every outreach draft, one server page at a time, with bulk approve and rewrite. */
export function NetworkingMessagesList(): ReactElement {
  const agent = useAgent();
  const pagination = usePaginationParams();
  // The pilot's approval question deep-links straight to one draft.
  const [openId, setOpenId] = useState(useSearchParams().get("message"));
  const [selection, setSelection] = useState<GridRowSelectionModel>(EMPTY_SELECTION);
  const [finding, setFinding] = useState(false);
  const query = useQuery(networkingQueries.messages(pagination.query));

  const messages = query.data?.items ?? [];
  const openMessage = messages.find((m) => m.id === openId) ?? null;
  const selected = resolveSelectedRows(selection, messages).flatMap((m) =>
    m.campaignId && !isTerminalNetworkingStatus(m.status)
      ? [{ id: m.id, campaignId: m.campaignId }]
      : [],
  );
  const campaignIds = [...new Set(selected.map((m) => m.campaignId))];
  // The skill rewrites within one campaign at a time.
  const rewriteCampaign = campaignIds.length === 1 ? campaignIds[0] : null;

  const approveSelected = useApiMutation(
    async () => {
      for (const message of selected) {
        const res = await api
          .campaigns({ id: message.campaignId })
          .networking.messages({ messageId: message.id })
          .patch({ status: "approved" });
        if (res.error) {
          return { data: null, error: res.error };
        }
      }
      return { data: selected.length, error: null };
    },
    {
      invalidate: [networkingQueries.all],
      successMessage: "Approved the selected drafts.",
      onSuccess: () => setSelection(EMPTY_SELECTION),
    },
  );

  const rewriteSelected = (): void => {
    const ids = selected.map((m) => m.id).join(",");
    void agent.injectSkill("networking", `--campaign ${rewriteCampaign} --rewrite ${ids}`);
    setSelection(EMPTY_SELECTION);
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        {selected.length > 0 && (
          <>
            <Typography variant="body2Muted">{selected.length} selected</Typography>
            <Tooltip
              title={rewriteCampaign ? "" : "Pick drafts from one search to rewrite them together."}
            >
              <Box component="span">
                <AgentOnlyButton
                  size="small"
                  variant="outlined"
                  disabled={!rewriteCampaign}
                  onClick={rewriteSelected}
                >
                  Rewrite selected
                </AgentOnlyButton>
              </Box>
            </Tooltip>
            <Button
              size="small"
              variant="outlined"
              loading={approveSelected.isPending}
              onClick={() => approveSelected.mutate()}
            >
              Approve selected
            </Button>
          </>
        )}
        <Box sx={{ ml: "auto" }}>
          <AgentOnlyButton
            size="small"
            variant="contained"
            startIcon={<PersonSearch fontSize="sm" />}
            onClick={() => setFinding(true)}
          >
            Find contacts
          </AgentOnlyButton>
        </Box>
      </Stack>
      <DataTable
        rows={messages}
        columns={[...networkingMessageColumns, openActionColumn(setOpenId)]}
        loading={query.isPending}
        getRowId={(row) => row.id}
        checkboxSelection
        rowSelectionModel={selection}
        onRowSelectionModelChange={setSelection}
        autoHeight
        hideFooter
        emptyMessage={EMPTY_MESSAGE}
        errorTitle={query.isError ? "Couldn't load outreach messages." : undefined}
        onRetry={() => void query.refetch()}
      />
      {query.data && (
        <PaginationFooter
          pagination={query.data.pagination}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      )}
      {openMessage?.campaignId && (
        <NetworkingMessageDialog
          campaignId={openMessage.campaignId}
          message={openMessage}
          onClose={() => setOpenId(null)}
        />
      )}
      <FindContactsDialog open={finding} onClose={() => setFinding(false)} />
    </Stack>
  );
}
