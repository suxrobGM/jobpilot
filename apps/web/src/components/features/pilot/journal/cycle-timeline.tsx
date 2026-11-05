"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import {
  type PilotJournalEntry,
  type PilotJournalKind,
  pilotCycleDetailSchema,
} from "@jobpilot/contracts/pilot";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { Box, Chip, Collapse, Divider, Paper, Stack, Typography } from "@mui/material";
import { ColorChip, RelativeTime } from "@/components/ui/display";
import { CYCLE_STATUS_COLOR } from "@/lib/terminal";
import { formatDuration, formatSpanBetween } from "@/utils/format";
import { JournalRow, KIND_META, KIND_ORDER, RunMeta } from "./journal-row";

interface CycleBlock {
  type: "cycle";
  runId: string;
  entries: PilotJournalEntry[];
}

type Block = CycleBlock | { type: "entry"; entry: PilotJournalEntry };

/** Each cycle sits at its newest entry's position; cycle-less (host/system) entries stay standalone. */
function toBlocks(entries: PilotJournalEntry[]): Block[] {
  const blocks: Block[] = [];
  const blockByRun = new Map<string, CycleBlock>();

  for (const entry of entries) {
    if (!entry.runId) {
      blocks.push({ type: "entry", entry });
      continue;
    }
    const block = blockByRun.get(entry.runId);
    if (block) {
      block.entries.push(entry);
      continue;
    }
    const created: CycleBlock = { type: "cycle", runId: entry.runId, entries: [entry] };
    blockByRun.set(entry.runId, created);
    blocks.push(created);
  }
  return blocks;
}

interface CycleEntriesProps {
  entries: PilotJournalEntry[];
}

/** The `cycle` kind is skipped: the card header already says "Cycle" with its status. */
function KindSummary(props: CycleEntriesProps): ReactNode {
  const { entries } = props;
  const counts = new Map<PilotJournalKind, number>();
  for (const entry of entries) {
    counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
  }
  const kinds = KIND_ORDER.filter((kind) => kind !== "cycle" && counts.has(kind));
  if (kinds.length === 0) {
    return null;
  }

  return (
    <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75, mt: 1 }}>
      {kinds.map((kind) => (
        <Chip
          key={kind}
          variant="outlined"
          color={KIND_META[kind].color}
          label={`${KIND_META[kind].label} ${counts.get(kind)}`}
        />
      ))}
    </Stack>
  );
}

interface CycleCardProps extends CycleEntriesProps {
  defaultOpen: boolean;
}

function CycleCard(props: CycleCardProps): ReactElement {
  const { entries, defaultOpen } = props;
  const [open, setOpen] = useState(defaultOpen);

  const chronological = [...entries].reverse();
  const started = chronological[0]?.createdAt;
  const duration =
    entries.length < 2 ? "" : formatSpanBetween(chronological[0].createdAt, entries[0].createdAt);
  const cycleEntry = entries.find((entry) => entry.kind === "cycle");
  const detail = cycleEntry && pilotCycleDetailSchema.safeParse(cycleEntry.detail).data;
  const run = entries.find((entry) => entry.run)?.run ?? null;

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
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="body1Strong">Cycle</Typography>
            {detail?.status && <ColorChip value={detail.status} colors={CYCLE_STATUS_COLOR} />}
            {started && <RelativeTime value={started} />}
            {duration && <Typography variant="captionMuted">· {duration}</Typography>}
            {detail?.sleepSeconds != null && (
              <Typography variant="captionMuted">
                · sleeps {formatDuration(detail.sleepSeconds)}
              </Typography>
            )}
            {run && <RunMeta run={run} />}
          </Stack>
          <KindSummary entries={entries} />
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

export function CycleTimeline(props: CycleEntriesProps): ReactElement {
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
        return <CycleCard key={block.runId} entries={block.entries} defaultOpen={defaultOpen} />;
      })}
    </Stack>
  );
}
