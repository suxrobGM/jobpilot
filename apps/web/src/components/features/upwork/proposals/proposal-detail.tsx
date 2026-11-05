"use client";

import type { ReactElement } from "react";
import { upworkChannel } from "@jobpilot/contracts/sse";
import { AutoAwesome, ContentCopy, Delete, Launch, Send } from "@mui/icons-material";
import { Box, Button, IconButton, LinearProgress, Stack, Typography } from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { isNotFound } from "@/api/error";
import { useApiMutation } from "@/api/hooks";
import { upworkAccountQueries, upworkProposalQueries } from "@/api/queries";
import type { UpdateUpworkProposalRequest } from "@/api/types";
import { AgentOnlyButton } from "@/components/ui/buttons";
import { QueryError } from "@/components/ui/feedback";
import { PageHeader, PageShell, SectionCard } from "@/components/ui/layout";
import { useCopy } from "@/hooks/use-copy";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";
import { useAgent } from "@/providers/agent-provider";
import { useConfirm } from "@/providers/confirm-provider";
import { ProposalNotes } from "./proposal-notes";
import { ProposalStatusBar } from "./proposal-status-bar";

interface ProposalDetailProps {
  id: string;
}

export function ProposalDetail(props: ProposalDetailProps): ReactElement {
  const { id } = props;
  const router = useRouter();
  const agent = useAgent();
  const copy = useCopy();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const detail = useQuery(upworkProposalQueries.detail(id));
  const account = useQuery(upworkAccountQueries.detail());

  useLiveInvalidation(upworkChannel, null, {
    on: {
      "proposal.updated": (event) => {
        if (event.id === id) {
          void queryClient.invalidateQueries({
            queryKey: upworkProposalQueries.detail(id).queryKey,
          });
        }
      },
      "account.updated": [upworkAccountQueries.all],
    },
  });

  const update = useApiMutation(
    (body: UpdateUpworkProposalRequest) => api.upwork.proposals({ id }).patch(body),
    { invalidate: [upworkProposalQueries.all] },
  );

  const remove = useApiMutation(() => api.upwork.proposals({ id }).delete(), {
    successMessage: "Proposal deleted",
    invalidate: [upworkProposalQueries.all],
    onSuccess: () => router.replace("/upwork" as Route),
  });

  if (detail.isLoading) {
    return <LinearProgress />;
  }

  const proposal = detail.data;
  if (!proposal) {
    return (
      <PageShell maxWidth="md">
        {isNotFound(detail.error) ? (
          <Typography variant="body1Muted">Proposal not found.</Typography>
        ) : (
          <QueryError title="Couldn't load this proposal." onRetry={() => void detail.refetch()} />
        )}
      </PageShell>
    );
  }

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
    <PageShell maxWidth="md">
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
                href={proposal.jobUrl}
              >
                Open posting
              </Button>
            )}
            <AgentOnlyButton
              variant="outlined"
              startIcon={<AutoAwesome fontSize="md" />}
              onClick={() => void agent.injectSkill("upwork-proposal", String(id))}
            >
              {proposal.proposalText ? "Regenerate" : "Generate"}
            </AgentOnlyButton>
            <AgentOnlyButton
              variant="contained"
              startIcon={<Send fontSize="md" />}
              disabled={proposal.status !== "draft" || !proposal.proposalText}
              onClick={() => void agent.injectSkill("upwork-submit", String(id))}
            >
              Submit on Upwork
            </AgentOnlyButton>
            <IconButton onClick={() => void handleDelete()} aria-label="Delete proposal">
              <Delete fontSize="md" />
            </IconButton>
          </>
        }
      />

      {proposal.status === "draft" && (
        <Typography variant="captionMuted">
          Submitting spends Connects. The agent shows the exact cost and asks before it sends.
          {account.data?.connectsBalance != null &&
            ` Balance: ${account.data.connectsBalance} Connects.`}
        </Typography>
      )}

      <ProposalStatusBar proposal={proposal} onChange={(patch) => update.mutate(patch)} />

      <SectionCard
        title="Proposal"
        actions={
          proposal.proposalText ? (
            <Button
              size="small"
              startIcon={<ContentCopy fontSize="sm" />}
              onClick={() => void copy(proposal.proposalText)}
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
            Not generated yet. Click Generate to run the proposal skill in the terminal - this page
            updates automatically when it finishes.
          </Typography>
        )}
      </SectionCard>

      {proposal.screeningAnswers.length > 0 && (
        <SectionCard title="Screening answers">
          <Stack spacing={2}>
            {proposal.screeningAnswers.map((qa) => (
              <Box key={qa.question}>
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
    </PageShell>
  );
}
