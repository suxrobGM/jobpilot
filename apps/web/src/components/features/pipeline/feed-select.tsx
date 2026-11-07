"use client";

import type { ReactElement } from "react";
import {
  Box,
  InputAdornment,
  ListSubheader,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { FeedDto } from "@/api/types";

interface FeedGroup {
  label: string;
  feeds: FeedDto[];
}

/** `-intern -co-op` in a board query reads as noise in a name, so it moves to a hint. */
function excludesHint(feed: FeedDto): string {
  const excluded = (feed.query ?? "")
    .split(/\s+/)
    .filter((word) => word.length > 1 && word.startsWith("-"))
    .map((word) => word.slice(1));
  return excluded.length > 0 ? `excludes ${excluded.join(", ")}` : "";
}

interface CountedLabelProps {
  name: string;
  hint: string;
  count: number | null;
}

function CountedLabel(props: CountedLabelProps): ReactElement {
  const { name, hint, count } = props;
  return (
    <Stack direction="row" spacing={2} sx={{ width: "100%", alignItems: "center" }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap>
          {name}
        </Typography>
        {hint && (
          <Typography variant="captionMuted" noWrap component="div">
            {hint}
          </Typography>
        )}
      </Box>
      {count !== null && <Typography variant="captionMuted">{count}</Typography>}
    </Stack>
  );
}

interface FeedSelectProps {
  feeds: FeedDto[];
  value: string | null;
  onChange: (feedId: string | null) => void;
  /** Jobs per feed in the open tab; null where the tab has no per-feed counts. */
  counts: Map<string, number> | null;
  total: number | null;
}

/** Searches apart from standing sources, each with its count; feeds with nothing here are hidden. */
export function FeedSelect(props: FeedSelectProps): ReactElement {
  const { feeds, value, onChange, counts, total } = props;
  const countOf = (feed: FeedDto) => counts?.get(feed.id) ?? 0;
  const shown = feeds.filter((feed) => counts === null || countOf(feed) > 0 || feed.id === value);
  const groups: FeedGroup[] = [
    { label: "Your searches", feeds: shown.filter((feed) => feed.kind === "search") },
    { label: "Other sources", feeds: shown.filter((feed) => feed.kind !== "search") },
  ];
  const items = groups.flatMap((group) =>
    group.feeds.length === 0
      ? []
      : [
          <ListSubheader key={group.label}>{group.label}</ListSubheader>,
          ...group.feeds.map((feed) => (
            <MenuItem key={feed.id} value={feed.id}>
              <CountedLabel
                name={feed.name}
                hint={excludesHint(feed)}
                count={counts && countOf(feed)}
              />
            </MenuItem>
          )),
        ],
  );

  return (
    <TextField
      size="small"
      select
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      sx={{ maxWidth: 320 }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start" sx={{ color: "text.secondary" }}>
              Feed
            </InputAdornment>
          ),
        },
        select: {
          displayEmpty: true,
          SelectDisplayProps: { "aria-label": "Feed" },
          renderValue: (selected) => feeds.find((feed) => feed.id === selected)?.name ?? "All",
          MenuProps: { slotProps: { paper: { sx: { minWidth: 360, maxWidth: 480 } } } },
        },
      }}
    >
      <MenuItem value="">
        <CountedLabel name="All feeds" hint="" count={total} />
      </MenuItem>
      {items}
    </TextField>
  );
}
