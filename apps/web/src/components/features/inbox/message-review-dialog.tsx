"use client";

import { useState, type ReactElement } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { apiClient } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { ApplicationDto, EmailMessageDto } from "@/api/types";

interface MessageReviewDialogProps {
  messageId: number | null;
  open: boolean;
  onClose: () => void;
}

// Classifications that map to an application stage transition (mirrors the
// approve route's CLASSIFICATION_TO_STAGE). Only these can be approved;
// "verification" / "irrelevant" have no stage and can never be approved.
const STAGE_CLASSIFICATIONS = new Set(["interviewing", "rejected", "offer"]);

export function MessageReviewDialog(props: MessageReviewDialogProps): ReactElement {
  const { messageId, open, onClose } = props;
  const [matchedApp, setMatchedApp] = useState<ApplicationDto | null>(null);
  const [search, setSearch] = useState("");

  const message = useApiQuery<EmailMessageDto & { matchedApp?: ApplicationDto | null }>(
    [...queryKeys.email.all, "message", messageId ?? -1] as const,
    () => {
      if (messageId == null) {
        return Promise.resolve({ data: null, error: null });
      }
      return apiClient.get<EmailMessageDto & { matchedApp?: ApplicationDto | null }>(
        `/api/email/messages/${messageId}`,
      );
    },
    { enabled: messageId !== null },
  );

  // Seed the editable match/search from the fetched message whenever it changes
  const [prevData, setPrevData] = useState(message.data);

  if (message.data !== prevData) {
    setPrevData(message.data);
    if (message.data?.matchedApp) {
      setMatchedApp(message.data.matchedApp as ApplicationDto);
      setSearch(message.data.matchedApp.company ?? "");
    } else {
      setMatchedApp(null);
      setSearch("");
    }
  }

  const appOptions = useApiQuery<ApplicationDto[]>(
    [...queryKeys.applications.all, "search", search] as const,
    () =>
      apiClient.get<ApplicationDto[]>(
        search ? `/api/applied?search=${encodeURIComponent(search)}` : "/api/applied",
      ),
    { enabled: open },
  );

  const patchMatch = useApiMutation<EmailMessageDto, { matchedAppId: number | null }>(
    (vars) => apiClient.patch<EmailMessageDto>(`/api/email/messages/${messageId}`, vars),
    {
      invalidate: [queryKeys.email.all],
    },
  );

  const approve = useApiMutation<{ id: number; applicationId: number }, void>(
    () => apiClient.post(`/api/email/messages/${messageId}/approve`, {}),
    {
      successMessage: "Approved",
      invalidate: [queryKeys.email.all, queryKeys.applications.all],
      onSuccess: () => onClose(),
    },
  );

  const deny = useApiMutation<{ id: number }, void>(
    () => apiClient.post(`/api/email/messages/${messageId}/deny`, {}),
    {
      successMessage: "Denied",
      invalidate: [queryKeys.email.all],
      onSuccess: () => onClose(),
    },
  );

  if (!open || messageId == null) {
    return <></>;
  }

  const m = message.data;
  const isClassified = Boolean(m?.classification);
  const isReviewed = m?.reviewStatus === "approved" || m?.reviewStatus === "denied";

  const canApprove = Boolean(
    m && (STAGE_CLASSIFICATIONS.has(m.classification ?? "") || m.appliedStage),
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{m?.subject ?? "Loading"}</DialogTitle>
      <DialogContent dividers>
        {m ? (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {m.fromName || m.fromAddress}
              </Typography>
              <Typography variant="captionMuted">·</Typography>
              <Typography variant="captionMuted">{m.fromDomain}</Typography>
              <Typography variant="captionMuted">·</Typography>
              <Typography variant="captionMuted">
                {new Date(m.receivedAt).toLocaleString()}
              </Typography>
              {m.classification && <Chip size="small" label={m.classification} />}
              {m.reviewStatus === "auto" && (
                <Chip size="small" label="auto" color="info" variant="outlined" />
              )}
            </Stack>

            {m.reasoning && (
              <Typography variant="captionMuted">Reasoning: {m.reasoning}</Typography>
            )}

            {!isClassified && (
              <Typography variant="body2Muted">
                This email hasn&apos;t been classified yet. Run &quot;Scan pending&quot; to analyze
                it before approving or denying.
              </Typography>
            )}

            <Autocomplete<ApplicationDto>
              size="small"
              options={appOptions.data ?? []}
              getOptionLabel={(o) => `${o.title} ${o.company}`}
              value={matchedApp}
              onChange={(_, v) => {
                setMatchedApp(v);
                patchMatch.mutate({ matchedAppId: v ? v.id : null });
              }}
              onInputChange={(_, v) => setSearch(v)}
              renderInput={(params) => <TextField {...params} label="Matched application" />}
              isOptionEqualToValue={(a, b) => a.id === b.id}
            />

            <Box
              sx={(t) => ({
                p: 2,
                maxHeight: 320,
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
                fontSize: "0.85rem",
                borderRadius: t.radii.sm,
                border: `1px solid ${t.palette.line.divider}`,
                backgroundColor: t.palette.surfaces.elevated,
              })}
            >
              {m.rawBody || m.snippet}
            </Box>
          </Stack>
        ) : (
          <Typography variant="body2Muted">Loading</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {isClassified && !isReviewed && (
          <Button color="error" onClick={() => deny.mutate()} disabled={deny.isPending}>
            Deny
          </Button>
        )}
        {isClassified && !isReviewed && canApprove && (
          <Button
            variant="contained"
            onClick={() => approve.mutate()}
            disabled={approve.isPending || !m?.matchedAppId}
          >
            Approve
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
