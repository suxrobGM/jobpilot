"use client";

import type { ReactElement } from "react";
import type { JobBoardInput } from "@jobpilot/contracts/job-board";
import { Stack } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { z } from "zod/v4";
import { useApiQuery } from "@/api/hooks";
import { jobBoardQueries } from "@/api/queries";
import { FormDialog } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";

/** Empty `catalogDomain` means "another site", which needs a typed domain. */
const OTHER_SITE = "";

const addBoardFormSchema = z
  .object({
    catalogDomain: z.string(),
    domain: z.string().trim(),
    name: z.string().trim(),
    searchUrl: z.string().trim(),
    email: z.string().trim(),
    password: z.string(),
  })
  .refine((values) => values.catalogDomain !== OTHER_SITE || values.domain.length > 0, {
    message: "Enter the site's domain",
    path: ["domain"],
  });

const EMPTY: z.infer<typeof addBoardFormSchema> = {
  catalogDomain: OTHER_SITE,
  domain: "",
  name: "",
  searchUrl: "",
  email: "",
  password: "",
};

interface AddBoardDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: JobBoardInput) => void;
  submitting?: boolean;
}

/** Pick a catalog board, or describe another site. Either way the login is optional. */
export function AddBoardDialog(props: AddBoardDialogProps): ReactElement {
  const { open, onClose, onSubmit, submitting } = props;
  const catalog = useApiQuery(jobBoardQueries.catalog(), { enabled: open });

  const form = useAppForm({
    defaultValues: EMPTY,
    validators: { onSubmit: addBoardFormSchema },
    onSubmit: async ({ value }) => {
      const { catalogDomain, ...rest } = value;
      onSubmit({ ...rest, domain: catalogDomain || rest.domain });
    },
  });
  const catalogDomain = useSelector(form.store, (s) => s.values.catalogDomain);
  const isOtherSite = catalogDomain === OTHER_SITE;

  return (
    <FormDialog
      open={open}
      title="Add job board"
      onClose={onClose}
      form={form}
      submitting={submitting}
    >
      <form.AppField name="catalogDomain">
        {(field) => (
          <field.Select
            label="Board"
            optional
            emptyLabel="Another site"
            items={(catalog.data ?? []).map((b) => ({ value: b.domain, label: b.name }))}
          />
        )}
      </form.AppField>
      {isOtherSite && (
        <>
          <Stack direction="row" spacing={2}>
            <form.AppField name="domain">
              {(field) => <field.TextField label="Domain (e.g. linkedin.com)" />}
            </form.AppField>
            <form.AppField name="name">
              {(field) => <field.TextField label="Display name" />}
            </form.AppField>
          </Stack>
          <form.AppField name="searchUrl">
            {(field) => <field.TextField label="Search URL" />}
          </form.AppField>
        </>
      )}
      <Stack direction="row" spacing={2}>
        <form.AppField name="email">
          {(field) => <field.TextField label="Email (for login)" />}
        </form.AppField>
        <form.AppField name="password">
          {(field) => <field.TextField label="Password (for login)" type="password" />}
        </form.AppField>
      </Stack>
    </FormDialog>
  );
}
