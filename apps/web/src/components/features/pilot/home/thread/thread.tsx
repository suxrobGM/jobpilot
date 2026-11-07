"use client";

import {
  Fragment,
  type ReactElement,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Box, Button, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import { useInfiniteQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { QuerySection } from "@/components/ui/feedback";
import { formatDayLabel } from "@/utils/format";
import { LiveTurn } from "../now/live-turn";
import { NoticeTurns } from "../now/notice-turns";
import { SetupTurn } from "../now/setup-turn";
import { WaitingOnYou } from "../now/waiting-on-you";
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

/** Our own jump fires a scroll event after the tail may have grown; that event isn't the user. */
function scrollToBottom(box: HTMLDivElement, selfScrolled: RefObject<boolean>): void {
  selfScrolled.current = true;
  box.scrollTop = box.scrollHeight;
}

interface ThreadProps {
  state: PilotState;
}

/** Newest at the bottom, then what waits on the user and what the pilot is doing now. */
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
            {items.map((item, index) => {
              const day = formatDayLabel(item.at);
              const newDay = index === 0 || formatDayLabel(items[index - 1].at) !== day;
              return (
                <Fragment key={`${item.type}:${item.id}`}>
                  {newDay && <DaySeparator label={day} />}
                  <ThreadItem item={item} />
                </Fragment>
              );
            })}
          </Stack>
        </QuerySection>
        <SetupTurn state={state} />
        <NoticeTurns />
        <WaitingOnYou />
        <LiveTurn state={state} />
      </Stack>
    </Box>
  );
}
