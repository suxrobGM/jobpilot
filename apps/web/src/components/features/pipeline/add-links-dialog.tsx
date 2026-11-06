"use client";

import { type ReactElement, useState } from "react";
import { MAX_LINKS } from "@jobpilot/contracts/feed";
import { Button, TextField } from "@mui/material";
import { FormDialogShell } from "@/components/ui/form";
import { plural } from "@/utils/format";
import { parseLinks, useAddLinks } from "./use-add-links";

interface AddLinksDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AddLinksDialog(props: AddLinksDialogProps): ReactElement {
  const { open, onClose } = props;
  const [text, setText] = useState("");
  const links = parseLinks(text);

  const add = useAddLinks(() => {
    setText("");
    onClose();
  });

  const tooMany = links.length > MAX_LINKS;
  return (
    <FormDialogShell
      open={open}
      title="Add job links"
      maxWidth="sm"
      onClose={onClose}
      onSubmit={() => add.mutate(links)}
      submit={
        <Button
          type="submit"
          variant="contained"
          disabled={links.length === 0 || tooMany}
          loading={add.isPending}
        >
          {links.length > 0 ? `Add ${plural(links.length, "link")}` : "Add"}
        </Button>
      }
    >
      <TextField
        autoFocus
        multiline
        minRows={4}
        fullWidth
        label="Job links"
        placeholder="One posting URL per line"
        value={text}
        onChange={(event) => setText(event.target.value)}
        error={tooMany}
        helperText={
          tooMany
            ? `At most ${MAX_LINKS} links at a time.`
            : "The pilot opens each one, scores it against your resume, and applies to the ones that fit."
        }
      />
    </FormDialogShell>
  );
}
