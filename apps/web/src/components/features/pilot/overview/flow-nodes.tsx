"use client";

import type { ReactElement } from "react";
import { Paper, Stack, Typography } from "@mui/material";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { PulseDot, type PulseDotTone, toneColor } from "@/components/ui/feedback";

interface StageNodeData extends Record<string, unknown> {
  title: string;
  role: string;
  caption?: string | null;
  active: boolean;
  muted: boolean;
  tone: PulseDotTone;
}

export type StageFlowNode = Node<StageNodeData, "stage">;

/** Invisible connection point - edges need a handle to anchor to, but the diagram hides its chrome. */
const HANDLE_STYLE = { opacity: 0, pointerEvents: "none" as const, border: 0 };

/** One agent in the loop, rendered as a themed Paper so the surface matches the app, not the library. */
function StageNode(props: NodeProps<StageFlowNode>): ReactElement {
  const { data } = props;
  const { title, role, caption, active, muted, tone } = data;

  return (
    <>
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} isConnectable={false} />
      <Paper
        elevation={0}
        sx={(theme) => {
          const accent = toneColor(theme, tone);
          return {
            width: 160,
            px: 1.5,
            py: 1.25,
            borderRadius: `${theme.radii.xs}px`,
            backgroundColor: "background.paper",
            border: "1px solid",
            borderColor: active ? accent : "divider",
            boxShadow: active
              ? `0 0 0 1px ${accent}, 0 0 18px color-mix(in srgb, ${accent} 28%, transparent)`
              : "none",
            opacity: muted ? 0.55 : 1,
            transition: theme.transitions.create(["border-color", "box-shadow", "opacity"]),
          };
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.25 }}>
          <PulseDot tone={muted ? "muted" : tone} size="sm" pulsing={active && !muted} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {title}
          </Typography>
        </Stack>
        <Typography variant="overlineMuted" sx={{ display: "block", ml: 2 }}>
          {role}
        </Typography>
        {caption && (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 0.75,
              ml: 2,
              color: active && !muted ? "text.primary" : "text.secondary",
            }}
          >
            {caption}
          </Typography>
        )}
      </Paper>
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} isConnectable={false} />
    </>
  );
}

/** Registered once and reused for every node; role/tone come from node data. */
export const stageNodeTypes = { stage: StageNode } as const;
