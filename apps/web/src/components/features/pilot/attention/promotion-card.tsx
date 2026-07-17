"use client";

import { type ReactElement, useState } from "react";
import type { PatchPromotionInput, Promotion, PromotionStatus } from "@jobpilot/contracts/pilot";
import { OpenInNew } from "@mui/icons-material";
import {
  Button,
  Card,
  CardContent,
  Chip,
  type ChipProps,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import { formatRelativeTime } from "@/utils/format";

const STATUS_COLOR: Record<PromotionStatus, ChipProps["color"]> = {
  draft: "warning",
  approved: "info",
  declined: "default",
  posted: "success",
  failed: "error",
  skipped: "default",
  expired: "default",
};

/** Editable draft card: edit title/body, then Save (edits only) or Approve (edits + approval). */
export function PromotionDraftCard(props: { promotion: Promotion }): ReactElement {
  const { promotion } = props;
  const hasTitle = promotion.title !== null;
  const [title, setTitle] = useState(promotion.title ?? "");
  const [body, setBody] = useState(promotion.body);

  const patch = useApiMutation<Promotion, PatchPromotionInput>(
    (input) => api.pilot.promotions({ id: promotion.id }).patch(input),
    { invalidate: [queryKeys.pilot.promotionsAll()] },
  );
  const busy = patch.isPending;

  const edits: PatchPromotionInput = { body, ...(hasTitle ? { title } : {}) };
  const dirty = body !== promotion.body || (hasTitle && title !== (promotion.title ?? ""));
  const canSave = body.trim().length > 0 && (hasTitle ? title.trim().length > 0 : true);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Chip size="small" label={promotion.platform} color="primary" />
            {promotion.target && <Chip size="small" variant="outlined" label={promotion.target} />}
            <Typography variant="captionMuted" sx={{ ml: "auto", whiteSpace: "nowrap" }}>
              {formatRelativeTime(promotion.createdAt)} ago
            </Typography>
          </Stack>

          {hasTitle && (
            <TextField
              label="Title"
              size="small"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
            />
          )}
          <TextField
            label="Body"
            multiline
            minRows={4}
            size="small"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={busy}
          />

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ justifyContent: "flex-end" }}
          >
            <Button
              variant="text"
              size="small"
              disabled={busy || !dirty || !canSave}
              onClick={() => patch.mutate(edits, { onSuccess: (p) => setBody(p.body) })}
            >
              Save
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="inherit"
              disabled={busy}
              onClick={() => patch.mutate({ status: "declined" })}
            >
              Decline
            </Button>
            <Button
              variant="contained"
              size="small"
              disabled={busy || !canSave}
              onClick={() => patch.mutate({ ...edits, status: "approved" })}
            >
              Approve
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Compact read-only row for a non-draft post; links out to the published URL when present. */
export function PromotionSummary(props: { promotion: Promotion }): ReactElement {
  const { promotion } = props;
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <Chip size="small" variant="outlined" label={promotion.platform} sx={{ minWidth: 90 }} />
      <Chip
        size="small"
        label={promotion.status}
        color={STATUS_COLOR[promotion.status]}
        sx={{ textTransform: "capitalize" }}
      />
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
        {promotion.title ?? promotion.body}
      </Typography>
      {promotion.postedUrl && (
        <Link
          href={promotion.postedUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, whiteSpace: "nowrap" }}
        >
          <OpenInNew fontSize="sm" />
          View
        </Link>
      )}
    </Stack>
  );
}
