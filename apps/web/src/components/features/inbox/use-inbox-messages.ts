"use client";

import { REVIEW_STATUSES } from "@jobpilot/contracts/email";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { emailQueries } from "@/api/queries";
import type { EmailMessageDto } from "@/api/types";
import { usePaginationParams } from "@/hooks/use-pagination";
import { enumParam } from "@/utils/search-params";

/** Shared with the message page, for next/previous. */
export function useInboxMessages(enabled = true) {
  const searchParams = useSearchParams();
  const filter = enumParam(REVIEW_STATUSES, searchParams.get("filter"));
  const pagination = usePaginationParams();
  const query = useQuery({ ...emailQueries.messages(filter, pagination.query), enabled });
  const listQuery = searchParams.toString();
  return { query, filter, pagination, listQuery };
}

interface SplitMessages {
  relevant: EmailMessageDto[];
  irrelevant: EmailMessageDto[];
}

/** Next/previous follow this order too. */
export function splitIrrelevant(messages: EmailMessageDto[]): SplitMessages {
  return {
    relevant: messages.filter((message) => message.classification !== "irrelevant"),
    irrelevant: messages.filter((message) => message.classification === "irrelevant"),
  };
}
