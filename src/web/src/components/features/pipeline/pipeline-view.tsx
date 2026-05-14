"use client";

import { useState, type ReactElement } from "react";
import { Add, PlayArrow } from "@mui/icons-material";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useAgent } from "@/providers/agent-provider";
import { getMockPipeline } from "./mock-data";
import { PipelineBoard } from "./pipeline-board";
import type { PipelineJob } from "./types";

export function PipelineView(): ReactElement {
  const { expand } = useAgent();
  const [columns] = useState(() => getMockPipeline());

  const totals = columns.reduce((acc, c) => acc + c.total, 0);
  const submitted = columns.find((c) => c.stage === "submitted")?.total ?? 0;
  const replied = columns.find((c) => c.stage === "replied")?.total ?? 0;

  return (
    <Stack sx={{ height: "100%", minHeight: 0 }}>
      <Stack
        direction="row"
        sx={(theme) => ({
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 2,
          paddingInline: 2.5,
          paddingTop: 3,
          paddingBottom: 2,
          borderBottom: `1px solid ${theme.palette.line.divider}`,
        })}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overlineMuted">Workspace</Typography>
          <Typography
            variant="h1"
            sx={{ fontSize: "1.5rem", mt: 0.5, letterSpacing: "-0.015em" }}
          >
            Pipeline
          </Typography>
          <Typography variant="body2Muted" sx={{ mt: 0.5 }}>
            {totals} jobs · {submitted} submitted · {replied} replied
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          <Button variant="outlined" size="small" startIcon={<Add fontSize="md" />}>
            Add URLs
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<PlayArrow fontSize="md" />}
            onClick={() => expand("pilot")}
          >
            Ask Pilot
          </Button>
        </Stack>
      </Stack>

      <PipelineBoard
        columns={columns}
        onJobClick={(job: PipelineJob) => {
          // TODO: open detail pane (step 6/cleanup)
          console.debug("clicked job", job.id);
        }}
      />
    </Stack>
  );
}
