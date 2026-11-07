"use client";

import {
  Fragment,
  type ReactElement,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import type { PilotState, PilotThreadItem } from "@jobpilot/contracts/pilot";
import { Box, Button, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import { useInfiniteQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { QuerySection } from "@/components/ui/feedback";
import { formatDayLabel } from "@/utils/format";
import { LiveTurn } from "../now/live-turn";
import { SetupTurn } from "../now/setup-turn";
import { ThreadItem } from "./thread-item";

/** The reading column of the thread, composer included; it starts beside the queue, not centered. */
export const THREAD_WIDTH = 1000;

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

interface ThreadRow {
  item: PilotThreadItem;
  repeats: number;
}

/** Restart reports and other identical notes in a row read as noise; keep the latest, counted. */
function collapseRepeats(items: PilotThreadItem[]): ThreadRow[] {
  const rows: ThreadRow[] = [];
  for (const item of items) {
    const last = rows.at(-1);
    const sameNote =
      last?.item.type === "note" &&
      item.type === "note" &&
      last.item.entry.summary === item.entry.summary &&
      formatDayLabel(last.item.at) === formatDayLabel(item.at);
    if (last && sameNote) {
      rows[rows.length - 1] = { item, repeats: last.repeats + 1 };
    } else {
      rows.push({ item, repeats: 1 });
    }
  }
  return rows;
}

/** Our own jump fires a scroll event after the tail may have grown; that event isn't the user. */
function scrollToBottom(box: HTMLDivElement, selfScrolled: RefObject<boolean>): void {
  selfScrolled.current = true;
  box.scrollTop = box.scrollHeight;
}

interface ThreadProps {
  state: PilotState;
}

/** Newest at the bottom, then what the pilot is doing now; what waits on the user is in the queue. */
export function Thread(props: ThreadProps): ReactElement {
  const { state } = props;
  const query = useInfiniteQuery(pilotQueries.thread());
  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Height before an earlier page was prepended, so the view stays on what the user was reading.
  const heightBeforePrepend = useRef<number | null>(null);
  const pinned = useRef(true);
  const selfScrolled = useRef(false);

  const items = (query.data?.pages ?? []).flatMap((page) => page.items).reverse();
  const rows = collapseRepeats(items);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  const loadEarlier = (): void => {
    const box = scrollRef.current;
    if (!box || isFetchingNextPage) {
      return;
    }
    heightBeforePrepend.current = box.scrollHeight;
    void fetchNextPage();
  };

  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box || items.length === 0) {
      return;
    }
    if (heightBeforePrepend.current !== null) {
      box.scrollTop += box.scrollHeight - heightBeforePrepend.current;
      heightBeforePrepend.current = null;
    } else if (pinned.current) {
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
      if (pinned.current && heightBeforePrepend.current === null) {
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
      sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.5 }}
    >
      <Stack ref={contentRef} spacing={3} sx={{ maxWidth: THREAD_WIDTH, py: 1 }}>
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
            {rows.map(({ item, repeats }, index) => {
              const day = formatDayLabel(item.at);
              const newDay = index === 0 || formatDayLabel(rows[index - 1].item.at) !== day;
              return (
                <Fragment key={`${item.type}:${item.id}`}>
                  {newDay && <DaySeparator label={day} />}
                  <ThreadItem item={item} repeats={repeats} />
                </Fragment>
              );
            })}
          </Stack>
        </QuerySection>
        <SetupTurn state={state} />
        <LiveTurn state={state} />
      </Stack>
    </Box>
  );
}
