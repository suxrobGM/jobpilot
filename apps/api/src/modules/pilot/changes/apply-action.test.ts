import { type PilotChangeAction, pilotConfigSchema } from "@jobpilot/contracts/pilot";
import { applyActions } from "./apply-action";
import { type FakeState, fakeContext } from "./fakes";
import { describe, expect, it } from "bun:test";

const FEED = "11111111-1111-4111-8111-111111111111";
const SEARCH = "22222222-2222-4222-8222-222222222222";

function initialState(): FakeState {
  return {
    goals: "ML engineer, new grad",
    config: pilotConfigSchema.parse({ dealBreakers: ["clearance"] }),
    searches: [
      {
        id: SEARCH,
        userId: "u1",
        name: "ML engineer",
        query: "machine learning engineer new grad",
        boardId: "board-1",
        resumeId: null,
        reason: "Matches the goals",
        pausedAt: null,
        archivedAt: null,
      },
    ],
    jobs: [
      { id: "j1", feedId: FEED, key: "k1", status: "approved", skipReason: null },
      { id: "j2", feedId: FEED, key: "k2", status: "pending", skipReason: null },
    ],
    answers: new Map([["visa_sponsorship", "no"]]),
  };
}

/** What a change may touch: live searches without ids, since undoing a delete makes a new one. */
function snapshot(state: FakeState) {
  const live = state.searches.filter((search) => search.archivedAt === null);
  return {
    goals: state.goals,
    config: state.config,
    searches: live.map(({ name, query, boardId, resumeId, reason }) => ({
      name,
      query,
      boardId,
      resumeId,
      reason,
    })),
    jobs: state.jobs.map((job) => ({ ...job })),
    answers: [...state.answers],
  };
}

const CASES: [string, PilotChangeAction][] = [
  ["goals.set", { type: "goals.set", goals: "Research engineer roles in Pittsburgh" }],
  ["rules.set", { type: "rules.set", minScore: 70, dealBreakers: ["clearance", "relocation"] }],
  [
    "search.create",
    { type: "search.create", name: "Labs", query: "university lab engineer", reason: "" },
  ],
  [
    "search.update",
    { type: "search.update", searchId: SEARCH, name: "ML roles", query: "ml engineer" },
  ],
  ["search.delete", { type: "search.delete", searchId: SEARCH }],
  ["answer.set (existing)", { type: "answer.set", key: "visa_sponsorship", value: "yes" }],
  ["answer.set (new)", { type: "answer.set", key: "salary", value: "$120k" }],
  ["answer.delete", { type: "answer.delete", key: "visa_sponsorship" }],
  [
    "jobs.skip",
    {
      type: "jobs.skip",
      refs: [
        { feedId: FEED, key: "k1" },
        { feedId: FEED, key: "k2" },
      ],
      reason: "Goals changed",
    },
  ],
];

describe("change actions", () => {
  for (const [name, action] of CASES) {
    it(`${name}: applies, and its inverse puts the state back`, async () => {
      const state = initialState();
      const before = snapshot(state);
      const undo = await applyActions(fakeContext(state), [action]);
      expect(snapshot(state)).not.toEqual(before);
      await applyActions(fakeContext(state), undo);
      expect(snapshot(state)).toEqual(before);
    });
  }

  it("search.pause pauses the search, and undo resumes it", async () => {
    const state = initialState();
    const undo = await applyActions(fakeContext(state), [
      { type: "search.pause", searchId: SEARCH },
    ]);
    expect(state.searches[0]?.pausedAt).toBeInstanceOf(Date);
    await applyActions(fakeContext(state), undo);
    expect(state.searches[0]?.pausedAt).toBeNull();
  });
});
