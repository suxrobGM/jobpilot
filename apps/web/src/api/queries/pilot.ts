import { DEFAULT_CURSOR_PAGE_SIZE, type PaginationQuery } from "@jobpilot/contracts/pagination";
import type {
  PilotJournalKind,
  PilotQuestionStatus,
  PromotionStatus,
} from "@jobpilot/contracts/pilot";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { api } from "@/api/client";
import { unwrap } from "@/api/error";
import { OPTIONS_PAGE } from "./shared";

const PILOT = ["pilot"] as const;
const JOURNAL = [...PILOT, "journal"] as const;
const QUESTIONS = [...PILOT, "questions"] as const;
const PROMOTIONS = [...PILOT, "promotions"] as const;
const PUSH = [...PILOT, "push"] as const;

function journalQuery(kinds: PilotJournalKind[], cursor: string | null) {
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
  questionsAll: QUESTIONS,
  promotionsAll: PROMOTIONS,
  pushAll: PUSH,
  state: () =>
    queryOptions({ queryKey: [...PILOT, "state"], queryFn: () => unwrap(api.pilot.get()) }),
  todayOutcomes: () =>
    queryOptions({
      queryKey: [...PILOT, "today-outcomes"],
      queryFn: () => unwrap(api.pilot.stats.today.get()),
    }),
  cost: () =>
    queryOptions({
      queryKey: [...PILOT, "cost"],
      queryFn: () => unwrap(api.pilot.stats.cost.get()),
    }),
  /** Read-only view of the pilot's self-managed discovery searches. */
  searches: () =>
    queryOptions({
      queryKey: [...PILOT, "searches"],
      queryFn: () => unwrap(api.pilot.searches.get()),
    }),
  savedAnswers: () =>
    queryOptions({
      queryKey: [...PILOT, "savedAnswers"],
      queryFn: () => unwrap(api.pilot["saved-answers"].get()),
    }),
  /** What an instructions edit would leave running; read on demand, never prefetched. */
  instructionsImpact: () =>
    queryOptions({
      queryKey: [...PILOT, "instructions-impact"],
      queryFn: () => unwrap(api.pilot.instructions.impact.get()),
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
  /** Mount-fetch + manual refresh only; live events never invalidate it (building it is costly). */
  taskList: () =>
    queryOptions({
      queryKey: [...PILOT, "task-list"],
      queryFn: async () => (await unwrap(api.pilot.tasks.get())).taskList ?? null,
    }),
  // Sorted so the same filter set toggled in a different order shares one cache entry.
  journal: (kinds: PilotJournalKind[] = []) => {
    const filter = [...kinds].sort();
    return queryOptions({
      queryKey: [...JOURNAL, { kinds: filter }],
      queryFn: () => unwrap(journalQuery(filter, null)),
    });
  },
  /** The journal tab's pages, older ones loaded on demand by cursor. */
  journalFeed: (kinds: PilotJournalKind[]) => {
    const filter = [...kinds].sort();
    return infiniteQueryOptions({
      queryKey: [...JOURNAL, "feed", { kinds: filter }],
      queryFn: ({ pageParam }) => unwrap(journalQuery(filter, pageParam)),
      initialPageParam: null as string | null,
      getNextPageParam: (page) => page.nextCursor,
    });
  },
  questions: (status?: PilotQuestionStatus) =>
    queryOptions({
      queryKey: [...QUESTIONS, { status: status ?? "all" }],
      queryFn: () => unwrap(api.pilot.questions.get({ query: status ? { status } : {} })),
    }),
  promotions: (status?: PromotionStatus, page: PaginationQuery = OPTIONS_PAGE) =>
    queryOptions({
      queryKey: [...PROMOTIONS, { status: status ?? "all", ...page }],
      queryFn: () =>
        unwrap(api.pilot.promotions.get({ query: { ...page, ...(status && { status }) } })),
    }),
  pushKey: () =>
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
