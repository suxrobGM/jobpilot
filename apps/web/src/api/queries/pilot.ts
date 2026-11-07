import { DEFAULT_CURSOR_PAGE_SIZE } from "@jobpilot/contracts/pagination";
import type { PilotChange, PilotJournalKind, PilotQuestionStatus } from "@jobpilot/contracts/pilot";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { api } from "@/api/client";
import { unwrap } from "@/api/error";

const PILOT = ["pilot"] as const;
const JOURNAL = [...PILOT, "journal"] as const;
const THREAD = [...PILOT, "thread"] as const;
const CHANGES = [...PILOT, "changes"] as const;
const QUESTIONS = [...PILOT, "questions"] as const;
const PUSH = [...PILOT, "push"] as const;

function requestJournalPage(kinds: PilotJournalKind[], cursor: string | null) {
  return api.pilot.journal.get({
    query: {
      limit: DEFAULT_CURSOR_PAGE_SIZE,
      ...(cursor ? { cursor } : {}),
      ...(kinds.length > 0 ? { kinds } : {}),
    },
  });
}

export const pilotQueries = {
  all: PILOT,
  journalAll: JOURNAL,
  threadAll: THREAD,
  changesAll: CHANGES,
  questionsAll: QUESTIONS,
  pushAll: PUSH,
  state: () =>
    queryOptions({ queryKey: [...PILOT, "state"], queryFn: () => unwrap(api.pilot.get()) }),
  cost: () =>
    queryOptions({
      queryKey: [...PILOT, "cost"],
      queryFn: () => unwrap(api.pilot.stats.cost.get()),
    }),
  /** What a `jobs.skipApproved` change would skip now. */
  approvedJobCount: () =>
    queryOptions({
      queryKey: [...CHANGES, "approvedJobs"],
      queryFn: () => unwrap(api.pilot.changes["approved-jobs"].get()),
    }),
  /** The pilot's searches, with what each applied to this week. */
  searches: () =>
    queryOptions({
      queryKey: [...PILOT, "searches"],
      queryFn: () => unwrap(api.feeds.get({ query: { kind: "search" } })),
    }),
  /** A run's live steps so far; `run.steps` events append to it. */
  runSteps: (runId: string) =>
    queryOptions({
      queryKey: [...PILOT, "runs", runId, "steps"],
      queryFn: () => unwrap(api.pilot.runs({ id: runId }).steps.get()),
    }),
  notices: () =>
    queryOptions({
      queryKey: [...PILOT, "notices"],
      queryFn: () => unwrap(api.pilot.notices.get()),
    }),
  savedAnswers: () =>
    queryOptions({
      queryKey: [...PILOT, "savedAnswers"],
      queryFn: () => unwrap(api.pilot["saved-answers"].get()),
    }),
  jobAlerts: () =>
    queryOptions({
      queryKey: [...PILOT, "job-alerts"],
      queryFn: () => unwrap(api.pilot["job-alerts"].get()),
    }),
  research: () =>
    queryOptions({
      queryKey: [...PILOT, "research"],
      queryFn: () => unwrap(api.pilot.research.get()),
    }),
  /** One fetch plus manual refresh; live events never invalidate it (building it is costly). */
  taskList: () =>
    queryOptions({
      queryKey: [...PILOT, "task-list"],
      queryFn: async () => (await unwrap(api.pilot.tasks.get())).taskList ?? null,
      staleTime: Number.POSITIVE_INFINITY,
      retry: false,
    }),
  // Sorted so the same filter set toggled in a different order shares one cache entry.
  journalFeed: (kinds: PilotJournalKind[]) => {
    const filter = [...kinds].sort();
    return infiniteQueryOptions({
      queryKey: [...JOURNAL, { kinds: filter }],
      queryFn: ({ pageParam }) => unwrap(requestJournalPage(filter, pageParam)),
      initialPageParam: null as string | null,
      getNextPageParam: (page) => page.nextCursor,
    });
  },
  changes: (status?: PilotChange["status"]) =>
    queryOptions({
      queryKey: [...CHANGES, { status: status ?? "all" }],
      queryFn: () => unwrap(api.pilot.changes.get({ query: status ? { status } : {} })),
    }),
  /** Newest page first; the thread renders the pages reversed. */
  thread: () =>
    infiniteQueryOptions({
      queryKey: THREAD,
      queryFn: ({ pageParam }) =>
        unwrap(
          api.pilot.thread.get({
            query: { limit: DEFAULT_CURSOR_PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
          }),
        ),
      initialPageParam: null as string | null,
      getNextPageParam: (page) => page.nextCursor,
    }),
  questions: (status?: PilotQuestionStatus) =>
    queryOptions({
      queryKey: [...QUESTIONS, { status: status ?? "all" }],
      queryFn: () => unwrap(api.pilot.questions.get({ query: status ? { status } : {} })),
    }),
  vapidKey: () =>
    queryOptions({
      queryKey: [...PUSH, "vapid-key"],
      queryFn: () => unwrap(api["web-push"]["vapid-key"].get()),
    }),
  pushDevices: () =>
    queryOptions({
      queryKey: [...PUSH, "devices"],
      queryFn: () => unwrap(api["web-push"].subscriptions.get()),
    }),
};
