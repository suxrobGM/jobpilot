"use client";

import type { ReactElement } from "react";
import { z } from "zod/v4";
import { api } from "@/api/client";
import { credentialQueries } from "@/api/queries";
import type { CredentialDto, JobBoardDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { FormDialog } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter the email or username"),
  password: z.string().min(1, "Enter the password"),
});

/** Mounted per board (keyed), since the form reads its defaults once. */
interface BoardLoginDialogProps {
  board: JobBoardDto;
  /** The board's saved login, replaced on save; null adds one. */
  login: CredentialDto | null;
  onClose: () => void;
}

/** Adds or replaces one board's login; the default login and captcha keys have their own card. */
export function BoardLoginDialog(props: BoardLoginDialogProps): ReactElement {
  const { board, login, onClose } = props;
  const save = useApiMutation(
    (values: z.infer<typeof loginSchema>) =>
      login
        ? api.credentials({ id: login.id }).patch(values)
        : api.credentials.post({ kind: "board", board: board.domain, ...values }),
    { successMessage: "Login saved", invalidate: [credentialQueries.all] },
  );

  const form = useAppForm({
    defaultValues: { email: login?.email ?? "", password: "" },
    validators: { onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value);
      handleClose();
    },
  });

  const handleClose = (): void => {
    form.reset();
    onClose();
  };

  return (
    <FormDialog
      open
      title={`${login ? "Edit" : "Add"} ${board.name} login`}
      onClose={handleClose}
      form={form}
    >
      <form.AppField name="email">
        {(field) => <field.TextField label="Email or username" />}
      </form.AppField>
      <form.AppField name="password">
        {(field) => <field.TextField label="Password" type="password" />}
      </form.AppField>
    </FormDialog>
  );
}
