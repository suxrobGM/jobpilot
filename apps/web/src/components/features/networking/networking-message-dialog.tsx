"use client";

import { type ReactElement, useState } from "react";
import { NETWORKING_MESSAGE_TERMINAL_STATUSES } from "@jobpilot/contracts/networking";
import { Close } from "@mui/icons-material";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import type { NetworkingMessageDto } from "@/api/types";
import { useAgent, useAgentAvailable } from "@/providers/agent-provider";

interface NetworkingMessageDialogProps {
  campaignId: string;
  message: NetworkingMessageDto;
  canSend: boolean;
  invalidate: ReadonlyArray<ReadonlyArray<unknown>>;
  onClose: () => void;
  onSkip: () => void;
}

export function NetworkingMessageDialog(props: NetworkingMessageDialogProps): ReactElement {
  const { campaignId, message, canSend, invalidate, onClose, onSkip } = props;
  const agent = useAgent();
  const agentAvailable = useAgentAvailable();
  const [subject, setSubject] = useState(message.subject ?? "");
  const [body, setBody] = useState(message.body);

  const messageApi = api.campaigns({ id: campaignId }).networking({ messageId: message.id });
  const isEmail = message.channel === "email";
  const isConnectNote = message.linkedinKind === "connect_note";
  const terminal = NETWORKING_MESSAGE_TERMINAL_STATUSES.includes(message.status);

  const save = useApiMutation<unknown, void>(
    () => messageApi.patch({ subject: subject || null, body }),
    { invalidate, successMessage: "Saved" },
  );

  const approve = useApiMutation<unknown, void>(
    () => messageApi.patch({ subject: subject || null, body, status: "approved" }),
    { invalidate, successMessage: "Approved", onSuccess: onClose },
  );

  const send = useApiMutation<unknown, void>(
    async () => {
      const sent = await api.email.send.post({
        to: message.contact.email ?? "",
        subject,
        body,
      });
      if (sent.error || !sent.data) {
        return sent;
      }
      return messageApi.result.post({
        outcome: "sent",
        providerId: sent.data.providerId,
        threadId: sent.data.threadId,
        sentAt: new Date().toISOString(),
      });
    },
    { invalidate, successMessage: "Sent", onSuccess: onClose },
  );

  const canSendEmail = isEmail && canSend && !!message.contact.email && !terminal;

  const regenerate = (): void => {
    void agent.injectSkill("networking", `--campaign ${campaignId} --rewrite ${message.id}`);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 6 }}>
        {message.contact.name}
        {message.contact.title && (
          <Typography variant="captionMuted" component="div">
            {message.contact.title}
            {message.contact.company ? ` · ${message.contact.company}` : ""}
          </Typography>
        )}
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <Close fontSize="sm" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {isEmail && (
            <TextField
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              fullWidth
              disabled={terminal}
            />
          )}
          <TextField
            label="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            fullWidth
            multiline
            minRows={6}
            disabled={terminal}
            helperText={
              isConnectNote
                ? `${body.length}/300 - LinkedIn connect notes are capped at 300 characters.`
                : undefined
            }
          />
          {!isEmail && !terminal && (
            <Typography variant="captionMuted">
              LinkedIn messages are sent through the agent in the browser - approve here, then run
              the agent to send.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      {!terminal && (
        <DialogActions sx={{ justifyContent: "space-between", px: 3, pb: 2 }}>
          <Stack direction="row" spacing={1}>
            <Button onClick={onSkip} color="warning">
              Skip
            </Button>
            {agentAvailable && <Button onClick={regenerate}>Regenerate</Button>}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => save.mutate()} disabled={save.isPending}>
              Save
            </Button>
            {canSendEmail ? (
              <Button variant="contained" onClick={() => send.mutate()} disabled={send.isPending}>
                Send
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={() => approve.mutate()}
                disabled={approve.isPending}
              >
                Approve
              </Button>
            )}
          </Stack>
        </DialogActions>
      )}
    </Dialog>
  );
}
