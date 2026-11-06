"use client";

import { type ReactElement, useState } from "react";
import { MAX_LINKS } from "@jobpilot/contracts/feed";
import { Button, TextField } from "@mui/material";
import { api } from "@/api/client";
import { pipelineQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { FormDialogShell } from "@/components/ui/form";
import { plural } from "@/utils/format";

/** Whitespace- or comma-separated links; anything that isn't one is dropped. */
function parseLinks(text: string): string[] {
  return text.split(/[\s,]+/).filter((part) => URL.canParse(part) && /^https?:/.test(part));
}

interface AddLinksDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AddLinksDialog(props: AddLinksDialogProps): ReactElement {
  const { open, onClose } = props;
  const [text, setText] = useState("");
  const links = parseLinks(text);

  const add = useApiMutation(() => api.pipeline.links.post({ urls: links }), {
    invalidate: [pipelineQueries.all],
    successMessage: ({ added, duplicates }) => {
      const already =
        duplicates.length > 0 ? ` · ${duplicates.length} already in your pipeline` : "";
      return `Added ${plural(added, "link")}${already}. The pilot scores them next.`;
    },
    onSuccess: () => {
      setText("");
      onClose();
    },
  });

  const tooMany = links.length > MAX_LINKS;
  return (
    <FormDialogShell
      open={open}
      title="Add job links"
      maxWidth="sm"
      onClose={onClose}
      onSubmit={() => add.mutate()}
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
