import type { ActionContext, ChangeTx } from "./action-context";

interface FakeSearch {
  id: string;
  userId: string;
  name: string;
  query: string;
  boardId: string | null;
  resumeId: string | null;
  reason: string;
  pausedAt: Date | null;
  archivedAt: Date | null;
}

interface FakeJob {
  id: string;
  feedId: string;
  key: string;
  status: string;
  skipReason: string | null;
}

export interface FakeState {
  config: Record<string, unknown>;
  searches: FakeSearch[];
  jobs: FakeJob[];
  answers: Map<string, string>;
}

type Where = Record<string, unknown>;

function statusMatches(status: string, filter: unknown): boolean {
  if (filter === undefined) {
    return true;
  }
  if (typeof filter === "string") {
    return status === filter;
  }
  return (filter as { in: string[] }).in.includes(status);
}

/** Just the Prisma calls the change actions make, over plain arrays. */
function fakeTx(state: FakeState): ChangeTx {
  let nextId = 0;
  const findSearch = (where: Where) =>
    state.searches.find((s) => {
      if (s.archivedAt !== null) {
        return false;
      }
      const notId = (where.id as { not?: string } | undefined)?.not;
      if (typeof where.id === "string" && s.id !== where.id) {
        return false;
      }
      if (notId && s.id === notId) {
        return false;
      }
      if (where.query !== undefined && s.query !== where.query) {
        return false;
      }
      if (where.boardId !== undefined && s.boardId !== where.boardId) {
        return false;
      }
      return true;
    }) ?? null;
  const jobMatches = (job: FakeJob, where: Where) => {
    const refs = where.OR as { feedId: string; key: string }[] | undefined;
    const ids = (where.id as { in: string[] } | undefined)?.in;
    if (refs && !refs.some((r) => r.feedId === job.feedId && r.key === job.key)) {
      return false;
    }
    if (ids && !ids.includes(job.id)) {
      return false;
    }
    if (typeof where.key === "string" && (job.key !== where.key || job.feedId !== where.feedId)) {
      return false;
    }
    return statusMatches(job.status, where.status);
  };

  const tx = {
    pilotState: {
      upsert: async () => ({ config: state.config }),
      update: async ({ data }: { data: { config?: Record<string, unknown> } }) => {
        if (data.config !== undefined) {
          state.config = data.config;
        }
        return {};
      },
    },
    // Search feeds only: every change action reads and writes searches.
    feed: {
      findFirst: async ({ where }: { where: Where }) => {
        const search = findSearch(where);
        return (
          search && {
            ...search,
            board: search.boardId ? { domain: `${search.boardId}.test` } : null,
          }
        );
      },
      create: async ({ data }: { data: Omit<FakeSearch, "id" | "pausedAt" | "archivedAt"> }) => {
        const search = { ...data, id: `search-${++nextId}`, pausedAt: null, archivedAt: null };
        state.searches.push(search);
        return search;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeSearch> }) => {
        const search = state.searches.find((s) => s.id === where.id);
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined && key in (search ?? {})) {
            Object.assign(search ?? {}, { [key]: value });
          }
        }
        return search;
      },
      updateMany: async () => ({ count: state.searches.length }),
      count: async () => state.searches.filter((s) => s.archivedAt === null).length,
    },
    job: {
      findMany: async ({ where }: { where: Where }) =>
        state.jobs.filter((j) => jobMatches(j, where)).map((job) => ({ ...job })),
      updateMany: async ({ where, data }: { where: Where; data: Partial<FakeJob> }) => {
        const hits = state.jobs.filter((j) => jobMatches(j, where));
        for (const job of hits) {
          Object.assign(job, data);
        }
        return { count: hits.length };
      },
    },
    profileAnswer: {
      findUnique: async ({ where }: { where: { userId_key: { key: string } } }) => {
        const value = state.answers.get(where.userId_key.key);
        return value === undefined ? null : { value };
      },
      upsert: async ({ create }: { create: { key: string; value: string } }) => {
        state.answers.set(create.key, create.value);
        return {};
      },
      delete: async ({ where }: { where: { userId_key: { key: string } } }) => {
        state.answers.delete(where.userId_key.key);
        return {};
      },
    },
    pilotRun: { deleteMany: async () => ({ count: 0 }) },
    userJobBoard: { upsert: async () => ({}) },
  };
  return tx as unknown as ChangeTx;
}

export function fakeContext(state: FakeState): ActionContext {
  return {
    tx: fakeTx(state),
    userId: "u1",
    now: new Date(),
    boardIds: new Map([["board-1.test", "board-1"]]),
    afterCommit: [],
  };
}
