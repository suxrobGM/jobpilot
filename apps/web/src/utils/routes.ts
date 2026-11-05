import type { Route } from "next";

// Typed routes can't see a template literal, so each dynamic page casts once, here.
export function campaignHref(campaignId: string): Route {
  return `/campaigns/${encodeURIComponent(campaignId)}` as Route;
}

export function applicationHref(applicationId: string): Route {
  return `/applications/${encodeURIComponent(applicationId)}` as Route;
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
