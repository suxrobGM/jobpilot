"use client";

import type { ReactElement } from "react";
import { SearchField } from "@/components/ui/form";
import { usePaginationParams } from "@/hooks/use-pagination";
import { useUrlSearch } from "@/hooks/use-url-search";

interface AdminSearchFieldProps {
  placeholder: string;
}

/** The debounced draft lands in `?q=`, which re-runs the page's server fetch. */
export function AdminSearchField(props: AdminSearchFieldProps): ReactElement {
  const { placeholder } = props;
  // The admin tables are RSC pages, so the param has to be written as a real navigation.
  const search = useUrlSearch("q", usePaginationParams({ navigate: true }));
  return <SearchField value={search.draft} placeholder={placeholder} onChange={search.setDraft} />;
}
