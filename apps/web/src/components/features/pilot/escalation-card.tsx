"use client";

import { type ReactElement, useState } from "react";
import type { Escalation } from "@jobpilot/contracts/pilot";
import { OpenInNew } from "@mui/icons-material";
import { Button, Card, CardContent, Link, Stack, TextField, Typography } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";

interface EscalationCardProps {
  escalation: Escalation;
}

export function EscalationCard(props: EscalationCardProps): ReactElement {
  const { escalation } = props;
  const [freeText, setFreeText] = useState("");

  const answer = useApiMutation<unknown, string>(
    (value) => api.pilot.escalations({ id: escalation.id }).answer.post({ answer: value }),
    { invalidate: [[...queryKeys.pilot.all, "escalations"]], successMessage: "Answer sent." },
  );

  const hasOptions = escalation.options.length > 0;
  const busy = answer.isPending;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
            <Typography variant="subtitle2">{escalation.question}</Typography>
            <Typography variant="captionMuted" sx={{ textTransform: "capitalize" }}>
              {escalation.kind}
            </Typography>
          </Stack>

          {escalation.deepLink && (
            <Link
              href={escalation.deepLink}
              target="_blank"
              rel="noopener"
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
            >
              <OpenInNew fontSize="sm" />
              Open link
            </Link>
          )}

          {hasOptions ? (
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              {escalation.options.map((option) => (
                <Button
                  key={option}
                  variant="outlined"
                  size="small"
                  disabled={busy}
                  onClick={() => answer.mutate(option)}
                >
                  {option}
                </Button>
              ))}
            </Stack>
          ) : (
            <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                size="small"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Type your answer"
              />
              <Button
                variant="contained"
                size="small"
                disabled={busy || freeText.trim().length === 0}
                onClick={() => answer.mutate(freeText.trim())}
              >
                Send
              </Button>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
