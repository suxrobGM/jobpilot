import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";
import { CopyField } from "@/components/ui/display";
import { orderedInstallCommands } from "./install-commands";

/** Labeled copy fields for the per-OS direct host-install one-liners. Renders as flex children. */
export function HostInstallCommands(): ReactElement {
  return (
    <>
      {orderedInstallCommands().map(({ label, command }) => (
        <Stack key={label} spacing={0.5}>
          <Typography variant="captionMuted">{label}</Typography>
          <CopyField
            value={command}
            copyMessage="Command copied"
            ariaLabel={`Copy ${label} command`}
          />
        </Stack>
      ))}
    </>
  );
}
