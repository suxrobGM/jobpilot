"use client";

import type { ReactElement } from "react";
import { Button, Stack, Typography } from "@mui/material";
import { StickyFooter } from "@/components/ui/layout";
import { useFormContext } from "./form-context";
import { SubmitButton } from "./submit-button";

interface UnsavedChangesBarProps {
  saveLabel?: string;
}

/** Shown only while the form differs from its defaults; re-baseline them with `form.reset(value)` after saving. */
export function UnsavedChangesBar(props: UnsavedChangesBarProps): ReactElement {
  const { saveLabel = "Save changes" } = props;
  const form = useFormContext();

  return (
    <form.Subscribe selector={(state) => !state.isDefaultValue || state.isSubmitting}>
      {(visible) =>
        visible && (
          <StickyFooter>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ justifyContent: "flex-end", alignItems: "center" }}
            >
              <Typography variant="captionMuted" sx={{ flex: 1 }}>
                Unsaved changes
              </Typography>
              <Button color="inherit" onClick={() => form.reset()}>
                Discard
              </Button>
              <SubmitButton>{saveLabel}</SubmitButton>
            </Stack>
          </StickyFooter>
        )
      }
    </form.Subscribe>
  );
}
