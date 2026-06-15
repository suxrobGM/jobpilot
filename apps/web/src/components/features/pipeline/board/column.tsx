"use client";

import { useRef, type ReactElement } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useVirtualizer } from "@tanstack/react-virtual";
import { type PipelineJobDto, type PipelineStage } from "@/api/types";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { PipelineCard } from "../card/card";
import { usePipelineColumn, type PipelineColumnFilters } from "../hooks/use-pipeline-column";
import { ColumnEmptyState } from "./column-empty-state";
import { ColumnHeader } from "./column-header";

const CARD_HEIGHT = 108;
const CARD_GAP = 10;

interface PipelineColumnProps {
  stage: PipelineStage;
  filters?: PipelineColumnFilters;
  onJobClick?: (job: PipelineJobDto) => void;
  /** Stage can't be scoped to the active campaign (e.g. queued) — dim and skip the query. */
  scopedOut?: boolean;
}

/** When every visible card shares the same source note, surface it once on the column header. */
function commonSourceNote(items: PipelineJobDto[]): string | null {
  if (items.length < 2) {
    return null;
  }
  const first = items[0]?.stageSummary;
  if (!first) {
    return null;
  }
  return items.every((item) => item.stageSummary === first) ? first : null;
}

export function PipelineColumn(props: PipelineColumnProps): ReactElement {
  const { stage, filters, onJobClick, scopedOut = false } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const query = usePipelineColumn(stage, filters, { enabled: !scopedOut });
  const items: PipelineJobDto[] = query.data?.pages.flatMap((p) => p.items) ?? [];
  const head = query.data?.pages[0];
  const total = head?.total ?? 0;
  const todayCount = head?.todayCount ?? 0;
  const sharedNote = stage === "queued" ? commonSourceNote(head?.items ?? []) : null;

  // @tanstack/react-virtual returns functions the React Compiler can't optimize;
  // nothing to fix in our code.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_HEIGHT + CARD_GAP,
    overscan: 4,
  });

  const sentinelRef = useIntersectionObserver(
    () => {
      if (!query.isFetchingNextPage) {
        query.fetchNextPage();
      }
    },
    {
      root: scrollRef,
      rootMargin: "200px 0px",
      enabled: query.hasNextPage,
    },
  );

  return (
    <Stack
      sx={(theme) => ({
        flex: 1,
        minWidth: 240,
        height: "100%",
        backgroundColor: `${theme.palette.surfaces.card}99`,
        border: `1px solid ${theme.palette.line.divider}`,
        borderRadius: theme.radii.md,
        overflow: "hidden",
        opacity: scopedOut ? 0.55 : 1,
      })}
    >
      <ColumnHeader stage={stage} total={total} todayCount={todayCount} sharedNote={sharedNote} />

      <Box
        ref={scrollRef}
        sx={(theme) => ({
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 1,
          "&::-webkit-scrollbar-thumb": { backgroundColor: theme.palette.line.divider },
        })}
      >
        {scopedOut ? (
          <Stack
            sx={(theme) => ({
              alignItems: "center",
              justifyContent: "center",
              minHeight: 120,
              paddingInline: 2,
              textAlign: "center",
              color: theme.palette.text.disabled,
            })}
          >
            <Typography variant="captionMuted">Not tied to a campaign</Typography>
          </Stack>
        ) : query.isPending ? (
          <Stack
            sx={(theme) => ({
              alignItems: "center",
              justifyContent: "center",
              minHeight: 120,
              color: theme.palette.text.disabled,
            })}
          >
            <Typography variant="captionMuted">Loading…</Typography>
          </Stack>
        ) : items.length === 0 ? (
          <ColumnEmptyState stage={stage} />
        ) : (
          <Box sx={{ position: "relative", height: virtualizer.getTotalSize(), width: "100%" }}>
            {virtualizer.getVirtualItems().map((row) => {
              const job = items[row.index];
              if (!job) return null;
              return (
                <Box
                  key={job.id}
                  data-index={row.index}
                  ref={virtualizer.measureElement}
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${row.start}px)`,
                    paddingBottom: `${CARD_GAP}px`,
                  }}
                >
                  <PipelineCard job={job} onClick={onJobClick} />
                </Box>
              );
            })}
          </Box>
        )}

        {query.hasNextPage && (
          <Box
            ref={sentinelRef}
            sx={(theme) => ({
              marginTop: 1,
              padding: 1,
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: "0.6875rem",
              color: theme.palette.text.disabled,
              textAlign: "center",
            })}
          >
            {query.isFetchingNextPage ? "Loading more…" : `+ ${total - items.length} more`}
          </Box>
        )}
      </Box>
    </Stack>
  );
}
