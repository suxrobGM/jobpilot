import type { ReactElement } from "react";
import { Close } from "@mui/icons-material";
import { DialogTitle, IconButton } from "@mui/material";

interface DialogHeaderProps {
  title: string;
  onClose: () => void;
}

/** A dialog's title with a close button, so it can be dismissed without hunting for Cancel. */
export function DialogHeader(props: DialogHeaderProps): ReactElement {
  const { title, onClose } = props;
  return (
    <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1.5 }}>
      {title}
      <IconButton aria-label="Close" size="small" onClick={onClose} sx={{ ml: "auto" }}>
        <Close fontSize="md" />
      </IconButton>
    </DialogTitle>
  );
}
