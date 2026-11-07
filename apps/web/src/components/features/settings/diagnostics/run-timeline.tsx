"use client";

import type { ReactElement } from "react";
import type { PilotJournalEntry } from "@jobpilot/contracts/pilot";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { RelativeTime } from "@/components/ui/display";
import { formatSpanBetween, plural } from "@/utils/format";
import { JournalRow, RunMeta } from "../../pilot/journal/journal-row";

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
            <Typography variant="captionMuted">
              · {plural(entries.length, "entry", "entries")}
            </Typography>
          </Stack>
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
        // A one-entry run is just that entry; its row already carries the run's agent and tokens.
        if (block.type === "entry" || block.entries.length === 1) {
          const entry = block.type === "entry" ? block.entry : block.entries[0];
          return <JournalRow key={entry.id} entry={entry} />;
        }
        const defaultOpen = !firstRunSeen;
        firstRunSeen = true;
        return <RunCard key={block.runId} entries={block.entries} defaultOpen={defaultOpen} />;
      })}
    </Stack>
  );
}
