"use client";

import type { ReactElement } from "react";
import { CLASSIFICATION_TO_STATUS } from "@jobpilot/contracts/email";
import { KeyboardArrowDown, KeyboardArrowUp, Refresh, SmartToy } from "@mui/icons-material";
import { Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { emailQueries, invalidations } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { TooltipIconButton } from "@/components/ui/buttons";
import { RelativeTime, StatusChip } from "@/components/ui/display";
import { DetailLoadFailure, DetailSkeleton } from "@/components/ui/feedback";
import { PageHeader, PageShell, StickyFooter } from "@/components/ui/layout";
import { inboxHref, messageHref } from "@/utils/routes";
import { ApplicationMatchField } from "./application-match-field";
import { splitIrrelevant, useInboxMessages } from "./use-inbox-messages";

/** The list page this message was opened from: its ids give next/previous, its URL gives Back. */
function useListContext(messageId: string) {
  const { query, listQuery } = useInboxMessages();
  const { relevant, irrelevant } = splitIrrelevant(query.data?.items ?? []);
  const ids = [...relevant, ...irrelevant].map((row) => row.id);
  const at = ids.indexOf(messageId);
  const neighbor = (direction: 1 | -1) => {
    const id = at === -1 ? undefined : ids[at + direction];
    return id ? messageHref(id, listQuery) : null;
  };
  return { backHref: inboxHref(listQuery), previous: neighbor(-1), next: neighbor(1) };
}

interface MessageDetailProps {
  messageId: string;
}

/** One message: what the pilot made of it, the application it matches, and approve or deny. */
export function MessageDetail(props: MessageDetailProps): ReactElement {
  const { messageId } = props;
  const router = useRouter();
  const { backHref, previous, next } = useListContext(messageId);
  const request = useCreateRequest();
  const messageQuery = useQuery(emailQueries.message(messageId));
  // Reviewing one message usually means reviewing the next, so a decision moves on.
  const moveOn = () => router.push(next ?? backHref);

  const approve = useApiMutation(() => api.email.messages({ id: messageId }).approve.post({}), {
    successMessage: "Approved",
    invalidate: invalidations.emailReview,
    onSuccess: moveOn,
  });
  const deny = useApiMutation(() => api.email.messages({ id: messageId }).deny.post({}), {
    successMessage: "Denied",
    invalidate: [emailQueries.all],
    onSuccess: moveOn,
  });

  const message = messageQuery.data;
  const isReviewed = message?.reviewStatus === "approved" || message?.reviewStatus === "denied";
  const nextStatus = message?.classification
    ? CLASSIFICATION_TO_STATUS[message.classification]
    : null;
  const canDeny = Boolean(message?.classification) && !isReviewed;
  // Only classes that map to a status can be approved ("verification" and "irrelevant" don't).
  const canApprove = canDeny && Boolean(nextStatus ?? message?.resultingStatus);
  const approveReady = canApprove && Boolean(message?.applicationId) && !approve.isPending;

  const rescan = () =>
    request.mutate({ taskType: "inbox.review", payload: { messageIds: [messageId] } });

  return (
    <PageShell maxWidth="md">
      <PageHeader
        title={message?.subject ?? "Message"}
        eyebrow={
          message ? `${message.fromName || message.fromAddress} · ${message.fromDomain}` : undefined
        }
        backHref={backHref}
        backLabel="Inbox"
        actions={
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <TooltipIconButton title="Previous" disabled={!previous} href={previous ?? undefined}>
              <KeyboardArrowUp fontSize="md" />
            </TooltipIconButton>
            <TooltipIconButton title="Next" disabled={!next} href={next ?? undefined}>
              <KeyboardArrowDown fontSize="md" />
            </TooltipIconButton>
            <Button
              color="inherit"
              startIcon={<Refresh fontSize="md" />}
              loading={request.isPending}
              onClick={rescan}
            >
              {message?.classification ? "Rescan" : "Scan"}
            </Button>
          </Stack>
        }
      />

      {messageQuery.isError && (
        <DetailLoadFailure
          noun="message"
          error={messageQuery.error}
          onRetry={() => void messageQuery.refetch()}
        />
      )}
      {message && (
        <>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <SmartToy fontSize="md" sx={{ color: "accent.primary" }} />
                  <Typography variant="body2Strong" sx={{ flex: 1 }}>
                    Pilot's read
                  </Typography>
                  <RelativeTime value={message.receivedAt} />
                </Stack>
                {message.classification ? (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
                  >
                    <StatusChip domain="classification" value={message.classification} />
                    {message.confidence !== null && (
                      <Typography variant="monoCaption">
                        {`${Math.round(message.confidence * 100)}% sure`}
                      </Typography>
                    )}
                    {message.reviewStatus === "auto" && (
                      <Chip label="applied automatically" color="info" variant="outlined" />
                    )}
                  </Stack>
                ) : (
                  <Typography variant="body2Muted">
                    Not scanned yet. Scan it, or run "Scan pending", before approving or denying.
                  </Typography>
                )}
                {message.reasoning && (
                  <Typography variant="body2Muted">{message.reasoning}</Typography>
                )}
                {nextStatus && !isReviewed && (
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Typography variant="body2Muted">Approving moves the application to</Typography>
                    <StatusChip domain="application" value={nextStatus} />
                  </Stack>
                )}
                <ApplicationMatchField
                  key={message.id}
                  messageId={messageId}
                  initial={message.application}
                />
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography
                variant="body1"
                sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "text.prose" }}
              >
                {message.body || message.snippet}
              </Typography>
            </CardContent>
          </Card>

          {canDeny && (
            <StickyFooter>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                {canApprove && (
                  <Button
                    variant="contained"
                    disabled={!approveReady}
                    loading={approve.isPending}
                    onClick={() => approve.mutate()}
                  >
                    Approve
                  </Button>
                )}
                <Button color="inherit" loading={deny.isPending} onClick={() => deny.mutate()}>
                  Deny
                </Button>
                {canApprove && !message.applicationId && (
                  <Typography variant="captionMuted">
                    Pick the matching application to approve.
                  </Typography>
                )}
              </Stack>
            </StickyFooter>
          )}
        </>
      )}
      {messageQuery.isPending && <DetailSkeleton heights={[160, 240]} />}
    </PageShell>
  );
}
