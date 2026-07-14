"use client";

import { type ReactElement, useState } from "react";
import { Button, Stack, TextField } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { applicationQueries, campaignQueries, jobBoardQueries } from "@/api/queries";
import { SelectField, type SelectFieldOption } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { useSearchParam } from "@/hooks/use-search-param";
import { ApplicationsTable } from "./applications-table";
import { FUNNEL_GROUPS, FunnelBar, type FunnelKey, groupForStatus } from "./funnel-bar";

/** Campaign-filter sentinel for applications with no campaign (single-apply). */
const SINGLE = "__single__";

/** Tab 2 - cross-campaign application funnel + filterable, attributed table. */
export function ApplicationsPanel(): ReactElement {
  const apps = useApiQuery(applicationQueries.list());
  const campaigns = useApiQuery(campaignQueries.list());
  const boards = useApiQuery(jobBoardQueries.list());

  const [search, setSearch] = useState("");
  const [board, setBoard] = useSearchParam("board");
  const [campaignId, setCampaignId] = useSearchParam("campaign");
  const [groupParam, setGroupParam] = useSearchParam("group");
  const group: FunnelKey | null = FUNNEL_GROUPS.some((g) => g.key === groupParam)
    ? (groupParam as FunnelKey)
    : null;

  const rows = apps.data ?? [];
  const campaignLabel = new Map((campaigns.data ?? []).map((c) => [c.campaignId, c.query]));

  const counts = FUNNEL_GROUPS.reduce(
    (acc, g) => {
      acc[g.key] = 0;
      return acc;
    },
    {} as Record<FunnelKey, number>,
  );
  for (const a of rows) {
    const key = groupForStatus(a.status);
    if (key !== null) {
      counts[key] += 1;
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((a) => {
    if (group !== null && groupForStatus(a.status) !== group) {
      return false;
    }
    if (board !== null && a.board !== board) {
      return false;
    }
    if (campaignId === SINGLE) {
      if (a.campaignId !== null) {
        return false;
      }
    } else if (campaignId !== null && a.campaignId !== campaignId) {
      return false;
    }
    if (q !== "" && !`${a.title} ${a.company} ${a.url}`.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });

  const campaignOptions: SelectFieldOption[] = [
    { value: SINGLE, label: "Single applies" },
    ...(campaigns.data ?? []).map((c) => ({ value: c.campaignId, label: c.query })),
  ];
  const boardOptions: SelectFieldOption[] = (boards.data ?? []).map((b) => ({
    value: b.name,
    label: b.name,
  }));

  const isFiltered = search !== "" || board !== null || campaignId !== null || group !== null;
  const clear = (): void => {
    setSearch("");
    setBoard(null);
    setCampaignId(null);
    setGroupParam(null);
  };

  return (
    <Stack spacing={2}>
      <FunnelBar counts={counts} selected={group} onSelect={setGroupParam} />
      <SectionCard>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.25}
            sx={{ alignItems: { md: "center" } }}
          >
            <TextField
              size="small"
              placeholder="Search role, company, URL"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1, minWidth: 200 }}
            />
            <SelectField
              label="Board"
              value={board}
              emptyLabel="All boards"
              options={boardOptions}
              onChange={setBoard}
            />
            <SelectField
              label="Campaign"
              value={campaignId}
              emptyLabel="All campaigns"
              options={campaignOptions}
              onChange={setCampaignId}
            />
            {isFiltered && (
              <Button size="small" variant="text" onClick={clear}>
                Clear
              </Button>
            )}
          </Stack>
          <ApplicationsTable rows={filtered} campaignLabel={campaignLabel} />
        </Stack>
      </SectionCard>
    </Stack>
  );
}
