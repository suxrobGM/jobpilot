"use client";

import type { ReactElement } from "react";
import { Add, ChevronLeft, Clear, History } from "@mui/icons-material";
import {
  Alert,
  Badge,
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { CAMPAIGN_SOURCES, type CampaignSource } from "@jobpilot/contracts/campaign";
import type { CampaignDto } from "@/api/types";
import { CampaignRow, useCampaignsList } from "@/components/features/campaigns";
import { CAMPAIGN_STATUS_OPTIONS } from "@/components/features/campaigns/campaign-status";
import { EmptyState, PaginationFooter } from "@/components/ui/data";
import { SelectField, type SelectFieldOption } from "@/components/ui/form";
import { usePersistedBoolean } from "@/hooks/use-persisted-boolean";
import { usePipelineFilters } from "../hooks/use-pipeline-filters";

const RAIL_EXPANDED = 300;
const RAIL_COLLAPSED = 48;
const RAIL_PAGE_SIZE = 8;
const RAIL_EXPANDED_KEY = "jobpilot.campaignsRail.expanded";

const SOURCE_OPTIONS: ReadonlyArray<SelectFieldOption<CampaignSource>> = CAMPAIGN_SOURCES.map(
  (s) => ({
    value: s,
    label: s,
  }),
);

export function CampaignsRail(): ReactElement {
  const router = useRouter();
  const { campaignId, setCampaignId } = usePipelineFilters();
  const isBelowMd = useMediaQuery((theme) => theme.breakpoints.down("md"));
  const [expanded, setExpanded] = usePersistedBoolean(RAIL_EXPANDED_KEY, !isBelowMd);
  const ctrl = useCampaignsList(RAIL_PAGE_SIZE);

  const openDetail = (campaign: CampaignDto): void => {
    router.push(`/campaigns/${encodeURIComponent(campaign.campaignId)}` as Route);
  };

  if (!expanded) {
    return (
      <Stack
        component="aside"
        aria-label="Campaigns"
        spacing={1}
        sx={(theme) => ({
          width: RAIL_COLLAPSED,
          flexShrink: 0,
          height: "100%",
          alignItems: "center",
          paddingBlock: 2,
          borderRight: `1px solid ${theme.palette.line.divider}`,
        })}
      >
        <Tooltip title="Show campaigns" placement="right">
          <IconButton size="small" aria-label="Show campaigns" onClick={() => setExpanded(true)}>
            <Badge
              color="warning"
              variant="dot"
              invisible={ctrl.interruptedCount === 0}
              overlap="circular"
            >
              <History fontSize="sm" />
            </Badge>
          </IconButton>
        </Tooltip>
        <Typography
          variant="overlineMuted"
          onClick={() => setExpanded(true)}
          sx={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            letterSpacing: "0.1em",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          Campaigns
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack
      component="aside"
      aria-label="Campaigns"
      sx={(theme) => ({
        width: RAIL_EXPANDED,
        flexShrink: 0,
        height: "100%",
        minHeight: 0,
        borderRight: `1px solid ${theme.palette.line.divider}`,
      })}
    >
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", padding: 1.5, pb: 1 }}
      >
        <Typography variant="overlineMuted">Campaigns</Typography>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="New campaign">
            <IconButton
              size="small"
              aria-label="New campaign"
              onClick={() => router.push("/campaigns/new")}
            >
              <Add fontSize="sm" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Hide campaigns">
            <IconButton size="small" aria-label="Hide campaigns" onClick={() => setExpanded(false)}>
              <ChevronLeft fontSize="sm" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Stack spacing={1} sx={{ paddingInline: 1.5 }}>
        {ctrl.interruptedCount > 0 && (
          <Alert
            severity="warning"
            variant="outlined"
            sx={{ cursor: ctrl.statusFilter === "interrupted" ? "default" : "pointer" }}
            onClick={() => {
              if (ctrl.statusFilter !== "interrupted") {
                ctrl.setStatusFilter("interrupted");
              }
            }}
          >
            {ctrl.interruptedCount} {ctrl.interruptedCount === 1 ? "campaign" : "campaigns"}{" "}
            interrupted — open one and Resume.
          </Alert>
        )}
        <SelectField
          label="Status"
          value={ctrl.statusFilter}
          options={CAMPAIGN_STATUS_OPTIONS}
          minWidth={0}
          onChange={ctrl.setStatusFilter}
        />
        <SelectField
          label="Source"
          value={ctrl.sourceFilter}
          options={SOURCE_OPTIONS}
          minWidth={0}
          onChange={ctrl.setSourceFilter}
        />
        {ctrl.hasFilters && (
          <Button
            size="small"
            variant="text"
            startIcon={<Clear fontSize="sm" />}
            onClick={ctrl.resetFilters}
            sx={{ alignSelf: "flex-start" }}
          >
            Clear
          </Button>
        )}
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 1.5 }}>
        {ctrl.isLoading ? (
          <Typography variant="captionMuted">Loading…</Typography>
        ) : ctrl.allRows.length === 0 ? (
          <EmptyState
            variant="inline"
            title="No campaigns yet"
            description="Start one from New campaign."
          />
        ) : ctrl.filteredRows.length === 0 ? (
          <EmptyState variant="inline" title="No campaigns match the filters." />
        ) : (
          <Stack spacing={1}>
            {ctrl.pagination.pageRows.map((campaign) => (
              <CampaignRow
                key={campaign.campaignId}
                campaign={campaign}
                selected={campaign.campaignId === campaignId}
                onSelect={(r) => setCampaignId(r.campaignId)}
                onOpenDetail={openDetail}
              />
            ))}
          </Stack>
        )}
      </Box>

      <Box sx={{ paddingInline: 1.5 }}>
        <PaginationFooter
          page={ctrl.pagination.page}
          pageCount={ctrl.pagination.pageCount}
          pageSize={RAIL_PAGE_SIZE}
          total={ctrl.pagination.total}
          onChange={ctrl.pagination.setPage}
        />
      </Box>
    </Stack>
  );
}
