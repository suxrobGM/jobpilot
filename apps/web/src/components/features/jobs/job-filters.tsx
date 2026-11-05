"use client";

import { type ReactElement, type SubmitEvent, useRef } from "react";
import { parseTechParam, serializeTechParam } from "@jobpilot/contracts/job-listing";
import { Button, Card, CardContent, Stack, TextField, ToggleButton } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { MultiSelect } from "@/components/ui/form";
import { ActiveFilters } from "./active-filters";
import { jobsHref } from "./jobs-href";

interface JobFiltersProps {
  /** The skills the index actually contains, most common first. */
  skillOptions: string[];
}

/**
 * Filters navigate to a real `/jobs?q=…` URL rather than holding client state, so results stay
 * shareable and crawlable.
 */
export function JobFilters(props: JobFiltersProps): ReactElement {
  const { skillOptions } = props;
  const router = useRouter();
  const params = useSearchParams();
  const form = useRef<HTMLFormElement>(null);

  const remote = params.get("remote") === "true";
  // The public param stays `?tech=` so links shared before the skills rename keep working.
  const skills = parseTechParam(params.get("tech"));

  // Reads the live form, not just `params`, so unsubmitted text survives a Remote toggle.
  const apply = (patch: Record<string, string | null> = {}): void => {
    const next = new URLSearchParams(params);
    const data = form.current ? new FormData(form.current) : null;

    for (const key of ["q", "location"] as const) {
      patch[key] ??= String(data?.get(key) ?? "").trim() || null;
    }
    for (const [key, value] of Object.entries(patch)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    router.push(jobsHref(next));
  };

  const onSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    apply();
  };

  return (
    <Card>
      <CardContent component="form" ref={form} onSubmit={onSubmit}>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{ alignItems: { xs: "stretch", md: "center" } }}
          >
            <TextField
              name="q"
              placeholder="Title or company"
              defaultValue={params.get("q") ?? ""}
              sx={{ flex: 1 }}
            />
            <TextField
              name="location"
              placeholder="Location"
              defaultValue={params.get("location") ?? ""}
              sx={{ flex: 1 }}
            />
            <MultiSelect
              value={skills}
              onChange={(values) =>
                apply({ tech: values.length > 0 ? serializeTechParam(values) : null })
              }
              options={skillOptions}
              freeSolo={false}
              placeholder={skills.length > 0 ? undefined : "Skills"}
              sx={{ flex: 1, minWidth: 180 }}
            />
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <ToggleButton
                value="remote"
                selected={remote}
                onChange={() => apply({ remote: remote ? null : "true" })}
                sx={{ flex: { xs: 1, md: "none" } }}
              >
                Remote
              </ToggleButton>
              <Button type="submit" variant="contained" sx={{ flex: { xs: 1, md: "none" } }}>
                Search
              </Button>
            </Stack>
          </Stack>
          <ActiveFilters />
        </Stack>
      </CardContent>
    </Card>
  );
}
