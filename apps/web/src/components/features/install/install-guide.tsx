"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  alpha,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { LinkButton } from "@/components/ui/buttons";
import { CopyField } from "@/components/ui/display";
import { formatSkillCommand, type TerminalProviderId } from "@/lib/terminal";
import { HostInstallCommands } from "./host-install-commands";
import { PLUGIN_COMMANDS } from "./provider-commands";
import { ProviderTabs } from "./provider-tabs";

interface InstallStepProps {
  number: number;
  title: string;
  children: ReactNode;
}

function InstallStep(props: InstallStepProps): ReactElement {
  const { number, title, children } = props;
  return (
    <Paper component={Stack} variant="panel" spacing={1.5} sx={{ padding: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Avatar
          sx={(theme) => ({
            width: 28,
            height: 28,
            ...theme.typography.body1Strong,
            color: theme.palette.accent.primary,
            backgroundColor: "transparent",
            border: `1px solid ${alpha(theme.palette.accent.primary, 0.4)}`,
          })}
        >
          {number}
        </Avatar>
        <Typography variant="h4" component="h6">
          {title}
        </Typography>
      </Stack>
      {children}
    </Paper>
  );
}

export function InstallGuide(): ReactElement {
  const [provider, setProvider] = useState<TerminalProviderId>("claude");

  return (
    <Stack spacing={3}>
      <InstallStep number={1} title="Add the JobPilot plugin">
        <ProviderTabs value={provider} onChange={setProvider} />
        <Typography variant="body2Muted">
          {provider === "claude"
            ? "Run these in Claude Code. The terminal, desktop app, and VS Code extension all work."
            : "Run these in a terminal where the Codex CLI is installed."}
        </Typography>
        <Stack spacing={1}>
          {PLUGIN_COMMANDS[provider].map((command) => (
            <CopyField
              key={command}
              value={command}
              copyMessage="Command copied"
              ariaLabel="Copy plugin command"
            />
          ))}
        </Stack>
      </InstallStep>

      <InstallStep number={2} title="Run setup">
        <Typography variant="body2Muted">
          {provider === "claude"
            ? "In the same Claude Code session, run setup. It installs the JobPilot agent on your computer and starts it. If it's already installed, setup updates it. This is the only command you need to type."
            : "Start a new Codex session and run $setup. It installs the JobPilot agent on your computer and starts it. If it's already installed, setup updates it. This is the only command you need to type."}
        </Typography>
        <CopyField
          value={formatSkillCommand(provider, "setup")}
          copyMessage="Command copied"
          ariaLabel="Copy setup command"
        />
      </InstallStep>

      <InstallStep number={3} title="Create your account">
        <Typography variant="body2Muted">
          Sign up and upload your resume. The agent connects to your account by itself. Then turn on
          the Pilot from the dashboard.
        </Typography>
        <LinkButton href="/register" variant="contained" size="large" sx={{ alignSelf: "start" }}>
          Create account
        </LinkButton>
      </InstallStep>

      <Accordion>
        <AccordionSummary>
          <Typography variant="body1Muted">
            Need to reinstall the agent without the plugin?
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>
            <Typography variant="body2Muted">
              Run the command for your system, then type <code>jobpilot</code> to start it. Codex
              still needs the plugin installed.
            </Typography>
            <HostInstallCommands />
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}
