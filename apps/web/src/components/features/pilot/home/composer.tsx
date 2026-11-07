"use client";

import { type ReactElement, useState } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { AddLink, ArrowUpward } from "@mui/icons-material";
import { Chip, IconButton, InputBase, Paper, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { plural } from "@/utils/format";
import { parseLinks, useAddLinks } from "../../pipeline/use-add-links";

const SUGGESTED_PROMPTS = [
  "What did you apply to this week?",
  "Look for remote ML engineer roles too",
  "Skip jobs that need a security clearance",
];

interface ComposerProps {
  state: PilotState;
}

/** Talk to the pilot; its reply runs in the user's own agent session ahead of other work. */
export function Composer(props: ComposerProps): ReactElement {
  const { state } = props;
  const [text, setText] = useState("");
  const links = parseLinks(text);
  const replying = state.currentRun?.taskType === "chat.reply";

  const send = useApiMutation((body: string) => api.pilot.messages.post({ body }), {
    invalidate: [pilotQueries.threadAll],
    onSuccess: () => setText(""),
  });
  // The chip adds the links without a model.
  const addLinks = useAddLinks(() => setText(""));

  const submit = (): void => {
    const body = text.trim();
    if (body !== "" && !send.isPending) {
      send.mutate(body);
    }
  };

  return (
    <Stack spacing={0.75}>
      {replying && <Typography variant="captionMuted">Pilot is replying…</Typography>}
      {text === "" && (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          {SUGGESTED_PROMPTS.map((prompt) => (
            <Chip key={prompt} label={prompt} variant="outlined" onClick={() => setText(prompt)} />
          ))}
        </Stack>
      )}
      {links.length > 0 && (
        <Stack direction="row">
          <Chip
            icon={<AddLink fontSize="sm" />}
            label={`Add ${plural(links.length, "link")} to your pipeline`}
            onClick={() => addLinks.mutate(links)}
            disabled={addLinks.isPending}
          />
        </Stack>
      )}
      <Paper variant="outlined" sx={{ display: "flex", alignItems: "flex-end", px: 2, py: 1 }}>
        <InputBase
          multiline
          maxRows={8}
          fullWidth
          placeholder="Message your pilot…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter keeps writing.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          inputProps={{ "aria-label": "Message the pilot", maxLength: 4000 }}
        />
        <IconButton
          aria-label="Send"
          color="primary"
          disabled={text.trim() === "" || send.isPending}
          onClick={submit}
        >
          <ArrowUpward fontSize="sm" />
        </IconButton>
      </Paper>
    </Stack>
  );
}
