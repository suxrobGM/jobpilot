"use client";

import type { ReactElement } from "react";
import { Delete } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { coverLetterQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { TooltipIconButton } from "@/components/ui/buttons";
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
    onSuccess: () => router.replace("/cover-letters"),
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
    <TooltipIconButton title="Delete cover letter" onClick={() => void handleDelete()}>
      <Delete fontSize="md" />
    </TooltipIconButton>
  );
}
