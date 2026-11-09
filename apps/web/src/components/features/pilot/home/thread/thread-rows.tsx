"use client";

import { type ReactElement, useState } from "react";
import type { PilotThreadItem } from "@jobpilot/contracts/pilot";
import { UnfoldMore } from "@mui/icons-material";
import { ButtonBase, Divider, Stack, Typography } from "@mui/material";
import { formatDayLabel } from "@/utils/format";
import { TURN_INDENT } from "./pilot-turn";
import { foldLabel, foldQuietRuns, rowKey } from "./thread-folds";
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
  items: PilotThreadItem[];
  onOpen: () => void;
}

/** A quiet stretch of history as one line; opening it lays the rows back out in place. */
function ThreadFold(props: ThreadFoldProps): ReactElement {
  const { items, onOpen } = props;
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
      {foldLabel(items)}
    </ButtonBase>
  );
}

interface ThreadRowsProps {
  items: PilotThreadItem[];
}

/** Rows with a day line wherever the day changes; quiet stretches fold until opened. */
export function ThreadRows(props: ThreadRowsProps): ReactElement {
  const { items } = props;
  const [openFolds, setOpenFolds] = useState<string[]>([]);

  const out: ReactElement[] = [];
  let lastDay: string | null = null;
  const pushRow = (item: PilotThreadItem): void => {
    const day = formatDayLabel(item.at);
    if (day !== lastDay) {
      out.push(<DaySeparator key={`day:${rowKey(item)}`} label={day} />);
      lastDay = day;
    }
    out.push(<ThreadItem key={rowKey(item)} item={item} />);
  };
  for (const segment of foldQuietRuns(items)) {
    if (segment.type === "row") {
      pushRow(segment.item);
    } else if (openFolds.includes(segment.key)) {
      segment.items.forEach(pushRow);
    } else {
      out.push(
        <ThreadFold
          key={`fold:${segment.key}`}
          items={segment.items}
          onOpen={() => setOpenFolds([...openFolds, segment.key])}
        />,
      );
      lastDay = formatDayLabel(segment.items[segment.items.length - 1].at);
    }
  }
  return <Stack spacing={3}>{out}</Stack>;
}
