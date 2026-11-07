"use client";

import { type ReactElement, useState } from "react";
import { CLASSIFICATION_TO_STATUS, REVIEW_STATUSES } from "@jobpilot/contracts/email";
import { KeyboardArrowDown, KeyboardArrowUp, Refresh, SmartToy } from "@mui/icons-material";
import {
  Autocomplete,
  Button,
  Card,
  CardContent,
  Chip,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/api/client";
import { applicationQueries, emailQueries, invalidations } from "@/api/queries";
import type { ApplicationDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { TooltipIconButton } from "@/components/ui/buttons";
import { RelativeTime, StatusChip } from "@/components/ui/display";
import { DetailSkeleton } from "@/components/ui/feedback";
import { PageHeader, PageShell, StickyFooter } from "@/components/ui/layout";
import { usePageKeys } from "@/hooks/use-page-keys";
import { usePaginationParams } from "@/hooks/use-pagination";
import { applicationHref, inboxHref, messageHref } from "@/utils/routes";
import { enumParam } from "@/utils/search-params";
import { listOrder } from "./message-list";

/** The list page this message was opened from: its ids give next/previous, its URL gives Back. */
function useListContext(messageId: string) {
  const searchParams = useSearchParams();
  const listQuery = searchParams.toString();
  const filter = enumParam(REVIEW_STATUSES, searchParams.get("filter"));
  const pagination = usePaginationParams();
  const rows = useQuery(emailQueries.messages(filter, pagination.query)).data?.items ?? [];
  const ids = listOrder(rows).map((row) => row.id);
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
  const [application, setMatchedApp] = useState<ApplicationDto | null>(null);
  const [search, setSearch] = useState("");
  const request = useCreateRequest();

  const messageQuery = useQuery(emailQueries.message(messageId));
  const [prevData, setPrevData] = useState(messageQuery.data);

  // The match is editable, so it's seeded from each newly loaded message, then owned here.
  if (messageQuery.data !== prevData) {
    setPrevData(messageQuery.data);
    const matched = (messageQuery.data?.application as ApplicationDto | null | undefined) ?? null;
    setMatchedApp(matched);
    setSearch(matched?.company ?? "");
  }

  const appOptions = useQuery(applicationQueries.search(search));
  // Reviewing one message usually means reviewing the next, so a decision moves on.
  const moveOn = () => router.push(next ?? backHref);

  const patchMatch = useApiMutation(
    (applicationId: string | null) =>
      api.email.messages({ id: messageId }).patch({ applicationId }),
    { invalidate: [emailQueries.all] },
  );
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
    : undefined;
  const canDeny = Boolean(message?.classification) && !isReviewed;
  // Only classes that map to a status can be approved ("verification" and "irrelevant" don't).
  const canApprove = canDeny && Boolean(nextStatus ?? message?.resultingStatus);
  const approveReady = canApprove && Boolean(message?.applicationId) && !approve.isPending;

  const go = (href: Route | null) => href && router.push(href);
  usePageKeys({
    Escape: () => router.push(backHref),
    j: () => go(next),
    k: () => go(previous),
    a: () => approveReady && approve.mutate(),
    d: () => canDeny && !deny.isPending && deny.mutate(),
  });

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
            <TooltipIconButton
              title="Previous (K)"
              disabled={!previous}
              href={previous ?? undefined}
            >
              <KeyboardArrowUp fontSize="md" />
            </TooltipIconButton>
            <TooltipIconButton title="Next (J)" disabled={!next} href={next ?? undefined}>
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

      {message ? (
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
                <Autocomplete<ApplicationDto>
                  options={appOptions.data?.items ?? []}
                  getOptionLabel={(o) => `${o.title} · ${o.company}`}
                  value={application}
                  onChange={(_, v) => {
                    setMatchedApp(v);
                    patchMatch.mutate(v ? v.id : null);
                  }}
                  onInputChange={(_, v) => setSearch(v)}
                  renderInput={(params) => (
                    <TextField {...params} label="Matches your application" />
                  )}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                />
                {application && (
                  <Link href={applicationHref(application.id)} variant="body2">
                    Open the application for the documents sent and the posting
                  </Link>
                )}
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
                <Typography
                  variant="captionMuted"
                  sx={{ ml: "auto", display: { xs: "none", md: "block" } }}
                >
                  A approve · D deny · J / K next · Esc back
                </Typography>
              </Stack>
            </StickyFooter>
          )}
        </>
      ) : (
        <DetailSkeleton heights={[160, 240]} />
      )}
    </PageShell>
  );
}
