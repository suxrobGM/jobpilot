"use client";

import type { ReactElement } from "react";
import { Feedback } from "@mui/icons-material";
import { TooltipIconButton } from "@/components/ui/buttons";
import { DropdownMenu } from "@/components/ui/navigation";
import { feedbackLinks } from "./shell-config";

/** Rail icon opening a popup with GitHub bug-report / feature-request links. */
export function FeedbackMenu(): ReactElement {
  return (
    <DropdownMenu
      trigger={({ onOpen }) => (
        <TooltipIconButton
          title="Feedback"
          placement="right"
          size="small"
          onClick={onOpen}
          sx={{ color: "text.secondary" }}
        >
          <Feedback fontSize="md" />
        </TooltipIconButton>
      )}
      anchorOrigin={{ horizontal: "right", vertical: "center" }}
      transformOrigin={{ horizontal: "left", vertical: "center" }}
      items={feedbackLinks.map((link) => ({
        kind: "item",
        key: link.href,
        label: link.label,
        icon: <link.icon fontSize="md" />,
        href: link.href,
      }))}
    />
  );
}
