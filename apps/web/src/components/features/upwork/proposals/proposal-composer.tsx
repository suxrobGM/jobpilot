"use client";

import type { ReactElement } from "react";
import { Button, Stack } from "@mui/material";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { z } from "zod/v4";
import { apiClient } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { CreateUpworkProposalRequest, UpworkProposalDto } from "@/api/types";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { useAgent } from "@/providers/agent-provider";

interface FormValues {
  jobTitle: string;
  clientName: string;
  jobUrl: string;
  jobDescription: string;
}

const formSchema = z.object({
  jobTitle: z.string().trim().min(2, "Enter a job title"),
  clientName: z.string(),
  jobUrl: z.string(),
  jobDescription: z.string().trim().min(20, "Paste the job description"),
});

export function ProposalComposer(): ReactElement {
  const router = useRouter();
  const agent = useAgent();

  const createProposal = useApiMutation<UpworkProposalDto, CreateUpworkProposalRequest>(
    (body) => apiClient.post<UpworkProposalDto>("/api/upwork/proposals", body),
    { invalidate: [queryKeys.upworkProposals.all] },
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

      await agent.injectSkill("upwork-proposal", String(created.id));
      router.push(`/upwork/${created.id}` as Route);
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
