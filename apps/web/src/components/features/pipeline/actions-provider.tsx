"use client";

import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
  type ReactElement,
} from "react";
import type { AddQueueEntry } from "@jobpilot/contracts/queue";
import { api } from "@/api/eden";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import { AddUrlsDialog } from "./dialogs/add-urls-dialog";

interface AddUrlsResponse {
  inserted: number;
}

export interface PipelineActionsValue {
  openAddUrls: () => void;
}

const PipelineActionsContext = createContext<PipelineActionsValue | null>(null);

export function PipelineActionsProvider(props: PropsWithChildren): ReactElement {
  const { children } = props;
  const [addUrlsOpen, setAddUrlsOpen] = useState(false);

  const create = useApiMutation<AddUrlsResponse, AddQueueEntry>((vars) => api.queue.post(vars), {
    successMessage: (data) => `Queued ${data.inserted} URL${data.inserted === 1 ? "" : "s"}`,
    invalidate: [queryKeys.queue.all, queryKeys.pipeline.all],
    onSuccess: () => setAddUrlsOpen(false),
  });

  const value: PipelineActionsValue = {
    openAddUrls: () => setAddUrlsOpen(true),
  };

  return (
    <PipelineActionsContext.Provider value={value}>
      {children}
      <AddUrlsDialog
        key={addUrlsOpen ? "open" : "closed"}
        open={addUrlsOpen}
        onClose={() => setAddUrlsOpen(false)}
        onSubmit={(values) => create.mutate(values)}
        submitting={create.isPending}
      />
    </PipelineActionsContext.Provider>
  );
}

export function usePipelineActions(): PipelineActionsValue {
  const ctx = useContext(PipelineActionsContext);
  if (!ctx) {
    throw new Error("usePipelineActions must be used within a PipelineActionsProvider");
  }
  return ctx;
}
