// Question consumption + payload enrichment through AgendaService.refresh (fake Prisma, no DB).

import { service } from "./compile.test-helpers";
import { describe, expect, it } from "bun:test";

describe("AgendaService question consumption", () => {
  it("keeps an answered question on the agenda until a claim references it", async () => {
    const agenda = await service({
      answered: [{ id: "E1", kind: "question", prompt: "Which date?" }],
    }).refresh("p1");
    expect(agenda.items.map((i) => i.kind)).toContain("question.answered");
  });

  it("drops an answered question once a claim has referenced it", async () => {
    const agenda = await service({
      answered: [{ id: "E1", kind: "question", prompt: "Which date?" }],
      questionClaims: [{ subjectId: "E1" }],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "question.answered")).toBe(false);
  });
});

describe("AgendaService question enrichment", () => {
  it("carries the question subject and Q/A into the answered payload", async () => {
    const agenda = await service({
      answered: [
        {
          id: "E1",
          kind: "approval",
          prompt: "Send this reply?",
          subjectType: "email",
          subjectId: "em1",
          answer: "yes",
        },
      ],
    }).refresh("p1");
    const item = agenda.items.find((i) => i.kind === "question.answered");
    expect(item?.payload).toEqual({
      questionId: "E1",
      questionKind: "approval",
      subjectType: "email",
      subjectId: "em1",
      prompt: "Send this reply?",
      answer: "yes",
    });
  });
});
