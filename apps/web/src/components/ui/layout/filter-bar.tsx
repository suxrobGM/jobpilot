"use client";

import type { PropsWithChildren, ReactElement } from "react";
import { Card, CardContent, Stack } from "@mui/material";

export function FilterBar(props: PropsWithChildren): ReactElement {
  const { children } = props;
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ flexWrap: "wrap", alignItems: "center", rowGap: 1.5 }}
        >
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}
