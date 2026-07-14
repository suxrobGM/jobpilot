"use client";

import {
  createContext,
  type PropsWithChildren,
  type ReactElement,
  useContext,
  useState,
} from "react";
import type { AddQueueEntry } from "@jobpilot/contracts/queue";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { invalidations } from "@/api/query-keys";
import { AddUrlsDialog } from "./dialogs/add-urls-dialog";

interface AddUrlsResponse {
  inserted: number;
}

export interface WorkspaceActionsValue {
  openAddUrls: () => void;
}

const WorkspaceActionsContext = createContext<WorkspaceActionsValue | null>(null);

export function WorkspaceActionsProvider(props: PropsWithChildren): ReactElement {
  const { children } = props;
  const [addUrlsOpen, setAddUrlsOpen] = useState(false);

  const create = useApiMutation<AddUrlsResponse, AddQueueEntry>((vars) => api.queue.post(vars), {
    successMessage: (data) => `Queued ${data.inserted} URL${data.inserted === 1 ? "" : "s"}`,
    invalidate: invalidations.queue,
    onSuccess: () => setAddUrlsOpen(false),
  });

  const value: WorkspaceActionsValue = {
    openAddUrls: () => setAddUrlsOpen(true),
  };

  return (
    <WorkspaceActionsContext.Provider value={value}>
      {children}
      <AddUrlsDialog
        key={addUrlsOpen ? "open" : "closed"}
        open={addUrlsOpen}
        onClose={() => setAddUrlsOpen(false)}
        onSubmit={(values) => create.mutate(values)}
        submitting={create.isPending}
      />
    </WorkspaceActionsContext.Provider>
  );
}

export function useWorkspaceActions(): WorkspaceActionsValue {
  const ctx = useContext(WorkspaceActionsContext);
  if (!ctx) {
    throw new Error("useWorkspaceActions must be used within a WorkspaceActionsProvider");
  }
  return ctx;
}
