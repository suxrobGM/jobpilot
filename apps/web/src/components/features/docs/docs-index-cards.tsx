"use client";

import type { ReactElement } from "react";
import { Card, CardActionArea, CardContent, Grid, Stack, Typography } from "@mui/material";
import { DOCS_NAV } from "./docs-nav";

export function DocsIndexCards(): ReactElement {
  return (
    <Grid container spacing={2}>
      {DOCS_NAV.map((entry) => (
        <Grid key={entry.href} size={{ xs: 12, sm: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardActionArea href={entry.href} sx={{ height: "100%" }}>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="docsH3">{entry.title}</Typography>
                  <Typography variant="body2Muted">{entry.description}</Typography>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
