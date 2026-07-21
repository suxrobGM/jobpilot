"use client";

import { type ReactElement, useState } from "react";
import type { PilotJournalEntry, PilotJournalKind } from "@jobpilot/contracts/pilot";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { Box, Chip, Collapse, Divider, Paper, Stack, Typography } from "@mui/material";
import { RelativeTime } from "@/components/ui/display";
import { formatSpanBetween } from "@/utils/format";
import { JournalRow, KIND_META, KIND_ORDER } from "./journal-row";

type Block =
  | { type: "cycle"; cycleId: string; entries: PilotJournalEntry[] }
  | { type: "entry"; entry: PilotJournalEntry };

/**
 * Groups a newest-first entry list into cycle blocks anchored at each cycle's newest entry;
 * cycle-less entries (host orchestrator / system) stay standalone in their chronological position.
 */
function toBlocks(entries: PilotJournalEntry[]): Block[] {
  const blocks: Block[] = [];
  const indexByCycle = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.cycleId) {
      blocks.push({ type: "entry", entry });
      continue;
    }
    const at = indexByCycle.get(entry.cycleId);
    if (at === undefined) {
      indexByCycle.set(entry.cycleId, blocks.length);
      blocks.push({ type: "cycle", cycleId: entry.cycleId, entries: [entry] });
    } else {
      (blocks[at] as Extract<Block, { type: "cycle" }>).entries.push(entry);
    }
  }
  return blocks;
}

/** Compact elapsed span between a cycle's first and last entry, e.g. `1m`. */
function cycleDuration(entries: PilotJournalEntry[]): string {
  if (entries.length < 2) {
    return "";
  }
  return formatSpanBetween(entries[entries.length - 1].createdAt, entries[0].createdAt);
}

/** One chip per kind present in the cycle, counting occurrences. */
function KindSummary(props: { entries: PilotJournalEntry[] }): ReactElement {
  const { entries } = props;
  const counts = new Map<PilotJournalKind, number>();
  for (const entry of entries) {
    counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
  }
  const kinds = KIND_ORDER.filter((kind) => counts.has(kind));
  return (
    <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
      {kinds.map((kind) => (
        <Chip
          key={kind}
          size="small"
          variant="outlined"
          color={KIND_META[kind].color}
          label={`${KIND_META[kind].label} ${counts.get(kind)}`}
        />
      ))}
    </Stack>
  );
}

function CycleCard(props: { entries: PilotJournalEntry[]; defaultOpen: boolean }): ReactElement {
  const { entries, defaultOpen } = props;
  const [open, setOpen] = useState(defaultOpen);
  // Entries arrive newest-first; the oldest anchors the cycle's start, and the body reads chronologically.
  const chronological = [...entries].reverse();
  const started = chronological[0]?.createdAt;
  const duration = cycleDuration(entries);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        component="button"
        type="button"
        onClick={() => setOpen((v) => !v)}
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: "center",
          width: "100%",
          textAlign: "left",
          background: "none",
          border: 0,
          p: 0,
          cursor: "pointer",
          color: "inherit",
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Cycle
            </Typography>
            {started && <RelativeTime value={started} />}
            {duration && <Typography variant="captionMuted">· {duration}</Typography>}
          </Stack>
          <Box sx={{ mt: 1 }}>
            <KindSummary entries={entries} />
          </Box>
        </Box>
        {open ? <ExpandLess fontSize="sm" /> : <ExpandMore fontSize="sm" />}
      </Stack>
      <Collapse in={open}>
        <Stack spacing={1.5} divider={<Divider />} sx={{ mt: 2 }}>
          {chronological.map((entry) => (
            <JournalRow key={entry.id} entry={entry} />
          ))}
        </Stack>
      </Collapse>
    </Paper>
  );
}

interface CycleTimelineProps {
  entries: PilotJournalEntry[];
}

/** Journal grouped into collapsible cycle cards (newest first), with standalone rows in place. */
export function CycleTimeline(props: CycleTimelineProps): ReactElement {
  const { entries } = props;
  const blocks = toBlocks(entries);
  let firstCycleSeen = false;

  return (
    <Stack spacing={1.5}>
      {blocks.map((block) => {
        if (block.type === "entry") {
          return <JournalRow key={block.entry.id} entry={block.entry} />;
        }
        const defaultOpen = !firstCycleSeen;
        firstCycleSeen = true;
        return <CycleCard key={block.cycleId} entries={block.entries} defaultOpen={defaultOpen} />;
      })}
    </Stack>
  );
}
