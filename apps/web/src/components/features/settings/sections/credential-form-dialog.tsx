"use client";

import type { ReactElement } from "react";
import {
  CAPTCHA_PROVIDERS,
  type CaptchaProvider,
  CREDENTIAL_KINDS,
  type CredentialInput,
  type CredentialKind,
  credentialSchema,
} from "@jobpilot/contracts/credential";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { z } from "zod/v4";
import { useApiQuery } from "@/api/hooks";
import { jobBoardQueries } from "@/api/queries";
import { FormDialog } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";

interface CredentialFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CredentialInput) => void;
  submitting?: boolean;
}

export const PROVIDER_LABELS: Record<CaptchaProvider, string> = {
  two_captcha: "2Captcha",
  capsolver: "CapSolver",
};

const PROVIDER_ITEMS = CAPTCHA_PROVIDERS.map((p) => ({ value: p, label: PROVIDER_LABELS[p] }));

const KIND_LABELS: Record<CredentialKind, string> = {
  board: "Board login",
  default: "Default login",
  service: "Captcha service",
};

/** One flat shape for every kind, so switching kinds keeps the form's fields stable. */
interface CredentialFormValues {
  kind: CredentialKind;
  board: string;
  email: string;
  password: string;
  provider: CaptchaProvider;
  apiKey: string;
}

const DEFAULTS: CredentialFormValues = {
  kind: "board",
  board: "",
  email: "",
  password: "",
  provider: CAPTCHA_PROVIDERS[0],
  apiKey: "",
};

/** Only the chosen kind's fields, so the others persist as null. */
function toInput(values: CredentialFormValues) {
  const login = { email: values.email, password: values.password };
  if (values.kind === "board") {
    return { kind: values.kind, board: values.board, ...login };
  }
  if (values.kind === "default") {
    return { kind: values.kind, ...login };
  }
  return { kind: values.kind, provider: values.provider, apiKey: values.apiKey };
}

// Validated through the contract, re-pathed onto the flat fields.
const formSchema = z
  .object({
    kind: z.enum(CREDENTIAL_KINDS),
    board: z.string(),
    email: z.string(),
    password: z.string(),
    provider: z.enum(CAPTCHA_PROVIDERS),
    apiKey: z.string(),
  })
  .superRefine((values, ctx) => {
    const parsed = credentialSchema.safeParse(toInput(values));
    for (const issue of parsed.error?.issues ?? []) {
      ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
    }
  });

export function CredentialFormDialog(props: CredentialFormDialogProps): ReactElement {
  const { open, onClose, onSubmit, submitting } = props;
  const boards = useApiQuery(jobBoardQueries.list());
  const boardItems = (boards.data ?? []).map((b) => ({ value: b.domain, label: b.name }));

  const form = useAppForm({
    defaultValues: DEFAULTS,
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => onSubmit(credentialSchema.parse(toInput(value))),
  });
  const kind = useSelector(form.store, (s) => s.values.kind);

  // Reset so reopening starts clean instead of showing stale input.
  const handleClose = (): void => {
    form.reset();
    onClose();
  };

  return (
    <FormDialog
      open={open}
      title="Add credential"
      onClose={handleClose}
      form={form}
      submitting={submitting}
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        color="primary"
        value={kind}
        onChange={(_, next: CredentialKind | null) => next && form.setFieldValue("kind", next)}
      >
        {CREDENTIAL_KINDS.map((k) => (
          <ToggleButton key={k} value={k}>
            {KIND_LABELS[k]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {kind === "board" && (
        <form.AppField name="board">
          {(field) => (
            <field.Select
              label="Board"
              items={boardItems}
              helperText="Your boards. Add another under Boards first."
            />
          )}
        </form.AppField>
      )}

      {kind !== "service" && (
        <>
          <form.AppField name="email">
            {(field) => <field.TextField label="Email or username" />}
          </form.AppField>
          <form.AppField name="password">
            {(field) => <field.TextField label="Password" type="password" />}
          </form.AppField>
        </>
      )}

      {kind === "service" && (
        <>
          <form.AppField name="provider">
            {(field) => <field.Select label="Provider" items={PROVIDER_ITEMS} />}
          </form.AppField>
          <form.AppField name="apiKey">
            {(field) => (
              <field.TextField
                label="API key"
                type="password"
                helperText="Used by the solve-captcha skill to solve image challenges"
              />
            )}
          </form.AppField>
        </>
      )}
    </FormDialog>
  );
}
