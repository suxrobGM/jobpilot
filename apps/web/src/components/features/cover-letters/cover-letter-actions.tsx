"use client";

import type { ReactElement } from "react";
import { Delete } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import { useConfirm } from "@/providers/confirm-provider";

interface CoverLetterActionsProps {
  id: number;
}

export function CoverLetterActions(props: CoverLetterActionsProps): ReactElement {
  const { id } = props;
  const router = useRouter();
  const confirm = useConfirm();

  const remove = useApiMutation<{ ok: true }, void>(
    () => apiClient.del<{ ok: true }>(`/api/cover-letters/${id}`),
    {
      successMessage: "Cover letter deleted",
      invalidate: [queryKeys.coverLetters.all],
      onSuccess: () => router.replace("/cover-letters" as Route),
    },
  );

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "Delete cover letter?",
      description: "This permanently removes the saved cover letter.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (confirmed) {
      remove.mutate();
    }
  };

  return (
    <IconButton onClick={() => void handleDelete()} aria-label="Delete cover letter">
      <Delete fontSize="md" />
    </IconButton>
  );
}
