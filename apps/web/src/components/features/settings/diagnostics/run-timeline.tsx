"use client";

import type { ReactElement, ReactNode } from "react";
import type { PilotJournalEntry, PilotJournalKind } from "@jobpilot/contracts/pilot";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { RelativeTime } from "@/components/ui/display";
import { formatSpanBetween } from "@/utils/format";
import { JournalRow, KIND_META, KIND_ORDER, RunMeta } from "../../pilot/journal/journal-row";

interface RunBlock {
  type: "run";
  runId: string;
  entries: PilotJournalEntry[];
}

type Block = RunBlock | { type: "entry"; entry: PilotJournalEntry };

/** Each run sits at its newest entry's position; entries without a run (host reports) stand alone. */
function toBlocks(entries: PilotJournalEntry[]): Block[] {
  const blocks: Block[] = [];
  const blockByRun = new Map<string, RunBlock>();

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
    const created: RunBlock = { type: "run", runId: entry.runId, entries: [entry] };
    blockByRun.set(entry.runId, created);
    blocks.push(created);
  }
  return blocks;
}

interface RunEntriesProps {
  entries: PilotJournalEntry[];
}

function KindSummary(props: RunEntriesProps): ReactNode {
  const { entries } = props;
  const counts = new Map<PilotJournalKind, number>();
  for (const entry of entries) {
    counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
  }
  const kinds = KIND_ORDER.filter((kind) => counts.has(kind));
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

interface RunCardProps extends RunEntriesProps {
  defaultOpen: boolean;
}

function RunCard(props: RunCardProps): ReactElement {
  const { entries, defaultOpen } = props;

  const chronological = [...entries].reverse();
  const started = chronological[0]?.createdAt;
  const duration =
    entries.length < 2 ? "" : formatSpanBetween(chronological[0].createdAt, entries[0].createdAt);
  const run = entries.find((entry) => entry.run)?.run ?? null;

  return (
    <Accordion defaultExpanded={defaultOpen} slotProps={{ transition: { unmountOnExit: true } }}>
      <AccordionSummary>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="body1Strong">Run</Typography>
            {started && <RelativeTime value={started} />}
            {duration && <Typography variant="captionMuted">· {duration}</Typography>}
            {run && <RunMeta run={run} />}
          </Stack>
          <KindSummary entries={entries} />
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.5} divider={<Divider />}>
          {chronological.map((entry) => (
            <JournalRow key={entry.id} entry={entry} />
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

export function RunTimeline(props: RunEntriesProps): ReactElement {
  const { entries } = props;
  const blocks = toBlocks(entries);
  let firstRunSeen = false;

  return (
    <Stack spacing={1.5}>
      {blocks.map((block) => {
        if (block.type === "entry") {
          return <JournalRow key={block.entry.id} entry={block.entry} />;
        }
        const defaultOpen = !firstRunSeen;
        firstRunSeen = true;
        return <RunCard key={block.runId} entries={block.entries} defaultOpen={defaultOpen} />;
      })}
    </Stack>
  );
}
