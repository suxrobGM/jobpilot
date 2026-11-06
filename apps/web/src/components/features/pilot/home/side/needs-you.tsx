"use client";

import { type ReactElement, useState } from "react";
import { ChevronRight } from "@mui/icons-material";
import {
  Dialog,
  DialogContent,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { JobDrawer } from "@/components/features/pipeline/jobs/job-drawer";
import { PromotionDraftCard } from "../../attention/promotion-card";
import { QuestionCard } from "../../attention/question-card";
import { type Pending, useNeedsYou } from "../../attention/use-needs-you";
import { ChangeCard } from "../../changes/change-card";
import { SideSection } from "./side-section";

function pendingLabel(item: Pending): string {
  switch (item.type) {
    case "question":
      return item.question.prompt;
    case "draft":
      return `Approve a ${item.promotion.platform} post`;
    case "change":
      return item.change.summary;
    case "job":
      return `${item.job.title} · ${item.job.company}`;
  }
}

/** Open questions, drafts, proposed changes and parked jobs; each opens its card or the job. */
export function NeedsYou(): ReactElement {
  const items = useNeedsYou();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((item) => item.id === openId) ?? null;
  const close = (): void => setOpenId(null);

  return (
    <SideSection title={`Needs you · ${items.length}`}>
      {items.length === 0 ? (
        <Typography variant="body2Muted">Nothing right now.</Typography>
      ) : (
        <List dense disablePadding>
          {items.map((item) => (
            <ListItemButton key={item.id} onClick={() => setOpenId(item.id)}>
              <ListItemText
                primary={pendingLabel(item)}
                slotProps={{ primary: { noWrap: true, variant: "body2" } }}
              />
              <ChevronRight fontSize="sm" color="action" />
            </ListItemButton>
          ))}
        </List>
      )}
      <Dialog open={open !== null && open.type !== "job"} onClose={close} fullWidth maxWidth="sm">
        <DialogContent>
          {open?.type === "question" && <QuestionCard question={open.question} />}
          {open?.type === "draft" && <PromotionDraftCard promotion={open.promotion} />}
          {open?.type === "change" && <ChangeCard change={open.change} />}
        </DialogContent>
      </Dialog>
      <JobDrawer job={open?.type === "job" ? open.job : null} onClose={close} />
    </SideSection>
  );
}
