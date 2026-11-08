"use client";

import { type ReactElement, useState } from "react";
import { UnfoldMore } from "@mui/icons-material";
import { ButtonBase, Divider, Stack, Typography } from "@mui/material";
import { formatDayLabel } from "@/utils/format";
import { TURN_INDENT } from "./pilot-turn";
import { foldLabel, foldQuietRuns, rowKey, type ThreadRow } from "./thread-folds";
import { ThreadItem } from "./thread-item";

interface DaySeparatorProps {
  label: string;
}

function DaySeparator(props: DaySeparatorProps): ReactElement {
  const { label } = props;
  return (
    <Divider>
      <Typography variant="captionMuted">{label}</Typography>
    </Divider>
  );
}

interface ThreadFoldProps {
  rows: ThreadRow[];
  onOpen: () => void;
}

/** A quiet stretch of history as one line; opening it lays the rows back out in place. */
function ThreadFold(props: ThreadFoldProps): ReactElement {
  const { rows, onOpen } = props;
  return (
    <ButtonBase
      onClick={onOpen}
      sx={(theme) => ({
        alignSelf: "flex-start",
        gap: 1,
        ml: { xs: 0, sm: TURN_INDENT },
        px: 1,
        py: 0.5,
        borderRadius: theme.radii.md,
        color: "text.secondary",
        typography: "body2",
        transition: theme.motion.fast,
        "&:hover": { color: "text.primary", backgroundColor: theme.palette.surfaces.card },
      })}
    >
      <UnfoldMore fontSize="sm" />
      {foldLabel(rows)}
    </ButtonBase>
  );
}

interface ThreadRowsProps {
  rows: ThreadRow[];
}

/** Rows with a day line wherever the day changes; quiet stretches fold until opened. */
export function ThreadRows(props: ThreadRowsProps): ReactElement {
  const { rows } = props;
  const [openFolds, setOpenFolds] = useState<string[]>([]);

  const out: ReactElement[] = [];
  let lastDay: string | null = null;
  const pushRow = (row: ThreadRow): void => {
    const day = formatDayLabel(row.item.at);
    if (day !== lastDay) {
      out.push(<DaySeparator key={`day:${rowKey(row.item)}`} label={day} />);
      lastDay = day;
    }
    out.push(<ThreadItem key={rowKey(row.item)} item={row.item} repeats={row.repeats} />);
  };
  for (const segment of foldQuietRuns(rows)) {
    if (segment.type === "row") {
      pushRow(segment.row);
    } else if (openFolds.includes(segment.key)) {
      segment.rows.forEach(pushRow);
    } else {
      out.push(
        <ThreadFold
          key={`fold:${segment.key}`}
          rows={segment.rows}
          onOpen={() => setOpenFolds([...openFolds, segment.key])}
        />,
      );
      lastDay = formatDayLabel(segment.rows[segment.rows.length - 1].item.at);
    }
  }
  return <Stack spacing={3}>{out}</Stack>;
}
