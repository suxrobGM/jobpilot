"use client";

import type { ReactElement } from "react";
import type { PilotThreadItem } from "@jobpilot/contracts/pilot";
import { AskedRow } from "./asked-row";
import { ChangeRow } from "./change-row";
import { MessageTurn } from "./message-turn";
import { RequestRow } from "./request-row";
import { WorkTurn } from "./work-turn";

interface ThreadItemProps {
  item: PilotThreadItem;
}

/** Open questions and proposals stay one line here; their cards wait in the Needs you queue. */
export function ThreadItem(props: ThreadItemProps): ReactElement {
  const { item } = props;
  switch (item.type) {
    case "work":
      return <WorkTurn item={item} />;
    case "question":
      return <AskedRow question={item.question} />;
    case "message":
      return <MessageTurn message={item.message} />;
    case "request":
      return <RequestRow request={item.request} job={item.job} />;
    case "change":
      return <ChangeRow change={item.change} />;
  }
}
