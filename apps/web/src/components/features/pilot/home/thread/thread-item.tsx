"use client";

import type { ReactElement } from "react";
import type { PilotThreadItem } from "@jobpilot/contracts/pilot";
import { PromotionDraftCard, PromotionSummary } from "../../attention/promotion-card";
import { QuestionCard } from "../../attention/question-card";
import { ChangeCard } from "../../changes/change-card";
import { AskedRow } from "./asked-row";
import { DigestCard } from "./digest-card";
import { MessageBubble } from "./message-bubble";
import { NoteRow } from "./note-row";
import { RequestRow } from "./request-row";
import { WorkCard } from "./work-card";

interface ThreadItemProps {
  item: PilotThreadItem;
}

export function ThreadItem(props: ThreadItemProps): ReactElement {
  const { item } = props;
  switch (item.type) {
    case "work":
      return <WorkCard item={item} />;
    case "question":
      return item.question.status === "open" ? (
        <QuestionCard question={item.question} />
      ) : (
        <AskedRow question={item.question} />
      );
    case "promotion":
      return item.promotion.status === "draft" ? (
        <PromotionDraftCard promotion={item.promotion} />
      ) : (
        <PromotionSummary promotion={item.promotion} />
      );
    case "message":
      return <MessageBubble message={item.message} />;
    case "request":
      return <RequestRow request={item.request} />;
    case "change":
      return <ChangeCard change={item.change} />;
    case "digest":
      return <DigestCard entry={item.entry} />;
    case "note":
      return <NoteRow entry={item.entry} />;
  }
}
