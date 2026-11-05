"use client";

import type { ReactElement } from "react";
import { isNotFound } from "@/api/error";
import { EmptyState } from "./empty-state";
import { QueryError } from "./query-error";

interface DetailLoadFailureProps {
  /** Lowercase, as in "Couldn't load this campaign." */
  noun: string;
  error: unknown;
  onRetry: () => void;
}

/** A detail page's query settled without data: a 404 is a dead link, anything else can retry. */
export function DetailLoadFailure(props: DetailLoadFailureProps): ReactElement {
  const { noun, error, onRetry } = props;

  if (isNotFound(error)) {
    return (
      <EmptyState
        title={`${noun.charAt(0).toUpperCase()}${noun.slice(1)} not found`}
        description="It may have been deleted, or the link is incorrect."
      />
    );
  }

  return <QueryError title={`Couldn't load this ${noun}.`} onRetry={onRetry} />;
}
