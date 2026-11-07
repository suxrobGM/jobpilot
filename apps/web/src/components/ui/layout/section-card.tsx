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
  // The eyebrow sits outside the title's text, or it inherits the display face's width.
  const heading = eyebrow ? (
    <>
      <Typography variant="overlineMuted" sx={{ display: "block", mb: 0.75 }}>
        {eyebrow}
      </Typography>
      <Typography variant="h4">{title}</Typography>
    </>
  ) : (
    title
  );
  return (
    <Card sx={fullHeight ? { height: "100%" } : undefined}>
      {(title || actions) && (
        <CardHeader
          title={heading}
          subheader={description}
          action={actions}
          disableTypography={Boolean(eyebrow)}
        />
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
