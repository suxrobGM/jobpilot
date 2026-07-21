"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import { ExpandMore } from "@mui/icons-material";
import { Box, Button, Collapse, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import { LinkButton } from "@/components/ui/buttons";
import { CopyField } from "@/components/ui/display";
import { HostInstallCommands } from "./host-install-commands";
import { type InstallProvider, PLUGIN_COMMANDS, SETUP_COMMANDS } from "./provider-commands";

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
        <Box
          sx={(theme) => ({
            width: 28,
            height: 28,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: theme.palette.accent.primary,
            border: `1px solid ${theme.palette.accent.primary}66`,
          })}
        >
          {number}
        </Box>
        <Typography variant="h6" sx={{ fontSize: "1.0625rem" }}>
          {title}
        </Typography>
      </Stack>
      {children}
    </Paper>
  );
}

/** Three-step plugin-first install flow, with a separate host repair path. */
export function InstallGuide(): ReactElement {
  const [provider, setProvider] = useState<InstallProvider>("claude");
  const [showDirect, setShowDirect] = useState(false);

  return (
    <Stack spacing={3}>
      <InstallStep number={1} title="Add the JobPilot plugin">
        <Tabs
          value={provider}
          onChange={(_, next: InstallProvider) => setProvider(next)}
          sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36 } }}
        >
          <Tab value="claude" label="Claude Code" />
          <Tab value="codex" label="Codex" />
        </Tabs>
        <Typography variant="body2Muted">
          {provider === "claude"
            ? "Run these in any Claude Code session - the CLI, the desktop app, or the VS Code extension."
            : "Run these in a shell where the Codex CLI is installed."}
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
            ? "In the same Claude Code session, run the setup skill. It installs and starts the local JobPilot agent for you."
            : "Start a new Codex session and run $setup. You can also find it in the /skills picker."}
        </Typography>
        <CopyField
          value={SETUP_COMMANDS[provider]}
          copyMessage="Command copied"
          ariaLabel="Copy setup command"
        />
      </InstallStep>

      <InstallStep number={3} title="Create your account">
        <Typography variant="body2Muted">
          Sign up, upload a resume, and launch the agent from the dashboard - it signs in as you
          automatically. Your first campaign is one command away.
        </Typography>
        <LinkButton href="/register" variant="contained" size="large" sx={{ alignSelf: "start" }}>
          Create account
        </LinkButton>
      </InstallStep>

      <Stack spacing={1.5}>
        <Button
          variant="text"
          size="small"
          onClick={() => setShowDirect((v) => !v)}
          endIcon={
            <ExpandMore
              sx={{
                transform: showDirect ? "rotate(180deg)" : "none",
                transition: "transform .2s",
              }}
            />
          }
          sx={{ alignSelf: "flex-start", color: "text.secondary" }}
        >
          Need to install or repair the terminal host separately?
        </Button>
        <Collapse in={showDirect}>
          <Stack spacing={1.5}>
            <Typography variant="body2Muted">
              Run the one-liner for your OS, then start <code>jobpilot</code>. This does not replace
              the JobPilot plugin required by Codex.
            </Typography>
            <HostInstallCommands />
          </Stack>
        </Collapse>
      </Stack>
    </Stack>
  );
}
