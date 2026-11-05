"use client";

import { type ReactElement, useState } from "react";
import type { PilotQuestion, Promotion } from "@jobpilot/contracts/pilot";
import { ChevronRight } from "@mui/icons-material";
import {
  Dialog,
  DialogContent,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { PromotionDraftCard } from "../../attention/promotion-card";
import { QuestionCard } from "../../attention/question-card";
import { useOpenQuestions } from "../../attention/use-open-questions";
import { SideSection } from "./side-section";

type Pending =
  | { type: "question"; question: PilotQuestion }
  | { type: "draft"; promotion: Promotion };

function pendingId(item: Pending): string {
  return item.type === "question" ? item.question.id : item.promotion.id;
}

function pendingLabel(item: Pending): string {
  if (item.type === "question") {
    return item.question.prompt;
  }
  return `Approve a ${item.promotion.platform} post`;
}

/** Open questions and drafts; each opens its card in a dialog. */
export function NeedsYou(): ReactElement {
  const { questions } = useOpenQuestions();
  const drafts = useQuery(pilotQueries.promotions("draft")).data?.items ?? [];
  const [openId, setOpenId] = useState<string | null>(null);

  const items: Pending[] = [
    ...questions.map((question) => ({ type: "question" as const, question })),
    ...drafts.map((promotion) => ({ type: "draft" as const, promotion })),
  ];
  const open = items.find((item) => pendingId(item) === openId) ?? null;

  return (
    <SideSection title={`Needs you · ${items.length}`}>
      {items.length === 0 ? (
        <Typography variant="body2Muted">Nothing right now.</Typography>
      ) : (
        <List dense disablePadding>
          {items.map((item) => (
            <ListItemButton key={pendingId(item)} onClick={() => setOpenId(pendingId(item))}>
              <ListItemText
                primary={pendingLabel(item)}
                slotProps={{ primary: { noWrap: true, variant: "body2" } }}
              />
              <ChevronRight fontSize="sm" color="action" />
            </ListItemButton>
          ))}
        </List>
      )}
      <Dialog open={open !== null} onClose={() => setOpenId(null)} fullWidth maxWidth="sm">
        <DialogContent>
          {open?.type === "question" && <QuestionCard question={open.question} />}
          {open?.type === "draft" && <PromotionDraftCard promotion={open.promotion} />}
        </DialogContent>
      </Dialog>
    </SideSection>
  );
}
