import type { ReactElement } from "react";
import { Card, CardContent } from "@mui/material";

interface SettingsCardProps {
  children: ReactElement;
}

/** The sections carry their own headings, since onboarding shows them without a card. */
export function SettingsCard(props: SettingsCardProps): ReactElement {
  const { children } = props;
  return (
    <Card>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
