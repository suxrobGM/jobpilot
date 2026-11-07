import type { Route } from "next";

// Typed routes can't see a template literal, so each dynamic page casts once, here.
/** A search or feed's jobs: the Pipeline filtered to its feed. */
export function pipelineHref(feedId: string): Route {
  return `/pipeline?feed=${encodeURIComponent(feedId)}` as Route;
}

export function applicationHref(applicationId: string): Route {
  return `/applications/${encodeURIComponent(applicationId)}` as Route;
}

/** The inbox list; `listQuery` is its `?filter=&page=` string, kept so Back lands on the same view. */
export function inboxHref(listQuery: string): Route {
  return (listQuery ? `/inbox?${listQuery}` : "/inbox") as Route;
}

/** One message, carrying the list query it was opened from for Back and next/previous. */
export function messageHref(messageId: string, listQuery: string): Route {
  const path = `/inbox/${encodeURIComponent(messageId)}`;
  return (listQuery ? `${path}?${listQuery}` : path) as Route;
}

export function resumeHref(resumeId: string): Route {
  return `/resumes/${encodeURIComponent(resumeId)}` as Route;
}

export function coverLetterHref(coverLetterId: string): Route {
  return `/cover-letters/${encodeURIComponent(coverLetterId)}` as Route;
}

export function proposalHref(proposalId: string): Route {
  return `/upwork/${encodeURIComponent(proposalId)}` as Route;
}

export function jobHref(slug: string): Route {
  return `/jobs/${encodeURIComponent(slug)}` as Route;
}

export function profileHref(username: string): Route {
  return `/u/${encodeURIComponent(username)}` as Route;
}
