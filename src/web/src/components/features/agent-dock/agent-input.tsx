"use client";

import { useState, type KeyboardEvent, type ReactElement } from "react";
import { Send } from "@mui/icons-material";
import { Box, IconButton, InputBase, Stack, Typography } from "@mui/material";
import { useAgent } from "@/providers/agent-provider";

const KEY_HINTS: ReadonlyArray<{ kbd: string; copy: string }> = [
  { kbd: "/", copy: "commands" },
  { kbd: "@", copy: "mention job" },
  { kbd: "↵", copy: "send" },
];

export function AgentInput(): ReactElement {
  const { inject } = useAgent();
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (): Promise<void> => {
    const text = value.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await inject(text);
      setValue("");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        sx={(theme) => ({
          alignItems: "center",
          backgroundColor: theme.palette.surfaces.card,
          border: `1px solid ${theme.palette.line.borderHi}`,
          borderRadius: theme.radii.md,
          paddingInline: theme.spacing(1.25),
          paddingBlock: theme.spacing(0.75),
          transition: theme.motion.fast,
          "&:focus-within": { borderColor: theme.palette.accent.primary },
        })}
      >
        <InputBase
          placeholder="Ask Pilot to do something…"
          value={value}
          disabled={sending}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          sx={(theme) => ({
            flex: 1,
            color: theme.palette.text.primary,
            fontSize: "0.8125rem",
            "& input::placeholder": { color: theme.palette.text.disabled, opacity: 1 },
          })}
        />
        <IconButton
          size="small"
          onClick={submit}
          disabled={!value.trim() || sending}
          aria-label="Send"
          sx={(theme) => ({
            width: 26,
            height: 26,
            borderRadius: theme.radii.sm,
            background: theme.gradients.primary,
            color: theme.palette.surfaces.base,
            "&:hover": { background: theme.gradients.reversed },
            "&:disabled": { opacity: 0.4, color: theme.palette.surfaces.base },
          })}
        >
          <Send fontSize="xs" />
        </IconButton>
      </Stack>
      <Stack
        direction="row"
        spacing={1.5}
        sx={(theme) => ({
          marginTop: theme.spacing(1),
          color: theme.palette.text.disabled,
        })}
      >
        {KEY_HINTS.map((hint) => (
          <Stack key={hint.kbd} direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <Box
              component="span"
              sx={(theme) => ({
                paddingInline: 5,
                paddingBlock: "1px",
                backgroundColor: theme.palette.surfaces.card,
                border: `1px solid ${theme.palette.line.borderHi}`,
                borderRadius: 3,
                color: theme.palette.text.secondary,
                fontFamily: "var(--font-geist-mono), monospace",
                fontSize: "0.625rem",
              })}
            >
              {hint.kbd}
            </Box>
            <Typography variant="overlineMuted" sx={{ letterSpacing: 0, textTransform: "none" }}>
              {hint.copy}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
