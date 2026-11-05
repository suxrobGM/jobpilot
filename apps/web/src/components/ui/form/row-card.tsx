import type { ReactElement, ReactNode } from "react";
import { Card, CardContent, CardHeader, Typography } from "@mui/material";

interface RowCardProps {
  title: string;
  /** Remove / reorder controls, top right. */
  actions: ReactNode;
  children: ReactNode;
}

/** One row of a repeatable group (a reference, a resume entry, a platform). */
export function RowCard(props: RowCardProps): ReactElement {
  const { title, actions, children } = props;
  return (
    <Card>
      <CardHeader
        title={<Typography variant="overlineMuted">{title}</Typography>}
        action={actions}
      />
      <CardContent>{children}</CardContent>
    </Card>
  );
}
