"use client";

import { useState } from "react";
import type { ListSelection, RowSelection } from "@/components/ui/data";

interface Identified {
  id: string;
}

interface RowSelectionState<T> {
  /** Rows that left the page after a refetch drop out. */
  picked: T[];
  header: ListSelection;
  row: (row: T, label: string) => RowSelection;
  clear: () => void;
}

export function useRowSelection<T extends Identified>(rows: T[]): RowSelectionState<T> {
  const [ids, setIds] = useState<string[]>([]);
  const picked = rows.filter((row) => ids.includes(row.id));
  const allPicked = rows.length > 0 && picked.length === rows.length;

  return {
    picked,
    header: {
      count: picked.length,
      total: rows.length,
      onToggleAll: () => setIds(allPicked ? [] : rows.map((row) => row.id)),
    },
    row: (row, label) => ({
      selected: ids.includes(row.id),
      onToggle: () =>
        setIds(ids.includes(row.id) ? ids.filter((id) => id !== row.id) : [...ids, row.id]),
      label,
    }),
    clear: () => setIds([]),
  };
}
