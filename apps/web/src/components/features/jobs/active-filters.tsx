"use client";

import type { ReactNode } from "react";
import { Button, Chip, Stack } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { POSTED_OPTIONS } from "./job-sort-controls";
import { jobsHref } from "./jobs-href";

/** No `tech`: the multi-select already shows it as chips. */
const CHIPPED = ["q", "location", "board", "remote", "posted"] as const;

type ChippedKey = (typeof CHIPPED)[number];

function chipLabel(key: ChippedKey, value: string): string {
  if (key === "remote") {
    return "Remote";
  }
  if (key === "posted") {
    return POSTED_OPTIONS.find((option) => option.value === value)?.label ?? value;
  }
  return value;
}

export function ActiveFilters(): ReactNode {
  const router = useRouter();
  const params = useSearchParams();

  const applied = CHIPPED.flatMap((key) => {
    const value = params.get(key);
    return value ? [{ key, label: chipLabel(key, value) }] : [];
  });

  // Sort is an ordering, not a filter, so it alone does not offer "Clear all".
  const dirty = [...params.keys()].some((key) => key !== "page" && key !== "sort");
  if (!dirty) {
    return null;
  }

  const drop = (key: string): void => {
    const next = new URLSearchParams(params);
    next.delete(key);
    router.push(jobsHref(next));
  };

  return (
    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}>
      {applied.map((filter) => (
        <Chip
          key={filter.key}
          label={filter.label}
          variant="outlined"
          onDelete={() => drop(filter.key)}
        />
      ))}
      <Button variant="text" size="small" href="/jobs">
        Clear all
      </Button>
    </Stack>
  );
}
