"use client";

import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@mui/material";

interface SectionCardProps extends PropsWithChildren {
  title?: string;
  description?: string;
  actions?: ReactNode;
}

export function SectionCard(props: SectionCardProps): ReactElement {
  const { title, description, actions, children } = props;
  return (
    <Card>
      {(title || actions) && <CardHeader title={title} subheader={description} action={actions} />}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
