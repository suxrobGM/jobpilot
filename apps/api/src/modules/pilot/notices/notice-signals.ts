import type { PilotNotice } from "@jobpilot/contracts/pilot";
import { DAY_MS } from "@/common/date/buckets";

export const STALE_MAIL_MS = 2 * DAY_MS;
export const OUTCOMES_WINDOW_MS = 21 * DAY_MS;
export const NEAR_MISS_WINDOW_MS = 14 * DAY_MS;
export const CAP_WINDOW_MS = 7 * DAY_MS;
export const NEAR_MISS_BAND = 5;

const OUTCOMES_MIN_APPLICATIONS = 25;
const NEAR_MISS_MIN_JOBS = 10;
const CAP_USED_SHARE = 0.25;

export interface NoticeFacts {
  /** Active searches with no board of their own while no board is checked: they can't run. */
  boardlessSearches: number;
  email: "connected" | "reconnect" | "missing";
  /** Unclassified mail older than two days. */
  staleMail: number;
  recentApplications: number;
  /** Of those, how many reached screening, interviewing or an offer. */
  progressed: number;
  recruiterReplies: number;
  /** Jobs scored within the band just below the min score. */
  nearMisses: number;
  minScore: number;
  dailyApplyCap: number;
  autopilotSince: Date | null;
  appliedLastWeek: number;
  approvedWaiting: number;
}

function boardsNotice(boardlessSearches: number): PilotNotice | null {
  if (boardlessSearches === 0) {
    return null;
  }
  const searches = boardlessSearches === 1 ? "1 search" : `${boardlessSearches} searches`;
  return {
    key: "boards.none",
    title: "No boards to search",
    body: `${searches} can't run until you check at least one board for the pilot to search.`,
    action: { kind: "link", label: "Pick boards", href: "/boards" },
  };
}

function emailNotice(email: NoticeFacts["email"]): PilotNotice | null {
  if (email === "connected") {
    return null;
  }
  const reconnect = email === "reconnect";
  return {
    key: "email.missing",
    title: reconnect ? "Your email needs reconnecting" : "Connect your email",
    body: "Without it the pilot can't see replies, interview invites or verification codes.",
    action: { kind: "link", label: reconnect ? "Reconnect" : "Connect", href: "/settings/email" },
  };
}

function inboxNotice(staleMail: number): PilotNotice | null {
  if (staleMail === 0) {
    return null;
  }
  return {
    key: "inbox.unread",
    title: `${staleMail} ${staleMail === 1 ? "email" : "emails"} the pilot hasn't read yet`,
    body: "Some have waited over two days, so replies to your applications may be missed.",
    action: {
      kind: "request",
      label: "Review inbox",
      request: { taskType: "inbox.review", payload: {} },
    },
  };
}

function outcomesNotice(facts: NoticeFacts): PilotNotice | null {
  const quiet = facts.progressed === 0 && facts.recruiterReplies === 0;
  if (facts.recentApplications < OUTCOMES_MIN_APPLICATIONS || !quiet) {
    return null;
  }
  return {
    key: "outcomes.none",
    title: "No replies from your recent applications",
    body: `${facts.recentApplications} applications in three weeks and none moved forward.`,
    action: {
      kind: "message",
      label: "Ask why",
      body: "Look at my last 25 applications and tell me why I'm not getting replies.",
    },
  };
}

function nearMissNotice(facts: NoticeFacts): PilotNotice | null {
  const lower = Math.max(0, facts.minScore - NEAR_MISS_BAND);
  if (facts.nearMisses < NEAR_MISS_MIN_JOBS || lower === facts.minScore) {
    return null;
  }
  return {
    key: "score.nearMiss",
    title: `${facts.nearMisses} jobs just missed your score`,
    body: `They scored ${lower}–${facts.minScore - 1} in the last two weeks, below your ${facts.minScore}.`,
    action: {
      kind: "change",
      label: `Lower to ${lower}`,
      summary: `Lower the min score to ${lower}`,
      actions: [{ type: "rules.set", minScore: lower }],
    },
  };
}

function capNotice(facts: NoticeFacts, now: Date): PilotNotice | null {
  const since = facts.autopilotSince;
  const longEnough = since !== null && now.getTime() - since.getTime() >= CAP_WINDOW_MS;
  const perDay = facts.appliedLastWeek / 7;
  const underused = facts.dailyApplyCap > 0 && perDay < facts.dailyApplyCap * CAP_USED_SHARE;
  if (!longEnough || !underused || facts.approvedWaiting > 0) {
    return null;
  }
  return {
    key: "cap.unused",
    title: "The pilot is running out of jobs",
    body: `About ${Math.round(perDay)} a day this week against your cap of ${facts.dailyApplyCap}.`,
    action: { kind: "message", label: "Find more", body: "Find more jobs that fit my goals." },
  };
}

/** In order; a signal waits while an earlier one says its data can't be trusted. */
export function buildNotices(facts: NoticeFacts, now: Date): PilotNotice[] {
  const email = emailNotice(facts.email);
  const inbox = email ? null : inboxNotice(facts.staleMail);
  // Outcomes come from the inbox, so they wait until it's connected and read.
  const outcomes = email || inbox ? null : outcomesNotice(facts);
  const boards = boardsNotice(facts.boardlessSearches);
  const notices = [boards, email, inbox, outcomes, nearMissNotice(facts), capNotice(facts, now)];
  return notices.filter((notice) => notice !== null);
}
