"use client";

import type { ReactElement } from "react";
import type { AdminJobListingPatch } from "@jobpilot/contracts/job-listing";
import { Delete, MoreVert, Visibility, VisibilityOff } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import type { AdminJobListingDto } from "@/api/types";
import { DropdownMenu } from "@/components/ui/feedback";
import { useConfirm } from "@/providers/confirm-provider";

interface AdminListingActionsProps {
  listing: AdminJobListingDto;
}

/** Moderation for one listing: hide it from the public index, or drop it entirely. */
export function AdminListingActions(props: AdminListingActionsProps): ReactElement {
  const { listing } = props;
  const router = useRouter();
  const confirm = useConfirm();
  const hidden = listing.status === "hidden";

  const update = useApiMutation<AdminJobListingDto, AdminJobListingPatch>(
    (patch) => api.admin.listings({ id: listing.id }).patch(patch),
    {
      successMessage: hidden ? "Listing published" : "Listing hidden",
      onSuccess: () => router.refresh(),
    },
  );

  const remove = useApiMutation<{ deleted: string }, void>(
    () => api.admin.listings({ id: listing.id }).delete(),
    { successMessage: "Listing deleted", onSuccess: () => router.refresh() },
  );

  const handleDelete = async (): Promise<void> => {
    const confirmed = await confirm({
      title: "Delete listing?",
      description: `"${listing.title}" at ${listing.company} is removed along with its ${listing.sourceCount} source link(s). A later scrape of the same posting will recreate it - hide it instead if you want it gone for good.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (confirmed) {
      remove.mutate();
    }
  };

  return (
    <DropdownMenu
      trigger={({ onOpen }) => (
        <IconButton onClick={onOpen} aria-label="Listing actions">
          <MoreVert fontSize="md" />
        </IconButton>
      )}
      items={[
        {
          kind: "item",
          key: "toggle-status",
          label: hidden ? "Publish" : "Hide",
          icon: hidden ? <Visibility fontSize="sm" /> : <VisibilityOff fontSize="sm" />,
          onClick: () => update.mutate({ status: hidden ? "published" : "hidden" }),
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
  );
}
