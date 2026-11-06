"use client";

import type { ReactElement } from "react";
import { PauseCircleOutlined } from "@mui/icons-material";
import { Button, Stack, Tooltip, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import type { FeedDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { SideSection } from "./side-section";

interface SearchRowProps {
  search: FeedDto;
}

function SearchRow(props: SearchRowProps): ReactElement {
  const { search } = props;
  const resume = useApiMutation(
    () => api.feeds({ id: search.id }).patch({ paused: false, actor: "user" }),
    {
      invalidate: [pilotQueries.all],
      successMessage: `Resumed ${search.name}.`,
    },
  );

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", minHeight: 28 }}>
      <Typography
        variant="body2"
        noWrap
        title={search.query ?? undefined}
        sx={{ flex: 1, minWidth: 0, color: search.pausedAt ? "text.secondary" : "text.primary" }}
      >
        {search.name}
      </Typography>
      {search.pausedAt ? (
        <>
          <Tooltip title={search.pausedReason ?? "Paused"}>
            <PauseCircleOutlined fontSize="sm" sx={{ color: "text.secondary" }} />
          </Tooltip>
          <Button size="small" loading={resume.isPending} onClick={() => resume.mutate()}>
            Resume
          </Button>
        </>
      ) : (
        <Typography variant="body2Muted">{search.appliedThisWeek}</Typography>
      )}
    </Stack>
  );
}

export function SearchesSummary(): ReactElement {
  const searches = useQuery(pilotQueries.searches()).data ?? [];
  return (
    <SideSection
      title="Searches"
      action={<Typography variant="captionMuted">applied / week</Typography>}
    >
      {searches.length === 0 ? (
        <Typography variant="body2Muted">
          None yet. The pilot builds these from your goals.
        </Typography>
      ) : (
        <Stack spacing={0.25}>
          {searches.map((search) => (
            <SearchRow key={search.id} search={search} />
          ))}
        </Stack>
      )}
    </SideSection>
  );
}
