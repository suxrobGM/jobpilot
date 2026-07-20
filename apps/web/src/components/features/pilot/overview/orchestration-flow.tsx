"use client";

import "@xyflow/react/dist/style.css";
import type { ReactElement } from "react";
import { Box, useTheme } from "@mui/material";
import { Background, BackgroundVariant, type Edge, ReactFlow } from "@xyflow/react";
import { type StageFlowNode, stageNodeTypes } from "./flow-nodes";
import type { PilotStage, PilotStageNode } from "./use-pilot-stage";

const ORDER: PilotStageNode[] = ["conductor", "agent", "worker", "results"];

const POSITION: Record<PilotStageNode, { x: number; y: number }> = {
  conductor: { x: 0, y: 40 },
  agent: { x: 220, y: 40 },
  worker: { x: 440, y: 40 },
  results: { x: 660, y: 40 },
};

/** Distinct hues for the four agents; adjacency stays legible and every node also carries a text label. */
const TONE: Record<PilotStageNode, StageFlowNode["data"]["tone"]> = {
  conductor: "blue",
  agent: "violet",
  worker: "amber",
  results: "green",
};

function truncate(text: string, max = 72): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function conductorCaption(stage: PilotStage): string {
  switch (stage.mode) {
    case "off":
      return "Pilot disabled";
    case "offline":
      return "Agent offline";
    case "working":
      return "Running a cycle";
    default:
      return stage.sleepLabel ?? "Idle";
  }
}

function captionFor(node: PilotStageNode, stage: PilotStage): string {
  switch (node) {
    case "conductor":
      return conductorCaption(stage);
    case "agent":
      return stage.topAgendaItem
        ? `Next: ${truncate(stage.topAgendaItem, 60)}`
        : "Senses the agenda";
    case "worker":
      return stage.latestAction ? truncate(stage.latestAction) : "Scores & applies jobs";
    default:
      return `${stage.appliedToday} / ${stage.dailyCap} applied today`;
  }
}

const NODE_META: Record<PilotStageNode, { title: string; role: string }> = {
  conductor: { title: "Conductor", role: "Host loop" },
  agent: { title: "Agent", role: "Cycle" },
  worker: { title: "Worker", role: "Subagent" },
  results: { title: "Results", role: "Board / API" },
};

interface OrchestrationFlowProps {
  stage: PilotStage;
}

/** ReactFlow canvas; the parent gates it behind a mounted flag so no browser API runs during SSR. */
export function OrchestrationFlow(props: OrchestrationFlowProps): ReactElement {
  const { stage } = props;
  const theme = useTheme();
  const flame = theme.palette.accent.primary;
  const dim = theme.palette.divider;
  const muted = stage.mode === "off" || stage.mode === "offline";

  const nodes: StageFlowNode[] = ORDER.map((id) => ({
    id,
    type: "stage",
    position: POSITION[id],
    data: {
      ...NODE_META[id],
      caption: captionFor(id, stage),
      active: stage.mode === "working" && stage.activeNode === id,
      muted,
      tone: TONE[id],
    },
    draggable: false,
    selectable: false,
  }));

  const activeIndex = stage.mode === "working" ? ORDER.indexOf(stage.activeNode) : 0;
  const edges: Edge[] = ORDER.slice(0, -1).map((from, i) => {
    const lit = i < activeIndex;
    return {
      id: `${from}-${ORDER[i + 1]}`,
      source: from,
      target: ORDER[i + 1],
      type: "smoothstep",
      animated: lit,
      style: { stroke: lit ? flame : dim, strokeWidth: lit ? 2 : 1.5 },
    };
  });

  return (
    <Box
      sx={{
        height: 240,
        width: "100%",
        // Reset the library's default node/handle/attribution chrome so only our themed surfaces show.
        "& .react-flow__node": {
          background: "transparent",
          border: 0,
          padding: 0,
          fontFamily: "inherit",
        },
        "& .react-flow__handle": { opacity: 0 },
        "& .react-flow__attribution": { display: "none" },
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={stageNodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        minZoom={0.5}
        maxZoom={1.5}
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color={dim} />
      </ReactFlow>
    </Box>
  );
}
