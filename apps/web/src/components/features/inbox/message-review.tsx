"use client";

import { type ReactElement, useState } from "react";
import { CLASSIFICATION_TO_STATUS } from "@jobpilot/contracts/email";
import { ArrowBack, Refresh, SmartToy } from "@mui/icons-material";
import {
  Autocomplete,
  Box,
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
import { api } from "@/api/client";
import { applicationQueries, emailQueries, invalidations } from "@/api/queries";
import type { ApplicationDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { RelativeTime, StatusChip } from "@/components/ui/display";
import { DetailSkeleton } from "@/components/ui/feedback";
import { usePageKeys } from "@/hooks/use-page-keys";

const PANE_WIDTH = 860;

interface MessageReviewProps {
  messageId: string;
  onBack: () => void;
  /** Moves to the next (1) or previous (-1) message on this page. */
  onStep: (direction: 1 | -1) => void;
}

/** One message: what the pilot made of it, the application it matches, and approve or deny. */
export function MessageReview(props: MessageReviewProps): ReactElement {
  const { messageId, onBack, onStep } = props;
  const [application, setMatchedApp] = useState<ApplicationDto | null>(null);
  const [search, setSearch] = useState("");
  const request = useCreateRequest();

  const message = useQuery(emailQueries.message(messageId));
  const [prevData, setPrevData] = useState(message.data);

  // The match is editable, so it's seeded from each newly loaded message, then owned here.
  if (message.data !== prevData) {
    setPrevData(message.data);
    const matched = (message.data?.application as ApplicationDto | null | undefined) ?? null;
    setMatchedApp(matched);
    setSearch(matched?.company ?? "");
  }

  const appOptions = useQuery(applicationQueries.search(search));

  const patchMatch = useApiMutation(
    (applicationId: string | null) =>
      api.email.messages({ id: messageId }).patch({ applicationId }),
    { invalidate: [emailQueries.all] },
  );
  const approve = useApiMutation(() => api.email.messages({ id: messageId }).approve.post({}), {
    successMessage: "Approved",
    invalidate: invalidations.emailReview,
    onSuccess: () => onStep(1),
  });
  const deny = useApiMutation(() => api.email.messages({ id: messageId }).deny.post({}), {
    successMessage: "Denied",
    invalidate: [emailQueries.all],
    onSuccess: () => onStep(1),
  });

  const m = message.data;
  const isReviewed = m?.reviewStatus === "approved" || m?.reviewStatus === "denied";
  const nextStatus = m?.classification ? CLASSIFICATION_TO_STATUS[m.classification] : undefined;
  const canDeny = Boolean(m?.classification) && !isReviewed;
  // Only classes that map to a status can be approved ("verification" and "irrelevant" don't).
  const canApprove = canDeny && Boolean(nextStatus ?? m?.resultingStatus);
  const approveReady = canApprove && Boolean(m?.applicationId) && !approve.isPending;

  usePageKeys({
    Escape: onBack,
    j: () => onStep(1),
    k: () => onStep(-1),
    a: () => approveReady && approve.mutate(),
    d: () => canDeny && !deny.isPending && deny.mutate(),
  });

  const rescan = () =>
    request.mutate({ taskType: "inbox.review", payload: { messageIds: [messageId] } });

  return (
    <Stack sx={{ flex: 1, minHeight: 0 }}>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <Stack spacing={2.5} sx={{ maxWidth: PANE_WIDTH, mx: "auto", py: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Button color="inherit" startIcon={<ArrowBack fontSize="md" />} onClick={onBack}>
              Back
            </Button>
            <Typography
              variant="captionMuted"
              sx={{ ml: "auto", display: { xs: "none", md: "block" } }}
            >
              J / K next · A approve · D deny
            </Typography>
            <Button
              color="inherit"
              startIcon={<Refresh fontSize="md" />}
              loading={request.isPending}
              onClick={rescan}
              sx={{ ml: { xs: "auto", md: 0 } }}
            >
              {m?.classification ? "Rescan" : "Scan"}
            </Button>
          </Stack>

          {m ? (
            <>
              <Stack spacing={1}>
                <Typography variant="h3" component="h2">
                  {m.subject}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
                >
                  <Typography variant="body2Strong">{m.fromName || m.fromAddress}</Typography>
                  <Typography variant="body2Muted">{m.fromDomain}</Typography>
                  <RelativeTime value={m.receivedAt} sx={{ ml: "auto" }} />
                </Stack>
              </Stack>

              <Card>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <SmartToy fontSize="md" sx={{ color: "accent.primary" }} />
                      <Typography variant="body2Strong">Pilot's read</Typography>
                    </Stack>
                    {m.classification ? (
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
                      >
                        <StatusChip domain="classification" value={m.classification} />
                        {m.confidence !== null && (
                          <Typography variant="monoCaption">
                            {`${Math.round(m.confidence * 100)}% sure`}
                          </Typography>
                        )}
                        {m.reviewStatus === "auto" && (
                          <Chip label="applied automatically" color="info" variant="outlined" />
                        )}
                      </Stack>
                    ) : (
                      <Typography variant="body2Muted">
                        Not scanned yet. Scan it, or run "Scan pending", before approving or
                        denying.
                      </Typography>
                    )}
                    {m.reasoning && <Typography variant="body2Muted">{m.reasoning}</Typography>}
                    {nextStatus && !isReviewed && (
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Typography variant="body2Muted">
                          Approving moves the application to
                        </Typography>
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
                      <Link href={`/applications/${application.id}`} variant="body2">
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
                    {m.body || m.snippet}
                  </Typography>
                </CardContent>
              </Card>
            </>
          ) : (
            <DetailSkeleton heights={[48, 160, 240]} />
          )}
        </Stack>
      </Box>

      {canDeny && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ maxWidth: PANE_WIDTH, width: "100%", mx: "auto", pt: 1.5 }}
        >
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
          {canApprove && !m?.applicationId && (
            <Typography variant="captionMuted" sx={{ alignSelf: "center" }}>
              Pick the matching application to approve.
            </Typography>
          )}
        </Stack>
      )}
    </Stack>
  );
}
