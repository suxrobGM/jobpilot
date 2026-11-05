"use client";

import type { ReactElement } from "react";
import { upworkChannel } from "@jobpilot/contracts/sse";
import { AutoAwesome, ContentCopy, Delete, Launch, Send } from "@mui/icons-material";
import { Button, Stack, Typography } from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { upworkAccountQueries, upworkProposalQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { AgentOnlyButton, TooltipIconButton } from "@/components/ui/buttons";
import { LabelValue } from "@/components/ui/display";
import { DetailLoadFailure, DetailSkeleton } from "@/components/ui/feedback";
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

  const remove = useApiMutation(() => api.upwork.proposals({ id }).delete(), {
    successMessage: "Proposal deleted",
    invalidate: [upworkProposalQueries.all],
    onSuccess: () => router.replace("/upwork"),
  });

  if (detail.isPending) {
    return <DetailSkeleton />;
  }

  const proposal = detail.data;
  if (!proposal) {
    return (
      <PageShell maxWidth="md">
        <DetailLoadFailure
          noun="proposal"
          error={detail.error}
          onRetry={() => void detail.refetch()}
        />
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
              onClick={() => void agent.injectSkill("upwork-proposal", id)}
            >
              {proposal.proposalText ? "Regenerate" : "Generate"}
            </AgentOnlyButton>
            <AgentOnlyButton
              variant="contained"
              startIcon={<Send fontSize="md" />}
              disabled={proposal.status !== "draft" || !proposal.proposalText}
              onClick={() => void agent.injectSkill("upwork-submit", id)}
            >
              Submit on Upwork
            </AgentOnlyButton>
            <TooltipIconButton title="Delete proposal" onClick={() => void handleDelete()}>
              <Delete fontSize="md" />
            </TooltipIconButton>
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

      <ProposalStatusBar proposal={proposal} />

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
              <LabelValue key={qa.question} label={qa.question}>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {qa.answer}
                </Typography>
              </LabelValue>
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
