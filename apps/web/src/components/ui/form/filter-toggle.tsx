"use client";

import type { ReactElement } from "react";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import type { SelectFieldOption } from "./select-field";

// ToggleButtonGroup reports a click on the selected button as null, so "All" needs its own value.
const ALL = "";

interface FilterToggleProps<TValue extends string> {
  /** Names the group for screen readers. */
  label: string;
  value: TValue | null;
  options: ReadonlyArray<SelectFieldOption<TValue>>;
  allLabel?: string;
  onChange: (value: TValue | null) => void;
}

/** A filter over a few known values (2-4); SelectField takes over beyond that. */
export function FilterToggle<TValue extends string>(
  props: FilterToggleProps<TValue>,
): ReactElement {
  const { label, value, options, allLabel = "All", onChange } = props;
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      aria-label={label}
      value={value ?? ALL}
      onChange={(_, next: string | null) => {
        if (next !== null) {
          onChange(next === ALL ? null : (next as TValue));
        }
      }}
      sx={{ flexWrap: "wrap" }}
    >
      <ToggleButton value={ALL}>{allLabel}</ToggleButton>
      {options.map((option) => (
        <ToggleButton key={option.value} value={option.value}>
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
