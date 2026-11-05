"use client";

import type { ReactElement } from "react";
import { Delete } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { coverLetterQueries } from "@/api/queries";
import { useConfirm } from "@/providers/confirm-provider";

interface CoverLetterActionsProps {
  id: string;
}

export function CoverLetterActions(props: CoverLetterActionsProps): ReactElement {
  const { id } = props;
  const router = useRouter();
  const confirm = useConfirm();

  const remove = useApiMutation(() => api["cover-letters"]({ id }).delete(), {
    successMessage: "Cover letter deleted",
    invalidate: [coverLetterQueries.all],
    onSuccess: () => router.replace("/documents/cover-letters" as Route),
  });

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
