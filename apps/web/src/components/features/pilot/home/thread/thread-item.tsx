"use client";

import type { ReactElement } from "react";
import type { PilotThreadItem } from "@jobpilot/contracts/pilot";
import { AskedRow } from "./asked-row";
import { ChangeRow } from "./change-row";
import { DigestTurn } from "./digest-turn";
import { MessageTurn } from "./message-turn";
import { NoteRow } from "./note-row";
import { RequestRow } from "./request-row";
import { WorkTurn } from "./work-turn";

interface ThreadItemProps {
  item: PilotThreadItem;
  /** Identical notes in a row collapse into one; see `collapseRepeats` in the thread. */
  repeats: number;
}

/** Open questions and proposals stay one line here; their cards wait in the Needs you queue. */
export function ThreadItem(props: ThreadItemProps): ReactElement {
  const { item, repeats } = props;
  switch (item.type) {
    case "work":
      return <WorkTurn item={item} />;
    case "question":
      return <AskedRow question={item.question} />;
    case "message":
      return <MessageTurn message={item.message} />;
    case "request":
      return <RequestRow request={item.request} />;
    case "change":
      return <ChangeRow change={item.change} />;
    case "digest":
      return <DigestTurn entry={item.entry} />;
    case "note":
      return <NoteRow entry={item.entry} repeats={repeats} />;
  }
}
