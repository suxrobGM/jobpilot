import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";
import { PanelFrame } from "../mock-panels/panel-frame";

interface Line {
  text: string;
  tone: "prompt" | "ok" | "step" | "ask" | "muted";
}

const LINES: Line[] = [
  { text: "$ /jobpilot:pilot", tone: "prompt" },
  { text: "✓ Searched LinkedIn, Indeed, Wellfound", tone: "ok" },
  { text: "→ 31 new jobs · scoring against your resume", tone: "step" },
  { text: "✓ Norlake · Senior Frontend Engineer · 92% match", tone: "ok" },
  { text: "→ Tailoring resume · filling the application", tone: "step" },
  { text: "? Salary expectation: asked you on your phone", tone: "ask" },
  { text: "✓ You answered · application submitted", tone: "ok" },
  { text: "→ Today: 6 applied · 2 replies · next check in 40m", tone: "muted" },
];

const TONE_COLOR: Record<Line["tone"], string> = {
  prompt: "primary.main",
  ok: "success.main",
  step: "info.main",
  ask: "warning.main",
  muted: "text.secondary",
};

const LINE_SX = {
  "@keyframes transcript-line-in": {
    from: { opacity: 0, transform: "translateY(4px)" },
    to: { opacity: 1, transform: "none" },
  },
  animation: "transcript-line-in 360ms ease-out backwards",
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
} as const;

export function AgentTranscript(): ReactElement {
  return (
    <PanelFrame label="pilot · claude code">
      <Stack spacing={0.75}>
        {LINES.map((line, i) => (
          <Typography
            key={line.text}
            variant="monoBody"
            sx={[LINE_SX, { color: TONE_COLOR[line.tone], animationDelay: `${200 + i * 260}ms` }]}
          >
            {line.text}
          </Typography>
        ))}
      </Stack>
    </PanelFrame>
  );
}
