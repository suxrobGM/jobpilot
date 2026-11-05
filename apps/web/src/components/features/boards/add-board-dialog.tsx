"use client";

import type { ReactElement } from "react";
import { boardDomainSchema, jobBoardSchema } from "@jobpilot/contracts/job-board";
import { Stack } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod/v4";
import { jobBoardQueries } from "@/api/queries";
import { FormDialog } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";
import { useLinkBoard } from "./use-link-board";

/** Empty `catalogDomain` means "another site", which needs a typed domain. */
const OTHER_SITE = "";

const addBoardFormSchema = jobBoardSchema
  .extend({
    catalogDomain: z.string(),
    domain: z.string().trim().toLowerCase(),
  })
  .refine(
    (values) =>
      values.catalogDomain !== OTHER_SITE || boardDomainSchema.safeParse(values.domain).success,
    { message: "Enter a domain like linkedin.com", path: ["domain"] },
  );

const EMPTY: z.infer<typeof addBoardFormSchema> = {
  catalogDomain: OTHER_SITE,
  domain: "",
  name: "",
  searchUrl: "",
};

interface AddBoardDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Pick a catalog board, or describe another site. Logins are added under Settings, Credentials. */
export function AddBoardDialog(props: AddBoardDialogProps): ReactElement {
  const { open, onClose } = props;
  const create = useLinkBoard({ successMessage: "Board added" });
  const catalog = useQuery({ ...jobBoardQueries.catalog(), enabled: open });

  const form = useAppForm({
    defaultValues: EMPTY,
    validators: { onSubmit: addBoardFormSchema },
    onSubmit: async ({ value }) => {
      const { catalogDomain, ...rest } = value;
      await create.mutateAsync({ ...rest, domain: catalogDomain || rest.domain });
      onClose();
    },
  });
  const catalogDomain = useSelector(form.store, (s) => s.values.catalogDomain);
  const isOtherSite = catalogDomain === OTHER_SITE;

  return (
    <FormDialog open={open} title="Add job board" onClose={onClose} form={form}>
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
    </FormDialog>
  );
}
