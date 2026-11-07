"use client";

import {
  type ReactElement,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Box, Button, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import { useInfiniteQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { QuerySection } from "@/components/ui/feedback";
import { formatDayLabel } from "@/utils/format";
import { LiveTurn } from "../now/live-turn";
import { SetupTurn } from "../now/setup-turn";
import { ThreadFold } from "./thread-fold";
import { collapseRepeats, foldQuietRuns, rowKey, type ThreadRow } from "./thread-folds";
import { ThreadItem } from "./thread-item";

/** The reading column of the thread, composer included. */
export const THREAD_WIDTH = 760;

/** Within this distance of the bottom, new items keep the view pinned to the newest. */
const STICK_TO_BOTTOM_PX = 120;

/** Shown until the pilot has done anything; the composer carries the suggested prompts. */
function Greeting(): ReactElement {
  return (
    <Stack spacing={1.5} sx={{ alignItems: "center", py: 6, textAlign: "center" }}>
      <Typography variant="h4" component="p">
        Hi. What should I work on?
      </Typography>
      <Typography variant="body2Muted">
        Ask about your search, change a rule, or send me job links. What I do shows up here.
      </Typography>
    </Stack>
  );
}

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

/** Rows with a day line wherever the day changes; quiet stretches fold until opened. */
function renderRows(
  rows: ThreadRow[],
  openFolds: string[],
  onOpenFold: (key: string) => void,
): ReactElement[] {
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
          onOpen={() => onOpenFold(segment.key)}
        />,
      );
      lastDay = formatDayLabel(segment.rows[segment.rows.length - 1].item.at);
    }
  }
  return out;
}

/** Our own jump fires a scroll event after the tail may have grown; that event isn't the user. */
function scrollToBottom(box: HTMLDivElement, selfScrolled: RefObject<boolean>): void {
  selfScrolled.current = true;
  box.scrollTop = box.scrollHeight;
}

interface PrependAnchor {
  height: number;
  firstKey: string | null;
  /** Seen in flight, so a render before the fetch starts can't read as "finished". */
  started: boolean;
}

/** Newest at the bottom, then what the pilot is doing now; what waits on the user is in the queue. */
export function Thread(): ReactElement {
  const query = useInfiniteQuery(pilotQueries.thread());
  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Set while an earlier page loads, so the view stays on what the user was reading.
  const prepend = useRef<PrependAnchor | null>(null);
  const pinned = useRef(true);
  const selfScrolled = useRef(false);

  const items = (query.data?.pages ?? []).flatMap((page) => page.items).reverse();
  const rows = collapseRepeats(items);
  const [openFolds, setOpenFolds] = useState<string[]>([]);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  const firstKey = rows[0] ? rowKey(rows[0].item) : null;

  const loadEarlier = (): void => {
    const box = scrollRef.current;
    if (!box || isFetchingNextPage || prepend.current) {
      return;
    }
    prepend.current = { height: box.scrollHeight, firstKey, started: false };
    void fetchNextPage();
  };

  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box || items.length === 0) {
      return;
    }
    const anchor = prepend.current;
    if (anchor && isFetchingNextPage) {
      anchor.started = true;
    }
    // Only once the earlier rows are in: the spinner's own re-render must not use up the anchor.
    if (anchor && anchor.firstKey !== firstKey) {
      box.scrollTop += box.scrollHeight - anchor.height;
      prepend.current = null;
    } else if (anchor?.started && !isFetchingNextPage) {
      // The fetch finished without adding rows, so there is nothing to restore.
      prepend.current = null;
    } else if (!anchor && pinned.current) {
      scrollToBottom(box, selfScrolled);
    }
  });

  // The turns at the bottom load on their own, after the thread has scrolled down.
  useEffect(() => {
    const box = scrollRef.current;
    const content = contentRef.current;
    if (!box || !content) {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (pinned.current && !prepend.current) {
        scrollToBottom(box, selfScrolled);
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const top = topRef.current;
    if (!top || !hasNextPage) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          loadEarlier();
        }
      },
      { root: scrollRef.current },
    );
    observer.observe(top);
    return () => observer.disconnect();
  });

  return (
    <Box
      ref={scrollRef}
      onScroll={(event) => {
        const box = event.currentTarget;
        if (selfScrolled.current) {
          selfScrolled.current = false;
          return;
        }
        pinned.current = box.scrollHeight - box.scrollTop - box.clientHeight < STICK_TO_BOTTOM_PX;
      }}
      // Both edges, so the scrollbar doesn't pull the centered thread off the composer below it.
      sx={{ flex: 1, minHeight: 0, overflowY: "auto", scrollbarGutter: "stable both-edges" }}
    >
      <Stack ref={contentRef} spacing={3} sx={{ maxWidth: THREAD_WIDTH, mx: "auto", py: 1 }}>
        <Box ref={topRef} sx={{ display: "flex", justifyContent: "center" }}>
          {isFetchingNextPage && <CircularProgress size={20} />}
          {hasNextPage && !isFetchingNextPage && (
            <Button size="small" onClick={loadEarlier}>
              Show earlier
            </Button>
          )}
        </Box>
        <QuerySection
          query={query}
          errorTitle="Couldn't load the pilot's activity."
          isEmpty={items.length === 0}
          empty={<Greeting />}
        >
          <Stack spacing={3}>
            {renderRows(rows, openFolds, (key) => setOpenFolds([...openFolds, key]))}
          </Stack>
        </QuerySection>
        <SetupTurn />
        <LiveTurn />
      </Stack>
    </Box>
  );
}
