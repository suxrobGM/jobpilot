"use client";

import { SyntheticEvent, useRef, useState, type ReactElement } from "react";
import { PlayArrow } from "@mui/icons-material";
import { Box, Button, Popover, Stack, TextField, Typography } from "@mui/material";
import { formatSkillCommand } from "@/lib/terminal";
import { useAgent } from "@/providers/agent-provider";

export function AutopilotRunButton(): ReactElement {
  const { injectSkill, provider, expand } = useAgent();
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setOpen(false);
    expand("terminal");
    await injectSkill("autopilot", trimmed);
  };

  const command = formatSkillCommand(provider, "autopilot");

  return (
    <>
      <Button
        ref={anchorRef}
        variant="contained"
        startIcon={<PlayArrow />}
        onClick={() => setOpen(true)}
      >
        Run autopilot
      </Button>
      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box component="form" onSubmit={handleSubmit} sx={{ p: 2, width: 360 }}>
          <Stack spacing={1.5}>
            <Typography variant="body2Muted">
              Inject <code>{command} &lt;query&gt;</code> into the terminal.
            </Typography>
            <TextField
              autoFocus
              size="small"
              label="Search query"
              placeholder="senior typescript remote"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={query.trim().length === 0}>
                Start
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Popover>
    </>
  );
}
