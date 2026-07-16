"use client";

import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@mui/material";

interface SectionCardProps extends PropsWithChildren {
  title?: string;
  description?: string;
  actions?: ReactNode;
  /** Fill the parent's height so cards in a stretched grid row match the tallest. */
  fullHeight?: boolean;
}

export function SectionCard(props: SectionCardProps): ReactElement {
  const { title, description, actions, fullHeight, children } = props;
  return (
    <Card sx={fullHeight ? { height: "100%" } : undefined}>
      {(title || actions) && <CardHeader title={title} subheader={description} action={actions} />}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
