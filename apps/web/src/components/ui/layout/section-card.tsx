"use client";

import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import { Card, CardContent, CardHeader, Typography } from "@mui/material";

interface SectionCardProps extends PropsWithChildren {
  title?: string;
  /** A small label above the title, e.g. the metric a chart card measures. */
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  /** Stretches to its grid cell so side-by-side cards line up. */
  fullHeight?: boolean;
}

export function SectionCard(props: SectionCardProps): ReactElement {
  const { title, eyebrow, description, actions, fullHeight, children } = props;
  const heading = eyebrow ? (
    <>
      <Typography variant="overlineMuted" sx={{ display: "block", mb: 0.75 }}>
        {eyebrow}
      </Typography>
      {title}
    </>
  ) : (
    title
  );
  return (
    <Card sx={fullHeight ? { height: "100%" } : undefined}>
      {(title || actions) && (
        <CardHeader title={heading} subheader={description} action={actions} />
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
