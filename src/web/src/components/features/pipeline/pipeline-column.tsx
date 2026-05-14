"use client";

import { useRef, type ReactElement } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PipelineCard } from "./pipeline-card";
import type { PipelineColumnData, PipelineJob, PipelineStage } from "./types";

const STAGE_TONE_KEY: Record<PipelineStage, "discovered" | "queued" | "applying" | "submitted" | "replied"> = {
  discovered: "discovered",
  queued: "queued",
  applying: "applying",
  submitted: "submitted",
  replied: "replied",
};

const CARD_HEIGHT = 108;
const CARD_GAP = 10;

interface PipelineColumnProps {
  data: PipelineColumnData;
  onJobClick?: (job: PipelineJob) => void;
  onLoadMore?: () => void;
}

export function PipelineColumn(props: PipelineColumnProps): ReactElement {
  const { data, onJobClick, onLoadMore } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const toneKey = STAGE_TONE_KEY[data.stage];
  const isApplying = data.stage === "applying";

  const virtualizer = useVirtualizer({
    count: data.items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_HEIGHT + CARD_GAP,
    overscan: 4,
  });

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
              backgroundColor: theme.palette.stages[toneKey],
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
            {data.label}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "baseline" }}>
          <Typography
            variant="captionMuted"
            sx={(theme) => ({ color: theme.palette.text.secondary })}
          >
            {data.total}
          </Typography>
          {data.todayCount ? (
            <Typography variant="captionMuted">· {data.todayCount} today</Typography>
          ) : null}
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
        {data.items.length === 0 ? (
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
              const job = data.items[row.index];
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

        {data.hasMore && onLoadMore && (
          <Box
            onClick={onLoadMore}
            role="button"
            tabIndex={0}
            sx={(theme) => ({
              marginTop: 1,
              padding: 1,
              borderRadius: theme.radii.sm,
              border: `1px dashed ${theme.palette.line.borderHi}`,
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: "0.6875rem",
              color: theme.palette.text.disabled,
              textAlign: "center",
              cursor: "pointer",
              transition: theme.motion.fast,
              "&:hover": {
                color: theme.palette.text.secondary,
                borderColor: theme.palette.text.disabled,
              },
            })}
          >
            + {data.total - data.items.length} more
          </Box>
        )}
      </Box>
    </Stack>
  );
}
