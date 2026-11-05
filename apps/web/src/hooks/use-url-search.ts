"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { PaginationParams } from "@/hooks/use-pagination";

const DEBOUNCE_MS = 300;

interface UrlSearch {
  /** What the box shows, ahead of the URL while the user types. */
  draft: string;
  setDraft: (value: string) => void;
  /** The term in the URL, which the query reads. */
  applied: string;
}

/** A search box whose debounced term lives in `?key=`, so a refresh or a shared link keeps it. */
export function useUrlSearch(key: string, pagination: PaginationParams): UrlSearch {
  const applied = useSearchParams().get(key) ?? "";
  const [draft, setDraft] = useState(applied);
  const term = useDebouncedValue(draft.trim(), DEBOUNCE_MS);
  const { setFilters } = pagination;

  useEffect(() => {
    if (term !== applied) {
      setFilters({ [key]: term || null });
    }
  }, [term, applied, key, setFilters]);

  return { draft, setDraft, applied };
}
