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
import { ColorChip } from "@/components/ui/display";
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

interface PromotionCardProps {
  promotion: Promotion;
}

/** Save keeps it a draft; Approve sends the same edits along with the approval. */
export function PromotionDraftCard(props: PromotionCardProps): ReactElement {
  const { promotion } = props;
  const hasTitle = promotion.title !== null;
  const [title, setTitle] = useState(promotion.title ?? "");
  const [body, setBody] = useState(promotion.body);

  const patch = useApiMutation(
    (input: PatchPromotionInput) => api.pilot.promotions({ id: promotion.id }).patch(input),
    { invalidate: [queryKeys.pilot.promotionsAll()] },
  );
  const isLoading = patch.isPending;

  const edits: PatchPromotionInput = { body, ...(hasTitle ? { title } : {}) };
  const dirty = body !== promotion.body || (hasTitle && title !== (promotion.title ?? ""));
  const canSave = body.trim().length > 0 && (hasTitle ? title.trim().length > 0 : true);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Chip label={promotion.platform} color="primary" />
            {promotion.target && <Chip variant="outlined" label={promotion.target} />}
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
              disabled={isLoading}
            />
          )}
          <TextField
            label="Body"
            multiline
            minRows={4}
            size="small"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={isLoading}
          />

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ justifyContent: "flex-end" }}
          >
            <Button
              variant="text"
              size="small"
              disabled={isLoading || !dirty || !canSave}
              // Resync both fields, or a server-normalized title keeps `dirty` true forever.
              onClick={() =>
                patch.mutate(edits, {
                  onSuccess: (p) => {
                    setBody(p.body);
                    setTitle(p.title ?? "");
                  },
                })
              }
            >
              Save
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="inherit"
              disabled={isLoading}
              onClick={() => patch.mutate({ status: "declined" })}
            >
              Decline
            </Button>
            <Button
              variant="contained"
              size="small"
              disabled={isLoading || !canSave}
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

export function PromotionSummary(props: PromotionCardProps): ReactElement {
  const { promotion } = props;
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <Chip variant="outlined" label={promotion.platform} sx={{ minWidth: 90 }} />
      <ColorChip
        value={promotion.status}
        colors={STATUS_COLOR}
        variant="filled"
        sx={{ textTransform: "capitalize" }}
      />
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
        {promotion.title ?? promotion.body}
      </Typography>
      {promotion.postedUrl && (
        <Link
          href={promotion.postedUrl}
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, whiteSpace: "nowrap" }}
        >
          <OpenInNew fontSize="sm" />
          View
        </Link>
      )}
    </Stack>
  );
}
