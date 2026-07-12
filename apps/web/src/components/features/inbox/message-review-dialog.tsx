"use client";

import { type ReactElement, useState } from "react";
import { CLASSIFICATION_TO_STATUS } from "@jobpilot/contracts/email";
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
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { ApplicationDto, EmailMessageDetailDto } from "@/api/types";

interface MessageReviewDialogProps {
  messageId: string | null;
  open: boolean;
  onClose: () => void;
}

// Only classifications with a mapped status can be approved ("verification" /
// "irrelevant" have none); derived from the shared classification→status map.
const STATUS_CLASSIFICATIONS = new Set(Object.keys(CLASSIFICATION_TO_STATUS));

export function MessageReviewDialog(props: MessageReviewDialogProps): ReactElement | null {
  const { messageId, open, onClose } = props;
  const [matchedApp, setMatchedApp] = useState<ApplicationDto | null>(null);
  const [search, setSearch] = useState("");

  const message = useApiQuery<EmailMessageDetailDto>(
    [...queryKeys.email.all, "message", messageId ?? -1] as const,
    () => {
      if (messageId == null) {
        return Promise.resolve({ data: null, error: null });
      }
      return api.email.messages({ id: messageId }).get();
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
    () => api.applied.get({ query: search ? { search } : {} }),
    { enabled: open },
  );

  const patchMatch = useApiMutation<unknown, { matchedAppId: string | null }>(
    (vars) => api.email.messages({ id: messageId! }).patch(vars),
    {
      invalidate: [queryKeys.email.all],
    },
  );

  const approve = useApiMutation<unknown, void>(
    () => api.email.messages({ id: messageId! }).approve.post({}),
    {
      successMessage: "Approved",
      invalidate: [queryKeys.email.all, queryKeys.applications.all],
      onSuccess: () => onClose(),
    },
  );

  const deny = useApiMutation<unknown, void>(
    () => api.email.messages({ id: messageId! }).deny.post({}),
    {
      successMessage: "Denied",
      invalidate: [queryKeys.email.all],
      onSuccess: () => onClose(),
    },
  );

  if (!open || messageId == null) {
    return null;
  }

  const m = message.data;
  const isClassified = Boolean(m?.classification);
  const isReviewed = m?.reviewStatus === "approved" || m?.reviewStatus === "denied";

  const canApprove = Boolean(
    m && (STATUS_CLASSIFICATIONS.has(m.classification ?? "") || m.appliedStatus),
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
