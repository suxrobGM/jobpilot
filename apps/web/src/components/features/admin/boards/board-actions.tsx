"use client";

import { type ReactElement, useState } from "react";
import type { AdminBoardInput, AdminBoardPatch } from "@jobpilot/contracts/job-board";
import { Delete, Edit, MoreVert } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import type { AdminBoardDto } from "@/api/types";
import { DropdownMenu } from "@/components/ui/feedback";
import { useConfirm } from "@/providers/confirm-provider";
import { AdminBoardFormDialog } from "./board-form-dialog";

interface AdminBoardActionsProps {
  board: AdminBoardDto;
}

/** The one interactive cell of the catalog table: edit, list/unlist, delete. */
export function AdminBoardActions(props: AdminBoardActionsProps): ReactElement {
  const { board } = props;
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const confirm = useConfirm();

  const update = useApiMutation<AdminBoardDto, AdminBoardPatch>(
    (patch) => api.admin.boards({ id: board.id }).patch(patch),
    {
      successMessage: "Board updated",
      onSuccess: () => {
        setEditing(false);
        router.refresh();
      },
    },
  );

  const remove = useApiMutation<{ deleted: string }, void>(
    () => api.admin.boards({ id: board.id }).delete(),
    { successMessage: "Board removed", onSuccess: () => router.refresh() },
  );

  const handleDelete = async (): Promise<void> => {
    const confirmed = await confirm({
      title: "Delete board?",
      description: `"${board.name}" disappears from the catalog and is unlinked from the ${board.adoption} account(s) using it, along with their saved credentials for it.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (confirmed) {
      remove.mutate();
    }
  };

  return (
    <>
      <DropdownMenu
        trigger={({ onOpen }) => (
          <IconButton onClick={onOpen} aria-label="Board actions">
            <MoreVert fontSize="md" />
          </IconButton>
        )}
        items={[
          {
            kind: "item",
            key: "edit",
            label: "Edit",
            icon: <Edit fontSize="sm" />,
            onClick: () => setEditing(true),
          },
          {
            kind: "item",
            key: "toggle-listed",
            label: board.listed ? "Unlist" : "List",
            onClick: () => update.mutate({ listed: !board.listed }),
          },
          {
            kind: "item",
            key: "delete",
            label: "Delete",
            icon: <Delete fontSize="sm" />,
            danger: true,
            onClick: () => void handleDelete(),
          },
        ]}
      />

      <AdminBoardFormDialog
        open={editing}
        initial={{
          name: board.name,
          domain: board.domain,
          searchUrl: board.searchUrl ?? "",
          listed: board.listed,
          isDefault: board.isDefault,
          sortOrder: board.sortOrder,
        }}
        title="Edit catalog board"
        onClose={() => setEditing(false)}
        onSubmit={(values: AdminBoardInput) => update.mutate(values)}
        submitting={update.isPending}
      />
    </>
  );
}
