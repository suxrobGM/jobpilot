"use client";

import type { ReactElement } from "react";
import type { PortfolioProject } from "@jobpilot/contracts/upwork";
import { Launch } from "@mui/icons-material";
import { Box, Chip, Link, List, Stack, Typography } from "@mui/material";
import { ItemRow } from "@/components/ui/display";

interface PortfolioListProps {
  items: PortfolioProject[];
}

/** Read-only list of portfolio projects (title, description, link, skill chips). */
export function PortfolioList(props: PortfolioListProps): ReactElement {
  const { items } = props;
  if (items.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: "text.disabled" }}>
        -
      </Typography>
    );
  }
  return (
    <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {items.map((p) => (
        <ItemRow
          key={p.title}
          primary={
            <Typography variant="body2Strong" noWrap>
              {p.title}
            </Typography>
          }
          secondary={
            (p.description || (p.skills && p.skills.length > 0)) && (
              <Stack spacing={1} sx={{ mt: 0.5 }}>
                {p.description && <Box>{p.description}</Box>}
                {p.skills && p.skills.length > 0 && (
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                    {p.skills.map((s) => (
                      <Chip key={s} size="small" label={s} variant="outlined" />
                    ))}
                  </Stack>
                )}
              </Stack>
            )
          }
          action={
            p.url && (
              <Link href={p.url} target="_blank" rel="noopener noreferrer">
                <Launch fontSize="sm" />
              </Link>
            )
          }
        />
      ))}
    </List>
  );
}
