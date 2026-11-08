"use client";

import { type ReactElement, useState } from "react";
import { PauseCircleOutlined } from "@mui/icons-material";
import { Button, Stack, Tooltip, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import type { FeedDto } from "@/api/types";
import { LinkButton } from "@/components/ui/buttons";
import { plural } from "@/utils/format";
import { useMakeChange } from "../../changes/use-changes";
import { SideSection } from "./side-section";

interface SearchRowProps {
  search: FeedDto;
}

function SearchRow(props: SearchRowProps): ReactElement {
  const { search } = props;
  const paused = search.pausedAt !== null;
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", minHeight: 28 }}>
      <Typography
        variant="body2"
        noWrap
        title={search.query ?? undefined}
        sx={{ flex: 1, minWidth: 0, color: paused ? "text.secondary" : "text.primary" }}
      >
        {search.name}
      </Typography>
      {paused ? (
        <Tooltip title={search.pausedReason ?? "Paused"}>
          <PauseCircleOutlined fontSize="sm" sx={{ color: "text.secondary" }} />
        </Tooltip>
      ) : (
        <Typography variant="body2Muted">{search.appliedThisWeek}</Typography>
      )}
    </Stack>
  );
}

/** Active searches with this week's applications; paused ones fold behind one line. */
export function SearchesSummary(): ReactElement {
  const searches = useQuery(pilotQueries.searches()).data ?? [];
  const [showPaused, setShowPaused] = useState(false);
  const resume = useMakeChange();
  const active = searches.filter((search) => search.pausedAt === null);
  const paused = searches.filter((search) => search.pausedAt !== null);

  const resumeAll = (): void => {
    resume.mutate({
      summary: `Resumed ${plural(paused.length, "search", "searches")}`,
      actions: paused.map((search) => ({ type: "search.resume", searchId: search.id })),
    });
  };

  return (
    <SideSection
      title="Searches"
      action={
        <LinkButton size="small" href="/pilot/goals">
          Manage
        </LinkButton>
      }
    >
      {searches.length > 0 && (
        <Typography variant="captionMuted" sx={{ textAlign: "right" }}>
          applied / week
        </Typography>
      )}
      {searches.length === 0 && (
        <Typography variant="body2Muted">None yet. I build these from your goals.</Typography>
      )}
      <Stack spacing={0.25}>
        {active.map((search) => (
          <SearchRow key={search.id} search={search} />
        ))}
        {showPaused && paused.map((search) => <SearchRow key={search.id} search={search} />)}
      </Stack>
      {paused.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="captionMuted" sx={{ flex: 1 }}>
            {`${paused.length} paused`}
          </Typography>
          <Button size="small" color="inherit" onClick={() => setShowPaused(!showPaused)}>
            {showPaused ? "Hide" : "Show"}
          </Button>
          <Button size="small" loading={resume.isPending} onClick={resumeAll}>
            Resume all
          </Button>
        </Stack>
      )}
    </SideSection>
  );
}
