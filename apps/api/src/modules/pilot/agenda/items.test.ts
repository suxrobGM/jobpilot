// Per-item builder behavior (the M3 kinds) through buildAgenda: send/inbox/promo/followup/warmIntro
// caps and active-hours gating. Pure: no Prisma, no env.
import { buildAgenda } from "./build";
import { base, cfg, followup, job, prep, reply, send } from "./build.test-helpers";
import { describe, expect, it } from "bun:test";

describe("buildAgenda M3 kinds", () => {
  it("orders new kinds by the priority ladder", () => {
    const agenda = buildAgenda(
      base({
        approvedJobs: [
          {
            ...job("j1", 90),
            company: "Acme",
            warmContacts: [{ id: "w1", name: "W", title: null, email: "w@acme.test" }],
          },
        ],
        approvedOutreach: [send("m1")],
        inbox: { messageIds: ["e1"], count: 1 },
        approvedPromotions: [
          { id: "p1", platform: "hn-whoishiring", target: null, title: "t", body: "b" },
        ],
        followups: [followup("m9")],
        duePlatforms: [{ platform: "reddit:r/forhire" }],
        finalizeCampaigns: [{ campaignId: "c2", query: "react" }],
      }),
    );
    expect(agenda.items.map((i) => i.kind)).toEqual([
      "job.apply",
      "outreach.send",
      "inbox.review",
      "promo.post",
      "outreach.warmIntro",
      "outreach.followup",
      "promo.compose",
      "campaign.finalize",
    ]);
  });

  it("emits one inbox.review batch item carrying oldest-first ids and total count", () => {
    const agenda = buildAgenda(base({ inbox: { messageIds: ["a", "b"], count: 5 } }));
    const item = agenda.items.find((i) => i.kind === "inbox.review");
    expect(item?.payload).toEqual({ messageIds: ["a", "b"], count: 5 });
    expect(item?.subjectType).toBe("inbox");
  });

  it("caps outreach.send at the daily headroom and never emits linkedin drafts as sends", () => {
    const agenda = buildAgenda(
      base({
        config: cfg({ dailyOutreachCap: 2 }),
        outreachSentToday: 1,
        approvedOutreach: [send("m1"), send("m2"), send("m3")],
      }),
    );
    const sends = agenda.items.filter((i) => i.kind === "outreach.send");
    expect(sends).toHaveLength(1); // 2 cap - 1 sent = 1 headroom
    expect(sends[0].payload.contactEmail).toBe("dana@acme.test");
  });

  it("suppresses outreach.send entirely once the outreach cap is spent", () => {
    const agenda = buildAgenda(
      base({
        config: cfg({ dailyOutreachCap: 2 }),
        outreachSentToday: 2,
        approvedOutreach: [send("m1")],
      }),
    );
    expect(agenda.items.some((i) => i.kind === "outreach.send")).toBe(false);
  });

  it("emits at most 2 followups and only while send headroom exists", () => {
    const withHeadroom = buildAgenda(
      base({ followups: [followup("m1"), followup("m2"), followup("m3")] }),
    );
    expect(withHeadroom.items.filter((i) => i.kind === "outreach.followup")).toHaveLength(2);

    const noHeadroom = buildAgenda(
      base({
        config: cfg({ dailyOutreachCap: 1 }),
        outreachSentToday: 1,
        followups: [followup("m1")],
      }),
    );
    expect(noHeadroom.items.some((i) => i.kind === "outreach.followup")).toBe(false);
  });

  it("emits a warmIntro and attaches warmContacts to the apply payload only at score >= 85", () => {
    const warm = [{ id: "w1", name: "Insider", title: "Eng", email: "in@acme.test" }];
    const hot = buildAgenda(
      base({ approvedJobs: [{ ...job("j1", 85), company: "Acme", warmContacts: warm }] }),
    );
    expect(hot.items.some((i) => i.kind === "outreach.warmIntro")).toBe(true);
    const apply = hot.items.find((i) => i.kind === "job.apply");
    expect(apply?.payload.warmContacts).toEqual(warm);

    const cold = buildAgenda(
      base({ approvedJobs: [{ ...job("j2", 84), company: "Acme", warmContacts: warm }] }),
    );
    expect(cold.items.some((i) => i.kind === "outreach.warmIntro")).toBe(false);
  });

  it("emits at most one warmIntro per agenda", () => {
    const warm = [{ id: "w1", name: "Insider", title: null, email: "in@acme.test" }];
    const agenda = buildAgenda(
      base({
        approvedJobs: [
          { ...job("j1", 90), company: "Acme", warmContacts: warm },
          { ...job("j2", 88), company: "Beta", warmContacts: warm },
        ],
      }),
    );
    expect(agenda.items.filter((i) => i.kind === "outreach.warmIntro")).toHaveLength(1);
  });

  it("emits promo.post per approved post and at most one promo.compose", () => {
    const agenda = buildAgenda(
      base({
        approvedPromotions: [
          { id: "p1", platform: "hn", target: null, title: null, body: "b1" },
          { id: "p2", platform: "reddit", target: "u", title: null, body: "b2" },
        ],
        duePlatforms: [{ platform: "v1" }, { platform: "v2" }],
      }),
    );
    expect(agenda.items.filter((i) => i.kind === "promo.post")).toHaveLength(2);
    expect(agenda.items.filter((i) => i.kind === "promo.compose")).toHaveLength(1);
  });

  it("gates all M3 kinds behind active hours", () => {
    const hours = cfg({ activeHours: { start: "09:00", end: "17:00", tz: "UTC" } });
    const agenda = buildAgenda(
      base({
        now: new Date("2026-07-15T03:00:00.000Z"),
        config: hours,
        approvedOutreach: [send("m1")],
        inbox: { messageIds: ["e1"], count: 1 },
        approvedPromotions: [{ id: "p1", platform: "hn", target: null, title: null, body: "b" }],
        followups: [followup("m9")],
        duePlatforms: [{ platform: "v1" }],
      }),
    );
    expect(agenda.items).toHaveLength(0);
  });
});

describe("buildAgenda interview kinds", () => {
  it("emits an interview.reply keyed and subjected on the email with the full payload", () => {
    const agenda = buildAgenda(base({ interviewReplies: [reply("em1")] }));
    const item = agenda.items.find((i) => i.kind === "interview.reply");
    expect(item?.id).toBe("interview.reply:em1");
    expect(item?.subjectType).toBe("email");
    expect(item?.subjectId).toBe("em1");
    expect(item?.priority).toBe(850);
    expect(item?.payload).toEqual({
      applicationId: "app-em1",
      emailMessageId: "em1",
      threadId: "thr-em1",
      from: "dana@acme.test",
      subject: "Interview availability?",
      receivedAt: new Date("2026-07-14T12:00:00.000Z"),
      company: "Acme",
      jobTitle: "Engineer",
    });
  });

  it("emits at most 2 interview.reply items per agenda", () => {
    const agenda = buildAgenda(base({ interviewReplies: [reply("e1"), reply("e2"), reply("e3")] }));
    expect(agenda.items.filter((i) => i.kind === "interview.reply")).toHaveLength(2);
  });

  it("emits an interview.prep subjected on the application with a nullable resumeId", () => {
    const agenda = buildAgenda(base({ interviewPreps: [prep("app1", { resumeId: null })] }));
    const item = agenda.items.find((i) => i.kind === "interview.prep");
    expect(item?.id).toBe("interview.prep:app1");
    expect(item?.subjectType).toBe("application");
    expect(item?.subjectId).toBe("app1");
    expect(item?.priority).toBe(750);
    expect(item?.payload).toEqual({
      applicationId: "app1",
      company: "Acme",
      jobTitle: "Engineer",
      jobUrl: "https://x/1",
      resumeId: null,
    });
  });

  it("emits at most one interview.prep per agenda", () => {
    const agenda = buildAgenda(base({ interviewPreps: [prep("a1"), prep("a2")] }));
    expect(agenda.items.filter((i) => i.kind === "interview.prep")).toHaveLength(1);
  });

  it("ranks interview.reply above job.apply and interview.prep between apply and outreach.send", () => {
    // job.apply is score-offset (800 + score), so a low score keeps it under interview.reply's 850.
    const agenda = buildAgenda(
      base({
        interviewReplies: [reply("em1")],
        interviewPreps: [prep("app1")],
        approvedJobs: [job("j1", 40)],
        approvedOutreach: [send("m1")],
      }),
    );
    expect(agenda.items.map((i) => i.kind)).toEqual([
      "interview.reply",
      "job.apply",
      "interview.prep",
      "outreach.send",
    ]);
  });

  it("gates interview kinds behind active hours", () => {
    const hours = cfg({ activeHours: { start: "09:00", end: "17:00", tz: "UTC" } });
    const agenda = buildAgenda(
      base({
        now: new Date("2026-07-15T03:00:00.000Z"),
        config: hours,
        interviewReplies: [reply("em1")],
        interviewPreps: [prep("app1")],
      }),
    );
    expect(agenda.items).toHaveLength(0);
  });

  it("enriches the question.answered payload with subject and Q/A", () => {
    const agenda = buildAgenda(
      base({
        answeredQuestions: [
          {
            id: "E1",
            kind: "approval",
            prompt: "Send this reply?",
            subjectType: "email",
            subjectId: "em1",
            answer: "yes",
          },
        ],
      }),
    );
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

  it("defaults the enriched question fields to null when absent", () => {
    const agenda = buildAgenda(
      base({ answeredQuestions: [{ id: "E2", kind: "question", prompt: "q" }] }),
    );
    const item = agenda.items.find((i) => i.kind === "question.answered");
    expect(item?.payload).toMatchObject({ subjectType: null, subjectId: null, answer: null });
  });
});
