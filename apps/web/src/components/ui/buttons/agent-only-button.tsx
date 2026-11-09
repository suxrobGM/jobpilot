"use client";

import type { ReactElement, ReactNode } from "react";
import type { ButtonProps } from "@mui/material";
import { useAgentAvailable } from "@/providers/agent-provider";
import { TooltipButton } from "./tooltip-button";

const UNAVAILABLE = "Start the agent on your computer to run this.";

interface AgentOnlyButtonProps extends ButtonProps {
  children: ReactNode;
  /** Shown while the agent is reachable; the unavailable reason replaces it otherwise. */
  tooltip?: string;
}

/** Disabled with a reason, not hidden: a control that vanishes reads as a missing feature. */
export function AgentOnlyButton(props: AgentOnlyButtonProps): ReactElement {
  const { children, disabled, tooltip = "", ...rest } = props;
  const available = useAgentAvailable();

  return (
    <TooltipButton
      title={available ? tooltip : UNAVAILABLE}
      disabled={disabled || !available}
      {...rest}
    >
      {children}
    </TooltipButton>
  );
}
