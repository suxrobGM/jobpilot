"use client";

import type { ReactElement } from "react";
import { Launch } from "@mui/icons-material";
import { Box, Chip, Link, Stack, Typography } from "@mui/material";
import type { PortfolioProject } from "@/api/contracts/upwork";

interface PortfolioListProps {
  items: PortfolioProject[];
}

/** Read-only list of portfolio projects (title, description, link, skill chips). */
export function PortfolioList(props: PortfolioListProps): ReactElement {
  const { items } = props;
  if (items.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: "text.disabled" }}>
        —
      </Typography>
    );
  }
  return (
    <Stack spacing={1}>
      {items.map((p, i) => (
        <Box
          key={`${p.title}-${i}`}
          sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }} noWrap>
              {p.title}
            </Typography>
            {p.url && (
              <Link href={p.url} target="_blank" rel="noopener noreferrer">
                <Launch fontSize="sm" />
              </Link>
            )}
          </Stack>
          {p.description && (
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              {p.description}
            </Typography>
          )}
          {p.skills && p.skills.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5, mt: 1 }}>
              {p.skills.map((s) => (
                <Chip key={s} size="small" label={s} variant="outlined" />
              ))}
            </Stack>
          )}
        </Box>
      ))}
    </Stack>
  );
}
