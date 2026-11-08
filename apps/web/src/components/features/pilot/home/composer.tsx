"use client";

import { type ReactElement, useState } from "react";
import { AddLink, ArrowUpward } from "@mui/icons-material";
import { Button, Card, Chip, InputBase, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { pilotQueries, resumeQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { plural } from "@/utils/format";
import { AddLinksDialog } from "../../pipeline/add-links-dialog";
import { parseLinks, useAddLinks } from "../../pipeline/use-add-links";
import { usePilotState } from "../use-pilot-state";

// Each fills the box, so the user can narrow it before sending.
const SUGGESTED_PROMPTS = [
  "Find more jobs beyond my boards",
  "What did you apply to this week?",
  "Skip jobs that need a security clearance",
];

// Before any search exists, the first message is how the user sets the pilot up.
const FROM_RESUME_PROMPT = "Set up searches from my resume";
const DESCRIBE_PROMPT = "Senior frontend roles, remote in the US. Skip crypto and agencies.";

interface PromptChipsProps {
  settingUp: boolean;
  onPick: (prompt: string) => void;
}

function PromptChips(props: PromptChipsProps): ReactElement {
  const { settingUp, onPick } = props;
  const hasResume = Boolean(useQuery(resumeQueries.list()).data?.length);
  const setupPrompts = hasResume ? [FROM_RESUME_PROMPT, DESCRIBE_PROMPT] : [DESCRIBE_PROMPT];
  const prompts = settingUp ? setupPrompts : SUGGESTED_PROMPTS;
  return (
    // Phones scroll the prompts sideways instead of stacking three rows over the box.
    <Stack
      direction="row"
      sx={{ flexWrap: { xs: "nowrap", sm: "wrap" }, overflowX: "auto", gap: 0.75 }}
    >
      {prompts.map((prompt) => (
        <Chip
          key={prompt}
          label={prompt}
          variant="outlined"
          onClick={() => onPick(prompt)}
          sx={(theme) => ({ borderRadius: theme.radii.pill })}
        />
      ))}
    </Stack>
  );
}

/** Talk to the pilot; its reply runs in the user's own agent session ahead of other work. */
export function Composer(): ReactElement {
  const state = usePilotState();
  const [text, setText] = useState("");
  const [addingLinks, setAddingLinks] = useState(false);
  const settingUp = useQuery(pilotQueries.searches()).data?.length === 0;
  const links = parseLinks(text);
  const replying = state.currentRun?.taskType === "chat.reply";
  const empty = text.trim() === "";

  const send = useApiMutation((body: string) => api.pilot.messages.post({ body }), {
    invalidate: [pilotQueries.threadAll],
    onSuccess: () => setText(""),
  });
  // The chip adds the links without a model.
  const addLinks = useAddLinks(() => setText(""));

  const submit = (): void => {
    if (!empty && !send.isPending) {
      send.mutate(text.trim());
    }
  };

  return (
    <Stack spacing={1.25} sx={{ pt: 1.5 }}>
      {replying && <Typography variant="captionMuted">Pilot is replying…</Typography>}
      {text === "" && <PromptChips settingUp={settingUp} onPick={setText} />}
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
      <Card variant="field">
        <InputBase
          multiline
          minRows={1}
          maxRows={8}
          fullWidth
          placeholder={
            settingUp
              ? "Tell the pilot what jobs you want…"
              : "Ask the pilot, change a rule, or paste job links…"
          }
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
          sx={{ px: 2, pt: 1.75, pb: 0.5, typography: "body1" }}
        />
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", px: 1, pb: 1 }}>
          <Button
            size="small"
            color="inherit"
            startIcon={<AddLink fontSize="sm" />}
            onClick={() => setAddingLinks(true)}
          >
            Job links
          </Button>
          <Typography
            variant="captionMuted"
            sx={{ flex: 1, textAlign: "right", pr: 1, display: { xs: "none", sm: "block" } }}
          >
            Enter to send · Shift+Enter for a new line
          </Typography>
          <Button
            variant="contained"
            size="small"
            aria-label="Send"
            disabled={empty || send.isPending}
            onClick={submit}
            sx={{ ml: { xs: "auto", sm: 0 }, minWidth: 0, px: 1 }}
          >
            <ArrowUpward fontSize="sm" />
          </Button>
        </Stack>
      </Card>
      <AddLinksDialog open={addingLinks} onClose={() => setAddingLinks(false)} />
    </Stack>
  );
}
