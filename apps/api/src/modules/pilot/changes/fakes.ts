import type { ActionContext, ChangeTx } from "./action-context";

interface FakeSearch {
  id: string;
  userId: string;
  name: string;
  query: string;
  boardId: string | null;
  resumeId: string | null;
  reason: string;
}

interface FakeCampaign {
  id: string;
  pilotSearchId: string | null;
  status: string;
}

interface FakeJob {
  id: string;
  campaignId: string;
  key: string;
  status: string;
  skipReason: string | null;
}

export interface FakeState {
  goals: string;
  config: Record<string, unknown>;
  searches: FakeSearch[];
  campaigns: FakeCampaign[];
  jobs: FakeJob[];
  answers: Map<string, string>;
}

type Where = Record<string, unknown>;

function statusMatches(status: string, filter: unknown): boolean {
  if (filter === undefined) return true;
  if (typeof filter === "string") return status === filter;
  return (filter as { in: string[] }).in.includes(status);
}

/** Just the Prisma calls the change actions make, over plain arrays. */
function fakeTx(state: FakeState): ChangeTx {
  let nextId = 0;
  const findSearch = (where: Where) =>
    state.searches.find((s) => {
      const notId = (where.id as { not?: string } | undefined)?.not;
      if (typeof where.id === "string" && s.id !== where.id) return false;
      if (notId && s.id === notId) return false;
      if (where.query !== undefined && s.query !== where.query) return false;
      if (where.boardId !== undefined && s.boardId !== where.boardId) return false;
      return true;
    }) ?? null;
  const jobMatches = (job: FakeJob, where: Where) => {
    const refs = where.OR as { campaignId: string; key: string }[] | undefined;
    const ids = (where.id as { in: string[] } | undefined)?.in;
    if (refs && !refs.some((r) => r.campaignId === job.campaignId && r.key === job.key))
      return false;
    if (ids && !ids.includes(job.id)) return false;
    if (
      typeof where.key === "string" &&
      (job.key !== where.key || job.campaignId !== where.campaignId)
    )
      return false;
    return statusMatches(job.status, where.status);
  };

  const tx = {
    pilotState: {
      upsert: async () => ({ goals: state.goals, config: state.config }),
      update: async ({ data }: { data: { goals?: string; config?: Record<string, unknown> } }) => {
        if (data.goals !== undefined) state.goals = data.goals;
        if (data.config !== undefined) state.config = data.config;
        return {};
      },
    },
    pilotSearch: {
      findFirst: async ({ where }: { where: Where }) => {
        const search = findSearch(where);
        return (
          search && {
            ...search,
            board: search.boardId ? { domain: `${search.boardId}.test` } : null,
          }
        );
      },
      create: async ({ data }: { data: Omit<FakeSearch, "id"> }) => {
        const search = { ...data, id: `search-${++nextId}` };
        state.searches.push(search);
        return search;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeSearch> }) => {
        const search = state.searches.find((s) => s.id === where.id);
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined && key in (search ?? {}))
            Object.assign(search ?? {}, { [key]: value });
        }
        return search;
      },
      updateMany: async () => ({ count: state.searches.length }),
      delete: async ({ where }: { where: { id: string } }) => {
        state.searches = state.searches.filter((s) => s.id !== where.id);
        // The real foreign key is ON DELETE SET NULL.
        for (const c of state.campaigns) if (c.pilotSearchId === where.id) c.pilotSearchId = null;
        return {};
      },
      count: async () => state.searches.length,
    },
    campaign: {
      updateManyAndReturn: async ({ where, data }: { where: Where; data: { status: string } }) => {
        const moved = state.campaigns.filter(
          (c) => c.pilotSearchId === where.pilotSearchId && statusMatches(c.status, where.status),
        );
        for (const c of moved) c.status = data.status;
        return moved.map((c) => ({ id: c.id, source: "auto_apply" }));
      },
    },
    campaignJob: {
      findMany: async ({ where }: { where: Where }) =>
        state.jobs.filter((j) => jobMatches(j, where)).map((job) => ({ ...job })),
      updateMany: async ({ where, data }: { where: Where; data: Partial<FakeJob> }) => {
        const hits = state.jobs.filter((j) => jobMatches(j, where));
        for (const job of hits) Object.assign(job, data);
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
