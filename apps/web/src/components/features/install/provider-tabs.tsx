"use client";

import type { ReactElement } from "react";
import { Tab, Tabs } from "@mui/material";
import { providerDisplayName, type TerminalProviderId } from "@/lib/terminal/client";

const PROVIDERS: TerminalProviderId[] = ["claude", "codex"];

interface ProviderTabsProps {
  value: TerminalProviderId;
  onChange: (provider: TerminalProviderId) => void;
}

export function ProviderTabs(props: ProviderTabsProps): ReactElement {
  const { value, onChange } = props;
  return (
    <Tabs value={value} onChange={(_, next: TerminalProviderId) => onChange(next)}>
      {PROVIDERS.map((provider) => (
        <Tab key={provider} value={provider} label={providerDisplayName(provider)} />
      ))}
    </Tabs>
  );
}
