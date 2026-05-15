"use client";

import { useRef, type ReactElement } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { PIPELINE_STAGE_LABEL, type PipelineJobDto, type PipelineStage } from "@/types/api";
import { PipelineCard } from "./pipeline-card";
import { usePipelineColumn, type PipelineColumnFilters } from "./use-pipeline-column";

const CARD_HEIGHT = 108;
const CARD_GAP = 10;

interface PipelineColumnProps {
  stage: PipelineStage;
  filters?: PipelineColumnFilters;
  onJobClick?: (job: PipelineJobDto) => void;
}

export function PipelineColumn(props: PipelineColumnProps): ReactElement {
  const { stage, filters, onJobClick } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isApplying = stage === "applying";

  const query = usePipelineColumn(stage, filters);
  const items: PipelineJobDto[] = query.data?.pages.flatMap((p) => p.items) ?? [];
  const head = query.data?.pages[0];
  const total = head?.total ?? 0;
  const todayCount = head?.todayCount ?? 0;

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
      })}
    >
      <Stack
        direction="row"
        sx={(theme) => ({
          alignItems: "center",
          justifyContent: "space-between",
          paddingInline: 1.5,
          paddingBlock: 1,
          borderBottom: `1px solid ${theme.palette.line.divider}`,
        })}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <Box
            sx={(theme) => ({
              width: 7,
              height: 7,
              borderRadius: "50%",
              backgroundColor: theme.palette.stages[stage],
              boxShadow: isApplying ? `0 0 0 3px ${theme.palette.stages.applying}33` : "none",
              animation: isApplying ? "stage-dot-pulse 2.4s ease-in-out infinite" : "none",
              "@keyframes stage-dot-pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.45 },
              },
              flexShrink: 0,
            })}
          />
          <Typography variant="h6" sx={{ fontSize: "0.8125rem", fontWeight: 500 }}>
            {PIPELINE_STAGE_LABEL[stage]}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "baseline" }}>
          <Typography
            variant="captionMuted"
            sx={(theme) => ({ color: theme.palette.text.secondary })}
          >
            {total}
          </Typography>
          {todayCount > 0 && <Typography variant="captionMuted">· {todayCount} today</Typography>}
        </Stack>
      </Stack>

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
        {query.isPending ? (
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
          <Stack
            sx={(theme) => ({
              alignItems: "center",
              justifyContent: "center",
              minHeight: 120,
              color: theme.palette.text.disabled,
            })}
          >
            <Typography variant="captionMuted">No jobs here yet</Typography>
          </Stack>
        ) : (
          <Box
            sx={{
              position: "relative",
              height: virtualizer.getTotalSize(),
              width: "100%",
            }}
          >
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
              fontFamily: "var(--font-geist-mono), monospace",
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
