"use client";

import { type ReactElement, useState } from "react";
import { Delete, Edit } from "@mui/icons-material";
import { Box, Button, Divider, Stack, TextField, Typography } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import type { SavedAnswerDto } from "@/api/types";
import { TooltipIconButton } from "@/components/ui/buttons";
import { EmptyState, QuerySection } from "@/components/ui/data";
import { FormDialogShell, FormSection } from "@/components/ui/form";
import { useConfirm } from "@/providers/confirm-provider";
import { formatRelativeTime } from "@/utils/format";

/** `start_date` → "Start date". */
function answerLabel(key: string): string {
  const words = key.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function SavedAnswersSection(): ReactElement {
  const confirm = useConfirm();
  const [editing, setEditing] = useState<SavedAnswerDto | null>(null);

  const query = useApiQuery(pilotQueries.savedAnswers(), {
    errorMessage: "Failed to load saved answers",
  });

  const save = useApiMutation(
    ({ key, value }: Pick<SavedAnswerDto, "key" | "value">) =>
      api.pilot["saved-answers"]({ key }).put({ value }),
    {
      invalidate: [queryKeys.pilot.savedAnswers()],
      successMessage: "Answer saved.",
      onSuccess: () => setEditing(null),
    },
  );

  const remove = useApiMutation((key: string) => api.pilot["saved-answers"]({ key }).delete(), {
    invalidate: [queryKeys.pilot.savedAnswers()],
    successMessage: "Answer deleted.",
  });

  const handleDelete = async (answer: SavedAnswerDto): Promise<void> => {
    const confirmed = await confirm({
      title: "Delete saved answer?",
      description: `You'll be asked about "${answerLabel(answer.key)}" again the next time a form needs it.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (confirmed) {
      remove.mutate(answer.key);
    }
  };

  const answers = query.data ?? [];

  return (
    <FormSection
      title="Saved answers"
      description="Answers to application questions that come up again, like start date or relocation. Applications fill them in instead of asking you. Edits save right away."
    >
      <QuerySection
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        errorTitle="Couldn't load saved answers."
        isEmpty={answers.length === 0}
        empty={
          <EmptyState
            variant="inline"
            title="None yet. When an application asks you something that fits other jobs, your answer is saved here."
          />
        }
      >
        <Stack spacing={1.5} divider={<Divider />}>
          {answers.map((answer) => (
            <AnswerRow
              key={answer.key}
              answer={answer}
              onEdit={() => setEditing(answer)}
              onDelete={() => void handleDelete(answer)}
            />
          ))}
        </Stack>
      </QuerySection>

      {editing && (
        <EditAnswerDialog
          answer={editing}
          saving={save.isPending}
          onSave={(value) => save.mutate({ key: editing.key, value })}
          onClose={() => setEditing(null)}
        />
      )}
    </FormSection>
  );
}

interface AnswerRowProps {
  answer: SavedAnswerDto;
  onEdit: () => void;
  onDelete: () => void;
}

function AnswerRow(props: AnswerRowProps): ReactElement {
  const { answer, onEdit, onDelete } = props;
  const label = answerLabel(answer.key);

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2Strong">{label}</Typography>
        <Typography variant="body2" sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
          {answer.value}
        </Typography>
        <Typography variant="captionMuted" sx={{ display: "block", mt: 0.5 }}>
          Updated {formatRelativeTime(answer.updatedAt)} ago
        </Typography>
      </Box>
      <TooltipIconButton title="Edit" aria-label={`Edit ${label}`} size="small" onClick={onEdit}>
        <Edit fontSize="sm" />
      </TooltipIconButton>
      <TooltipIconButton
        title="Delete"
        aria-label={`Delete ${label}`}
        size="small"
        onClick={onDelete}
      >
        <Delete fontSize="sm" />
      </TooltipIconButton>
    </Stack>
  );
}

interface EditAnswerDialogProps {
  answer: SavedAnswerDto;
  saving: boolean;
  onSave: (value: string) => void;
  onClose: () => void;
}

function EditAnswerDialog(props: EditAnswerDialogProps): ReactElement {
  const { answer, saving, onSave, onClose } = props;
  const [value, setValue] = useState(answer.value);

  return (
    <FormDialogShell
      open
      title="Edit saved answer"
      onClose={onClose}
      onSubmit={() => onSave(value.trim())}
      maxWidth="xs"
      submit={
        <Button type="submit" variant="contained" disabled={!value.trim() || saving}>
          Save
        </Button>
      }
    >
      <TextField
        label={answerLabel(answer.key)}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        fullWidth
        multiline
        minRows={2}
      />
    </FormDialogShell>
  );
}
