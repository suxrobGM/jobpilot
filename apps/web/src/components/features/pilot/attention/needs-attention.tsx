"use client";

import { type ReactElement, useState } from "react";
import type { Promotion } from "@jobpilot/contracts/pilot";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { QuerySection } from "@/components/ui/data";
import { RelativeTime } from "@/components/ui/display";
import { SectionCard } from "@/components/ui/layout";
import { PromotionDraftCard, PromotionSummary } from "./promotion-card";
import { QuestionCard } from "./question-card";
import { useOpenQuestions } from "./use-open-questions";

interface DraftRowProps {
  promotion: Promotion;
  expanded: boolean;
  onToggle: () => void;
}

function DraftRow(props: DraftRowProps): ReactElement {
  const { promotion, expanded, onToggle } = props;
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Chip color="primary" label={promotion.platform} />
        {promotion.target && <Chip variant="outlined" label={promotion.target} />}
        <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
          {promotion.title ?? promotion.body}
        </Typography>
        <RelativeTime value={promotion.createdAt} sx={{ whiteSpace: "nowrap" }} />
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

export function NeedsAttention(): ReactElement {
  const questionsQuery = useOpenQuestions();
  const { questions } = questionsQuery;

  // Drafts are server-filtered so an aging one can't fall off the page; history may.
  const draftsQuery = useApiQuery(pilotQueries.promotions("draft"));
  const historyQuery = useApiQuery(pilotQueries.promotions());
  // `undefined` = no user choice yet, so a lone draft starts expanded.
  const [userExpanded, setUserExpanded] = useState<string | null | undefined>(undefined);
  const [historyOpen, setHistoryOpen] = useState(false);

  const drafts = draftsQuery.data?.items ?? [];
  const history = (historyQuery.data?.items ?? []).filter((p) => p.status !== "draft");

  const loneDraftId = drafts.length === 1 ? (drafts[0]?.id ?? null) : null;
  const expandedId = userExpanded === undefined ? loneDraftId : userExpanded;

  const count = questions.length + drafts.length;
  const loading = questionsQuery.isLoading || draftsQuery.isLoading;
  const isError = questionsQuery.isError || draftsQuery.isError;

  const retry = (): void => {
    questionsQuery.refetch();
    void draftsQuery.refetch();
    void historyQuery.refetch();
  };

  const postHistory = history.length > 0 && (
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
        <Stack spacing={1.5} divider={<Divider />} sx={{ mt: 1.5 }}>
          {history.map((promotion) => (
            <PromotionSummary key={promotion.id} promotion={promotion} />
          ))}
        </Stack>
      </Collapse>
    </Box>
  );

  // All clear shrinks to one line, so the overview's live sections stay above the fold.
  if (!loading && !isError && count === 0) {
    return (
      <Stack spacing={1}>
        <Alert severity="success" variant="outlined">
          Nothing needs your attention.
        </Alert>
        {postHistory}
      </Stack>
    );
  }

  return (
    <SectionCard
      title="Needs attention"
      actions={count > 0 && <Chip color="warning" label={count} />}
    >
      <Stack spacing={2}>
        <QuerySection
          isLoading={loading}
          isError={isError}
          onRetry={retry}
          errorTitle="Couldn't load what needs your attention."
          isEmpty={false}
          empty={null}
        >
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
        </QuerySection>
        {!loading && !isError && postHistory}
      </Stack>
    </SectionCard>
  );
}
