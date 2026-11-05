"use client";

import type { ReactElement } from "react";
import { ChevronLeft, Terminal as TerminalIcon } from "@mui/icons-material";
import { Box, ButtonBase, Stack, Tooltip } from "@mui/material";
import { TooltipIconButton } from "@/components/ui/buttons";
import { useAgentDock } from "@/providers/agent-provider";
import { AgentOrb } from "./agent-orb";

export function DockStrip(): ReactElement {
  const { expand } = useAgentDock();

  return (
    <Stack
      spacing={1.25}
      sx={(theme) => ({
        alignItems: "center",
        width: "100%",
        height: "100%",
        paddingBlock: theme.spacing(1.5),
      })}
    >
      <Tooltip title="Open agent dock" placement="left" arrow>
        <ButtonBase
          onClick={() => expand()}
          aria-label="Open agent dock"
          sx={(theme) => ({
            borderRadius: "50%",
            "&.Mui-focusVisible": { boxShadow: theme.shadows_custom.focus },
          })}
        >
          <AgentOrb size="2xxl" />
        </ButtonBase>
      </Tooltip>

      <Box sx={{ flex: 1 }} />

      <TooltipIconButton
        title="Open terminal"
        placement="left"
        arrow
        size="small"
        onClick={() => expand()}
      >
        <TerminalIcon fontSize="sm" />
      </TooltipIconButton>

      <TooltipIconButton
        title="Expand dock"
        placement="left"
        arrow
        size="small"
        onClick={() => expand()}
      >
        <ChevronLeft fontSize="md" />
      </TooltipIconButton>
    </Stack>
  );
}
