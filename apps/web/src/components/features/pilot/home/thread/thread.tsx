"use client";

import { type ReactElement, type ReactNode, useEffect, useLayoutEffect, useRef } from "react";
import { Box, Button, CircularProgress, Stack } from "@mui/material";
import { useInfiniteQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { EmptyState, QuerySection } from "@/components/ui/feedback";
import { ThreadItem } from "./thread-item";

/** Within this distance of the bottom, new items keep the view pinned to the newest. */
const STICK_TO_BOTTOM_PX = 120;

interface ThreadProps {
  /** Pinned above the oldest item, e.g. the Get started card. */
  header?: ReactNode;
}

/** Newest at the bottom; scrolling to the top loads earlier items. */
export function Thread(props: ThreadProps): ReactElement {
  const { header } = props;
  const query = useInfiniteQuery(pilotQueries.thread());
  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  // Height before an earlier page was prepended, so the view stays on what the user was reading.
  const heightBeforePrepend = useRef<number | null>(null);
  const pinned = useRef(true);

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
      box.scrollTop = box.scrollHeight;
    }
  });

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
        pinned.current = box.scrollHeight - box.scrollTop - box.clientHeight < STICK_TO_BOTTOM_PX;
      }}
      sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.5 }}
    >
      <Stack spacing={1.5}>
        {header}
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
          empty={
            <EmptyState variant="inline" title="Nothing yet. What the pilot does shows up here." />
          }
        >
          <Stack spacing={1.5}>
            {items.map((item) => (
              <ThreadItem key={`${item.type}:${item.id}`} item={item} />
            ))}
          </Stack>
        </QuerySection>
      </Stack>
    </Box>
  );
}
