import type { PrismaClient } from "@/generated/prisma/client";
import { buildTaskList } from "./build";
import { base, job, question } from "./builders";
import { gatherChat } from "./gather-requests";
import { makeTask } from "./task-defs";
import { describe, expect, it } from "bun:test";

const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";
const chat = makeTask("chat.reply", { messageId: MESSAGE_ID });
const request = { ...makeTask("upwork.profile", { mode: "review" }), priority: 1050 };

describe("buildTaskList and autopilot", () => {
  it("with autopilot off, runs only what the user asked for", () => {
    const taskList = buildTaskList(
      base({
        autopilot: false,
        chat,
        requests: [request],
        answeredQuestions: [question("q1")],
        approvedJobs: [job("j1", 90)],
        inbox: { messageIds: ["m1"], count: 1 },
      }),
    );
    expect(taskList.tasks.map((task) => task.taskType)).toEqual([
      "chat.reply",
      "upwork.profile",
      "question.answered",
    ]);
  });

  it("with autopilot off and nothing asked for, says so", () => {
    const taskList = buildTaskList(base({ autopilot: false, approvedJobs: [job("j1", 90)] }));
    expect(taskList.tasks).toEqual([]);
    expect(taskList.emptyReason).toBe("autopilotOff");
  });

  it("with autopilot on, puts chat and requests ahead of the pilot's own work", () => {
    const taskList = buildTaskList(
      base({ chat, requests: [request], approvedJobs: [job("j1", 100)] }),
    );
    expect(taskList.tasks.map((task) => task.taskType).slice(0, 3)).toEqual([
      "chat.reply",
      "upwork.profile",
      "job.apply",
    ]);
  });
});

describe("gatherChat", () => {
  const db = (newest: { id: string; author: "user" | "pilot" } | null) =>
    ({ pilotMessage: { findFirst: async () => newest } }) as unknown as PrismaClient;

  it("answers the newest user message once, however many came before it", async () => {
    const task = await gatherChat(db({ id: MESSAGE_ID, author: "user" }), "u1");
    expect(task).toMatchObject({ taskType: "chat.reply", payload: { messageId: MESSAGE_ID } });
  });

  it("waits when the pilot spoke last", async () => {
    expect(await gatherChat(db({ id: MESSAGE_ID, author: "pilot" }), "u1")).toBeNull();
    expect(await gatherChat(db(null), "u1")).toBeNull();
  });
});
