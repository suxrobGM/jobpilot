"use client";

import { type ReactElement, useState } from "react";
import { Stack, Typography } from "@mui/material";
import { CopyField } from "@/components/ui/display";
import { formatSkillCommand, type TerminalProviderId } from "@/lib/terminal/client";
import { HostInstallCommands } from "./host-install-commands";
import { PLUGIN_COMMANDS } from "./provider-commands";
import { ProviderTabs } from "./provider-tabs";

/** Provider tabs + plugin/setup copy commands, with a separate host repair command. */
export function PluginInstallCommands(): ReactElement {
  const [provider, setProvider] = useState<TerminalProviderId>("claude");

  return (
    <Stack spacing={2}>
      <ProviderTabs value={provider} onChange={setProvider} />
      <Stack spacing={1}>
        {[...PLUGIN_COMMANDS[provider], formatSkillCommand(provider, "setup")].map((command) => (
          <CopyField
            key={command}
            value={command}
            copyMessage="Command copied"
            ariaLabel="Copy install command"
          />
        ))}
      </Stack>
      <Typography variant="captionMuted">
        To reinstall the agent on its own, run the command for your system. Codex still needs the
        plugin.
      </Typography>
      <Stack spacing={1}>
        <HostInstallCommands />
      </Stack>
    </Stack>
  );
}
