"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import type { Promotion } from "@jobpilot/contracts/pilot";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { SectionCard } from "@/components/ui/layout";
import { formatRelativeTime } from "@/utils/format";
import { PromotionDraftCard, PromotionSummary } from "./promotion-card";
import { QuestionCard } from "./question-card";
import { useOpenQuestions } from "./use-open-questions";

interface DraftRowProps {
  promotion: Promotion;
  expanded: boolean;
  onToggle: () => void;
}

/** Collapsed one-liner for a draft post; expands into the full editor on review. */
function DraftRow(props: DraftRowProps): ReactElement {
  const { promotion, expanded, onToggle } = props;
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Chip size="small" color="primary" label={promotion.platform} />
        {promotion.target && <Chip size="small" variant="outlined" label={promotion.target} />}
        <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
          {promotion.title ?? promotion.body}
        </Typography>
        <Typography variant="captionMuted" sx={{ whiteSpace: "nowrap" }}>
          {formatRelativeTime(promotion.createdAt)} ago
        </Typography>
        <IconButton size="small" aria-label="Review draft" onClick={onToggle}>
          {expanded ? <ExpandLess fontSize="sm" /> : <ExpandMore fontSize="sm" />}
        </IconButton>
      </Stack>
      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ mt: 1.5 }}>
          <PromotionDraftCard promotion={promotion} />
        </Box>
      </Collapse>
    </Box>
  );
}

/** One queue for everything blocking the pilot: open questions first, then draft posts. */
export function NeedsAttention(): ReactElement {
  const { questions, isLoading: questionsLoading } = useOpenQuestions();
  // PilotLive already invalidates promotions on SSE events; no subscription needed here.
  const promotionsQuery = useApiQuery(pilotQueries.promotions());
  // `undefined` = no user choice yet, so a lone draft starts expanded.
  const [userExpanded, setUserExpanded] = useState<string | null | undefined>(undefined);
  const [historyOpen, setHistoryOpen] = useState(false);

  const promotions = promotionsQuery.data ?? [];
  const drafts = promotions.filter((p) => p.status === "draft");
  const history = promotions.filter((p) => p.status !== "draft");
  const expandedId =
    userExpanded !== undefined
      ? userExpanded
      : drafts.length === 1
        ? (drafts[0]?.id ?? null)
        : null;
  const count = questions.length + drafts.length;
  const loading = questionsLoading || promotionsQuery.isLoading;

  let body: ReactNode;
  if (loading) {
    body = <LinearProgress />;
  } else if (count === 0) {
    body = <Typography variant="body2Muted">Nothing needs your attention.</Typography>;
  } else {
    body = (
      <Stack spacing={2}>
        {questions.map((question) => (
          <QuestionCard key={question.id} question={question} />
        ))}
        {drafts.map((promotion) => (
          <DraftRow
            key={promotion.id}
            promotion={promotion}
            expanded={expandedId === promotion.id}
            onToggle={() => setUserExpanded(expandedId === promotion.id ? null : promotion.id)}
          />
        ))}
      </Stack>
    );
  }

  return (
    <SectionCard
      title="Needs attention"
      actions={count > 0 ? <Chip size="small" color="warning" label={count} /> : undefined}
    >
      <Stack spacing={2}>
        {body}
        {!loading && history.length > 0 && (
          <Box>
            <Button
              variant="text"
              size="small"
              endIcon={historyOpen ? <ExpandLess fontSize="sm" /> : <ExpandMore fontSize="sm" />}
              onClick={() => setHistoryOpen((open) => !open)}
            >
              Post history ({history.length})
            </Button>
            <Collapse in={historyOpen} unmountOnExit>
              <Stack
                spacing={1.5}
                divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}
                sx={{ mt: 1.5 }}
              >
                {history.map((promotion) => (
                  <PromotionSummary key={promotion.id} promotion={promotion} />
                ))}
              </Stack>
            </Collapse>
          </Box>
        )}
      </Stack>
    </SectionCard>
  );
}
