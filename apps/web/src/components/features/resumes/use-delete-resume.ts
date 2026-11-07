"use client";

import { api } from "@/api/client";
import { invalidations } from "@/api/queries";
import type { ResumeDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { useConfirm } from "@/providers/confirm-provider";

type DeletableResume = Pick<ResumeDto, "id" | "label">;

interface DeleteResume {
  /** Asks first; the resume and every variant go with it. */
  request: (resume: DeletableResume) => Promise<void>;
  isPending: boolean;
}

export function useDeleteResume(onDeleted?: () => void): DeleteResume {
  const confirm = useConfirm();
  const remove = useApiMutation((id: string) => api.resumes({ id }).delete(), {
    successMessage: "Resume deleted",
    invalidate: invalidations.resume,
    onSuccess: () => onDeleted?.(),
  });

  const request = async (resume: DeletableResume): Promise<void> => {
    const confirmed = await confirm({
      title: "Delete resume?",
      description: `Remove "${resume.label}" and all its variants? This cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (confirmed) {
      remove.mutate(resume.id);
    }
  };

  return { request, isPending: remove.isPending };
}
