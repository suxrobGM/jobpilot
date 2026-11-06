"use client";

import { Fragment, type ReactElement, useEffect, useLayoutEffect, useRef } from "react";
import { Box, Button, Chip, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import { useInfiniteQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { QuerySection } from "@/components/ui/feedback";
import { formatDayLabel } from "@/utils/format";
import { ThreadItem } from "./thread-item";

/** Within this distance of the bottom, new items keep the view pinned to the newest. */
const STICK_TO_BOTTOM_PX = 120;

const SUGGESTED_PROMPTS = [
  "What did you apply to this week?",
  "Look for remote ML engineer roles too",
  "Skip jobs that need a security clearance",
];

interface GreetingProps {
  onPrompt: (text: string) => void;
}

function Greeting(props: GreetingProps): ReactElement {
  const { onPrompt } = props;
  return (
    <Stack spacing={1.5} sx={{ alignItems: "center", py: 6, textAlign: "center" }}>
      <Typography variant="h4" component="p">
        Hi. What should I work on?
      </Typography>
      <Typography variant="body2Muted">
        Ask about your search, change a rule, or send me job links. What I do shows up here.
      </Typography>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, justifyContent: "center" }}>
        {SUGGESTED_PROMPTS.map((prompt) => (
          <Chip key={prompt} label={prompt} variant="outlined" onClick={() => onPrompt(prompt)} />
        ))}
      </Stack>
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

interface ThreadProps {
  /** Fills the composer with a suggested prompt. */
  onPrompt: (text: string) => void;
}

/** Newest at the bottom; scrolling to the top loads earlier items. */
export function Thread(props: ThreadProps): ReactElement {
  const { onPrompt } = props;
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
          empty={<Greeting onPrompt={onPrompt} />}
        >
          <Stack spacing={1.5}>
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
      </Stack>
    </Box>
  );
}
