"use client";

import { type ReactElement, useState } from "react";
import { isTerminalNetworkingStatus } from "@jobpilot/contracts/networking";
import { Button, Stack, TextField, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { campaignQueries, emailQueries, networkingQueries } from "@/api/queries";
import type { NetworkingMessageDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { FormDialogShell } from "@/components/ui/form";
import { useAgent, useAgentAvailable } from "@/providers/agent-provider";

interface NetworkingMessageDialogProps {
  campaignId: string;
  message: NetworkingMessageDto;
  onClose: () => void;
}

/** Owns every write against one draft, so a caller only decides which draft is open. */
export function NetworkingMessageDialog(props: NetworkingMessageDialogProps): ReactElement {
  const { campaignId, message, onClose } = props;
  const agent = useAgent();
  const agentAvailable = useAgentAvailable();
  const [subject, setSubject] = useState(message.subject ?? "");
  const [body, setBody] = useState(message.body);

  const canSend = useQuery(emailQueries.account()).data?.canSend ?? false;
  const messageApi = api
    .campaigns({ id: campaignId })
    .networking.messages({ messageId: message.id });

  // A draft shows on its campaign (whose detail and summary count drafts) and the cross-campaign list.
  const invalidate = [
    campaignQueries.networkingKey(campaignId),
    campaignQueries.detail(campaignId).queryKey,
    campaignQueries.summary().queryKey,
    networkingQueries.all,
  ];
  const isEmail = message.channel === "email";
  const isConnectNote = message.linkedinKind === "connect_note";
  const terminal = isTerminalNetworkingStatus(message.status);

  const save = useApiMutation(() => messageApi.patch({ subject: subject || null, body }), {
    invalidate,
    successMessage: "Saved",
  });

  const approve = useApiMutation(
    () => messageApi.patch({ subject: subject || null, body, status: "approved" }),
    {
      invalidate,
      successMessage: "Approved",
      onSuccess: () => {
        onClose();
      },
    },
  );

  const send = useApiMutation(
    async () => {
      const sent = await api.email.outbound.post({
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
    {
      invalidate,
      successMessage: "Sent",
      onSuccess: () => {
        onClose();
      },
    },
  );

  const skip = useApiMutation(() => messageApi.result.post({ outcome: "skipped" }), {
    invalidate,
    successMessage: "Skipped",
    onSuccess: () => {
      onClose();
    },
  });

  const canSendEmail = isEmail && canSend && !!message.contact.email && !terminal;

  const regenerate = (): void => {
    void agent.injectSkill("networking", `--campaign ${campaignId} --rewrite ${message.id}`);
    onClose();
  };

  return (
    <FormDialogShell
      open
      title={message.contact.name}
      onClose={onClose}
      onSubmit={() => {
        if (terminal) {
          return;
        }
        if (canSendEmail) {
          send.mutate();
        } else {
          approve.mutate();
        }
      }}
      submit={
        !terminal && (
          <Stack direction="row" spacing={1}>
            <Button onClick={() => skip.mutate()} color="warning" disabled={skip.isPending}>
              Skip
            </Button>
            {agentAvailable && <Button onClick={regenerate}>Regenerate</Button>}
            <Button variant="outlined" onClick={() => save.mutate()} disabled={save.isPending}>
              Save
            </Button>
            {canSendEmail ? (
              <Button type="submit" variant="contained" disabled={send.isPending}>
                Send
              </Button>
            ) : (
              <Button type="submit" variant="contained" disabled={approve.isPending}>
                Approve
              </Button>
            )}
          </Stack>
        )
      }
    >
      {message.contact.title && (
        <Typography variant="captionMuted">
          {message.contact.title}
          {message.contact.company ? ` · ${message.contact.company}` : ""}
        </Typography>
      )}
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
          LinkedIn messages are sent through the agent in the browser - approve here, then run the
          agent to send.
        </Typography>
      )}
    </FormDialogShell>
  );
}
