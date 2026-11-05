"use client";

import type { ReactElement } from "react";
import {
  type JobListingSort,
  jobListingPostedSchema,
  jobListingSortSchema,
} from "@jobpilot/contracts/job-listing";
import { MenuItem, Stack, TextField } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import type { SelectFieldOption } from "@/components/ui/form";
import { POSTED_OPTIONS } from "./job-filter-options";
import { jobsHrefWith } from "./jobs-href";

const SORT_OPTIONS: SelectFieldOption<JobListingSort>[] = [
  { value: "recent", label: "Recently seen" },
  { value: "newest", label: "Newest" },
];

/** `jobsHrefWith` drops `page`, so a change always lands on page 1. */
export function JobSortControls(): ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  // A hand-edited `?sort=junk` reads as the default rather than a blank select.
  const sort = jobListingSortSchema.catch("recent").parse(params.get("sort"));
  const posted = jobListingPostedSchema.nullable().catch(null).parse(params.get("posted"));

  const set = (key: string, value: string | null): void => {
    router.push(jobsHrefWith(params, { [key]: value }));
  };

  // Not SelectField: its empty "All" option hides the label, and these must always show theirs.
  return (
    <Stack direction="row" spacing={1.5}>
      <TextField
        select
        size="small"
        label="Posted"
        value={posted ?? ""}
        onChange={(event) => set("posted", event.target.value || null)}
        slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
        sx={{ minWidth: 140, flex: { xs: 1, sm: "none" } }}
      >
        <MenuItem value="">Any time</MenuItem>
        {POSTED_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        label="Sort by"
        value={sort}
        onChange={(event) =>
          set("sort", event.target.value === "recent" ? null : event.target.value)
        }
        sx={{ minWidth: 150, flex: { xs: 1, sm: "none" } }}
      >
        {SORT_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
