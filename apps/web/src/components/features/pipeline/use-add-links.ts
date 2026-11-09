"use client";

import { api } from "@/api/client";
import { pipelineQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { plural } from "@/utils/format";

/** Whitespace- or comma-separated links, deduped; anything that isn't one is dropped. */
export function parseLinks(text: string): string[] {
  const parts = text.split(/[\s,]+/).filter((part) => /^https?:/.test(part) && URL.canParse(part));
  return [...new Set(parts)];
}

/** Pasted postings go to the pipeline unscored; the pilot scores them next. */
export function useAddLinks(onSuccess: () => void) {
  return useApiMutation((urls: string[]) => api.pipeline.links.post({ urls }), {
    invalidate: [pipelineQueries.all],
    successMessage: ({ added, duplicates }) => {
      const already =
        duplicates.length > 0 ? ` · ${duplicates.length} already in your pipeline` : "";
      return `Added ${plural(added, "link")}${already}. The pilot scores them next.`;
    },
    onSuccess,
  });
}
