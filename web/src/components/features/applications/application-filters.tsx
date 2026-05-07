"use client";

import type { ReactElement } from "react";
import { TextField } from "@mui/material";
import { SelectFilter } from "@/components/ui/form/select-filter";
import { FilterBar } from "@/components/ui/layout/filter-bar";
import {
  APPLICATION_SOURCES,
  STAGES,
  type ApplicationSource,
  type Stage,
} from "@/lib/schemas/application";
import type { ApplicationListFilters } from "@/types/api";

const STAGE_LABEL: Record<Stage, string> = {
  applied: "Applied",
  recruiter_screen: "Recruiter screen",
  assessment: "Assessment",
  hiring_manager_screen: "HM screen",
  technical_interview: "Technical",
  onsite: "Onsite",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const STAGE_OPTIONS = STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }));
const SOURCE_OPTIONS = APPLICATION_SOURCES.map((s) => ({ value: s, label: s }));

interface ApplicationFiltersProps {
  filters: ApplicationListFilters;
  boards: ReadonlyArray<string>;
  onChange: (next: ApplicationListFilters) => void;
}

export function ApplicationFilters(props: ApplicationFiltersProps): ReactElement {
  const { filters, boards, onChange } = props;
  return (
    <FilterBar>
      <TextField
        size="small"
        label="Search"
        value={filters.search ?? ""}
        onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
        sx={{ minWidth: 220 }}
      />
      <SelectFilter<Stage>
        label="Stage"
        value={filters.stage}
        options={STAGE_OPTIONS}
        onChange={(stage) => onChange({ ...filters, stage })}
      />
      <SelectFilter
        label="Board"
        value={filters.board}
        options={boards.map((b) => ({ value: b, label: b }))}
        onChange={(board) => onChange({ ...filters, board })}
      />
      <SelectFilter<ApplicationSource>
        label="Source"
        value={filters.source}
        options={SOURCE_OPTIONS}
        onChange={(source) => onChange({ ...filters, source })}
      />
    </FilterBar>
  );
}
