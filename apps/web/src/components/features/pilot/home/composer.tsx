"use client";

import { type ReactElement, useState } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { AddLink, ArrowUpward, Tune } from "@mui/icons-material";
import { Box, Button, Chip, IconButton, InputBase, Stack, Typography } from "@mui/material";
import { darken } from "@mui/material/styles";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { plural } from "@/utils/format";
import { AddLinksDialog } from "../../pipeline/add-links-dialog";
import { parseLinks, useAddLinks } from "../../pipeline/use-add-links";
import { RulesDialog } from "./side/rules-dialog";

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
  const [dialog, setDialog] = useState<"links" | "rules" | null>(null);
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
      {text === "" && (
        // Phones scroll the prompts sideways instead of stacking three rows over the box.
        <Stack
          direction="row"
          sx={{ flexWrap: { xs: "nowrap", sm: "wrap" }, overflowX: "auto", gap: 0.75 }}
        >
          {SUGGESTED_PROMPTS.map((prompt) => (
            <Chip
              key={prompt}
              label={prompt}
              variant="outlined"
              onClick={() => setText(prompt)}
              sx={(theme) => ({ borderRadius: theme.radii.pill })}
            />
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
      <Box
        sx={(theme) => ({
          border: 1,
          borderColor: "line.borderHi",
          borderRadius: theme.radii.lg * 1.5,
          backgroundColor: theme.palette.surfaces.card,
          boxShadow: theme.shadows_custom.md,
          transition: theme.motion.fast,
          "&:focus-within": { borderColor: "accent.primary" },
        })}
      >
        <InputBase
          multiline
          minRows={1}
          maxRows={8}
          fullWidth
          placeholder="Ask the pilot, change a rule, or paste job links…"
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
            onClick={() => setDialog("links")}
          >
            Job links
          </Button>
          <Button
            size="small"
            color="inherit"
            startIcon={<Tune fontSize="sm" />}
            onClick={() => setDialog("rules")}
          >
            Rules
          </Button>
          <Typography
            variant="captionMuted"
            sx={{ flex: 1, textAlign: "right", pr: 1, display: { xs: "none", sm: "block" } }}
          >
            Enter to send · Shift+Enter for a new line
          </Typography>
          <IconButton
            aria-label="Send"
            disabled={empty || send.isPending}
            onClick={submit}
            sx={(theme) => ({
              ml: { xs: "auto", sm: 0 },
              borderRadius: theme.radii.lg,
              // The same fill as a contained button.
              color: theme.palette.common.white,
              backgroundColor: theme.palette.accent.action,
              "&:hover": { backgroundColor: darken(theme.palette.accent.action, 0.12) },
              "&.Mui-disabled": {
                color: "text.disabled",
                backgroundColor: theme.palette.surfaces.elevated,
              },
            })}
          >
            <ArrowUpward fontSize="sm" />
          </IconButton>
        </Stack>
      </Box>
      <AddLinksDialog open={dialog === "links"} onClose={() => setDialog(null)} />
      <RulesDialog state={state} open={dialog === "rules"} onClose={() => setDialog(null)} />
    </Stack>
  );
}
