"use client";

import type { ReactElement } from "react";
import { Button, Stack } from "@mui/material";
import { useRouter } from "next/navigation";
import { z } from "zod/v4";
import { api } from "@/api/client";
import { upworkProposalQueries } from "@/api/queries";
import type { CreateUpworkProposalRequest } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { proposalHref } from "@/utils/routes";

const formSchema = z.object({
  jobTitle: z.string().trim().min(2, "Enter a job title"),
  clientName: z.string(),
  jobUrl: z.string(),
  jobDescription: z.string().trim().min(20, "Paste the job description"),
});

type FormValues = z.infer<typeof formSchema>;

export function ProposalComposer(): ReactElement {
  const router = useRouter();
  const request = useCreateRequest();

  const createProposal = useApiMutation(
    (body: CreateUpworkProposalRequest) => api.upwork.proposals.post(body),
    { invalidate: [upworkProposalQueries.all] },
  );

  const form = useAppForm({
    defaultValues: {
      jobTitle: "",
      clientName: "",
      jobUrl: "",
      jobDescription: "",
    } satisfies FormValues,
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      const created = await createProposal.mutateAsync({
        jobTitle: value.jobTitle.trim(),
        clientName: value.clientName.trim() || null,
        jobUrl: value.jobUrl.trim() || null,
        jobDescription: value.jobDescription.trim(),
        status: "draft",
      });

      await request.mutateAsync({
        taskType: "upwork.proposal",
        payload: { proposalId: created.id },
      });
      router.push(proposalHref(created.id));
    },
  });

  return (
    <SectionCard>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <Stack spacing={2.5}>
          <form.AppField name="jobTitle">
            {(field) => (
              <field.TextField
                label="Job title"
                placeholder="Senior React developer for SaaS dashboard"
                autoFocus
              />
            )}
          </form.AppField>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <form.AppField name="clientName">
              {(field) => <field.TextField label="Client (optional)" />}
            </form.AppField>
            <form.AppField name="jobUrl">
              {(field) => <field.TextField label="Job URL (optional)" />}
            </form.AppField>
          </Stack>
          <form.AppField name="jobDescription">
            {(field) => (
              <field.TextField
                label="Job description"
                placeholder="Paste the full Upwork job posting here, including any screening questions."
                multiline
                minRows={8}
              />
            )}
          </form.AppField>
          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            <Button onClick={() => router.back()}>Cancel</Button>
            <form.AppForm>
              <form.SubmitButton>Generate proposal</form.SubmitButton>
            </form.AppForm>
          </Stack>
        </Stack>
      </form>
    </SectionCard>
  );
}
