"use client";

import type { ReactElement } from "react";
import { AutoAwesome, ContentCopy, Delete, Launch } from "@mui/icons-material";
import {
  Box,
  Button,
  Container,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { UpdateUpworkProposalRequest, UpworkProposalDto } from "@/api/types";
import { PageHeader, SectionCard } from "@/components/ui/layout";
import { upworkChannel } from "@/lib/sse/channels/upwork";
import { useSseChannel } from "@/lib/sse/client";
import { useAgent } from "@/providers/agent-provider";
import { useConfirm } from "@/providers/confirm-provider";
import { useToast } from "@/providers/notification-provider";
import { ProposalNotes } from "./proposal-notes";
import { ProposalStatusBar } from "./proposal-status-bar";

interface ProposalDetailProps {
  id: number;
}

export function ProposalDetail(props: ProposalDetailProps): ReactElement {
  const { id } = props;
  const router = useRouter();
  const agent = useAgent();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const detail = useApiQuery<UpworkProposalDto>(queryKeys.upworkProposals.detail(id), () =>
    apiClient.get<UpworkProposalDto>(`/api/upwork/proposals/${id}`),
  );

  useSseChannel(upworkChannel, null, {
    on: {
      "proposal.updated": (e) => {
        if (e.id === id) {
          queryClient.invalidateQueries({ queryKey: queryKeys.upworkProposals.detail(id) });
        }
      },
    },
  });

  const update = useApiMutation<UpworkProposalDto, UpdateUpworkProposalRequest>(
    (body) => apiClient.patch<UpworkProposalDto>(`/api/upwork/proposals/${id}`, body),
    { invalidate: [queryKeys.upworkProposals.all] },
  );

  const remove = useApiMutation<{ id: number }, void>(
    () => apiClient.del<{ id: number }>(`/api/upwork/proposals/${id}`),
    {
      successMessage: "Proposal deleted",
      invalidate: [queryKeys.upworkProposals.all],
      onSuccess: () => router.replace("/upwork" as Route),
    },
  );

  if (detail.isLoading) {
    return <LinearProgress />;
  }

  const proposal = detail.data;
  if (!proposal) {
    return (
      <Container maxWidth="md">
        <Typography variant="body1Muted">Proposal not found.</Typography>
      </Container>
    );
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "Delete proposal?",
      description: "This permanently removes the proposal and its generated text.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (confirmed) {
      remove.mutate();
    }
  };

  return (
    <Container maxWidth="md" sx={{ gap: 2 }}>
      <PageHeader
        eyebrow={proposal.clientName ?? "Upwork"}
        title={proposal.jobTitle}
        backHref="/upwork"
        backLabel="Proposals"
        actions={
          <>
            {proposal.jobUrl && (
              <Button
                variant="outlined"
                startIcon={<Launch fontSize="md" />}
                component="a"
                href={proposal.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open posting
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<AutoAwesome fontSize="md" />}
              onClick={() => void agent.injectSkill("upwork-proposal", String(id))}
            >
              {proposal.proposalText ? "Regenerate" : "Generate"}
            </Button>
            <IconButton onClick={() => void handleDelete()} aria-label="Delete proposal">
              <Delete fontSize="md" />
            </IconButton>
          </>
        }
      />

      <ProposalStatusBar proposal={proposal} onChange={(patch) => update.mutate(patch)} />

      <SectionCard
        title="Proposal"
        actions={
          proposal.proposalText ? (
            <Button
              size="small"
              startIcon={<ContentCopy fontSize="sm" />}
              onClick={() => void handleCopy(proposal.proposalText)}
            >
              Copy
            </Button>
          ) : null
        }
      >
        {proposal.proposalText ? (
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {proposal.proposalText}
          </Typography>
        ) : (
          <Typography variant="body2Muted">
            Not generated yet. Click Generate to run the proposal skill in the terminal — this page
            updates automatically when it finishes.
          </Typography>
        )}
      </SectionCard>

      {proposal.screeningAnswers.length > 0 && (
        <SectionCard title="Screening answers">
          <Stack spacing={2}>
            {proposal.screeningAnswers.map((qa, i) => (
              <Box key={i}>
                <Typography variant="overlineMuted">{qa.question}</Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {qa.answer}
                </Typography>
              </Box>
            ))}
          </Stack>
        </SectionCard>
      )}

      {proposal.jobDescription && (
        <SectionCard title="Job description">
          <Typography variant="body2Muted" sx={{ whiteSpace: "pre-wrap" }}>
            {proposal.jobDescription}
          </Typography>
        </SectionCard>
      )}

      <ProposalNotes id={id} notes={proposal.notes} />
    </Container>
  );
}
