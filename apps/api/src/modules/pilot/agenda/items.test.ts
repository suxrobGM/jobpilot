import { buildAgenda } from "./build";
import { base, cfg, contact, followup, hotJob, job, prep, reply, send } from "./builders";
import { describe, expect, it } from "bun:test";

describe("buildAgenda M3 kinds", () => {
  it("orders new kinds by the priority ladder", () => {
    const hot = hotJob("j1", 90, [contact("w1")]);
    const agenda = buildAgenda(
      base({
        approvedJobs: [hot],
        warmIntroCandidates: [hot],
        approvedNetworking: [send("m1")],
        inbox: { messageIds: ["e1"], count: 1 },
        approvedPromotions: [
          { id: "p1", platform: "hn-whoishiring", target: null, title: "t", body: "b" },
        ],
        followups: [followup("m9")],
        duePlatforms: [{ platform: "reddit:r/forhire" }],
      }),
    );
    expect(agenda.items.map((i) => i.kind)).toEqual([
      "job.apply",
      "networking.send",
      "inbox.review",
      "promo.post",
      "networking.warmIntro",
      "networking.followup",
      "promo.compose",
    ]);
  });

  it("emits one inbox.review batch item carrying oldest-first ids and total count", () => {
    const agenda = buildAgenda(base({ inbox: { messageIds: ["a", "b"], count: 5 } }));
    const item = agenda.items.find((i) => i.kind === "inbox.review");
    expect(item?.payload).toEqual({ messageIds: ["a", "b"], count: 5 });
    expect(item?.subjectType).toBe("inbox");
  });

  it("caps networking.send at the sends left today and never emits linkedin drafts as sends", () => {
    const agenda = buildAgenda(
      base({
        config: cfg({ networking: { dailyCap: 2 } }),
        networkingSentToday: 1,
        approvedNetworking: [send("m1"), send("m2"), send("m3")],
      }),
    );
    const sends = agenda.items.filter((i) => i.kind === "networking.send");
    expect(sends).toHaveLength(1); // 2 cap - 1 sent = 1 left
    expect(sends[0].payload.contactEmail).toBe("dana@acme.test");
  });

  it("suppresses networking.send entirely once the networking cap is spent", () => {
    const agenda = buildAgenda(
      base({
        config: cfg({ networking: { dailyCap: 2 } }),
        networkingSentToday: 2,
        approvedNetworking: [send("m1")],
      }),
    );
    expect(agenda.items.some((i) => i.kind === "networking.send")).toBe(false);
  });

  it("emits at most 2 followups and only while sends are left today", () => {
    const withSendsLeft = buildAgenda(
      base({ followups: [followup("m1"), followup("m2"), followup("m3")] }),
    );
    expect(withSendsLeft.items.filter((i) => i.kind === "networking.followup")).toHaveLength(2);

    const noSendsLeft = buildAgenda(
      base({
        config: cfg({ networking: { dailyCap: 1 } }),
        networkingSentToday: 1,
        followups: [followup("m1")],
      }),
    );
    expect(noSendsLeft.items.some((i) => i.kind === "networking.followup")).toBe(false);
  });

  it("gives followups only what the emitted sends left over", () => {
    const leftOne = buildAgenda(
      base({
        config: cfg({ networking: { dailyCap: 2 } }),
        approvedNetworking: [send("m1")],
        followups: [followup("f1"), followup("f2")],
      }),
    );
    expect(leftOne.items.filter((i) => i.kind === "networking.followup")).toHaveLength(1);

    const spent = buildAgenda(
      base({
        config: cfg({ networking: { dailyCap: 2 } }),
        approvedNetworking: [send("m1"), send("m2")],
        followups: [followup("f1")],
      }),
    );
    expect(spent.items.filter((i) => i.kind === "networking.send")).toHaveLength(2);
    expect(spent.items.some((i) => i.kind === "networking.followup")).toBe(false);
  });

  it("emits a warmIntro and attaches warmContacts to the apply payload", () => {
    const warm = [contact("w1", { title: "Eng" })];
    const job1 = hotJob("j1", 80, warm);
    const hot = buildAgenda(base({ approvedJobs: [job1], warmIntroCandidates: [job1] }));
    expect(hot.items.some((i) => i.kind === "networking.warmIntro")).toBe(true);
    const apply = hot.items.find((i) => i.kind === "job.apply");
    expect(apply?.payload.warmContacts).toEqual(warm);
  });

  it("emits no warmIntro when the pool is empty", () => {
    const agenda = buildAgenda(base({ approvedJobs: [hotJob("j2", 79)], warmIntroCandidates: [] }));
    expect(agenda.items.some((i) => i.kind === "networking.warmIntro")).toBe(false);
  });

  it("emits at most one warmIntro per agenda", () => {
    const warm = [contact("w1")];
    const pool = [hotJob("j1", 90, warm), hotJob("j2", 88, warm)];
    const agenda = buildAgenda(base({ approvedJobs: pool, warmIntroCandidates: pool }));
    expect(agenda.items.filter((i) => i.kind === "networking.warmIntro")).toHaveLength(1);
  });

  it("emits a warmIntro for a recently-applied job that left the approved pool", () => {
    const agenda = buildAgenda(base({ approvedJobs: [], warmIntroCandidates: [hotJob("j1", 90)] }));
    expect(agenda.items.some((i) => i.kind === "networking.warmIntro")).toBe(true);
    expect(agenda.items.some((i) => i.kind === "job.apply")).toBe(false);
  });

  it("suppresses every networking kind when both channels are off", () => {
    const hot = hotJob("j1", 90, [contact("w1")]);
    const agenda = buildAgenda(
      base({
        config: cfg({ networking: { email: "off", linkedIn: "off" } }),
        approvedJobs: [hot],
        warmIntroCandidates: [hot],
        approvedNetworking: [send("m1")],
        followups: [followup("f1")],
        inbox: { messageIds: ["e1"], count: 1 },
      }),
    );
    const kinds = agenda.items.map((i) => i.kind);
    expect(kinds).not.toContain("networking.warmIntro");
    expect(kinds).not.toContain("networking.send");
    expect(kinds).not.toContain("networking.followup");
    // Inbox triage is not networking: it must still surface so interview mail is seen.
    expect(kinds).toContain("inbox.review");
  });

  it("emits a warmIntro for a high-score job with no known contacts", () => {
    const agenda = buildAgenda(base({ warmIntroCandidates: [hotJob("j1", 90)] }));
    const warmIntro = agenda.items.find((i) => i.kind === "networking.warmIntro");
    expect(warmIntro?.payload.contacts).toEqual([]);
  });

  it("suppresses the warmIntro once the networking cap is spent", () => {
    const agenda = buildAgenda(
      base({
        config: cfg({ networking: { dailyCap: 1 } }),
        networkingSentToday: 1,
        warmIntroCandidates: [hotJob("j1", 90)],
      }),
    );
    expect(agenda.items.some((i) => i.kind === "networking.warmIntro")).toBe(false);
  });

  it("email off drops sends and followups but keeps the LinkedIn-capable warmIntro", () => {
    const agenda = buildAgenda(
      base({
        config: cfg({ networking: { email: "off", linkedIn: "draft" } }),
        warmIntroCandidates: [hotJob("j1", 90)],
        approvedNetworking: [send("m1")],
        followups: [followup("f1")],
      }),
    );
    const kinds = agenda.items.map((i) => i.kind);
    expect(kinds).not.toContain("networking.send");
    expect(kinds).not.toContain("networking.followup");
    expect(kinds).toContain("networking.warmIntro");
  });

  it("resolves the warmIntro channel to email when both are on", () => {
    const agenda = buildAgenda(
      base({
        config: cfg({ networking: { email: "auto", linkedIn: "review" } }),
        warmIntroCandidates: [hotJob("j1", 90)],
      }),
    );
    const warmIntro = agenda.items.find((i) => i.kind === "networking.warmIntro");
    expect(warmIntro?.payload).toMatchObject({ channel: "email", autonomy: "auto" });
  });

  it("falls back to LinkedIn for the warmIntro when email is off", () => {
    const agenda = buildAgenda(
      base({
        config: cfg({ networking: { email: "off", linkedIn: "review" } }),
        warmIntroCandidates: [hotJob("j1", 90)],
      }),
    );
    const warmIntro = agenda.items.find((i) => i.kind === "networking.warmIntro");
    expect(warmIntro?.payload).toMatchObject({ channel: "linkedin", autonomy: "review" });
  });

  it("carries the email mode into every followup", () => {
    const agenda = buildAgenda(
      base({
        config: cfg({ networking: { email: "review" } }),
        followups: [followup("f1")],
      }),
    );
    const item = agenda.items.find((i) => i.kind === "networking.followup");
    expect(item?.payload).toMatchObject({ channel: "email", autonomy: "review" });
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
});

describe("buildAgenda interview kinds", () => {
  it("emits an interview.reply keyed and subjected on the email with the full payload", () => {
    const agenda = buildAgenda(base({ interviewReplies: [reply("em1")] }));
    const item = agenda.items.find((i) => i.kind === "interview.reply");
    expect(item?.id).toBe("interview.reply:em1");
    expect(item?.subjectType).toBe("email");
    expect(item?.subjectId).toBe("em1");
    expect(item?.priority).toBe(950);
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

  it("ranks interview.reply above job.apply and interview.prep between apply and networking.send", () => {
    const agenda = buildAgenda(
      base({
        interviewReplies: [reply("em1")],
        interviewPreps: [prep("app1")],
        approvedJobs: [job("j1", 40)],
        approvedNetworking: [send("m1")],
      }),
    );
    expect(agenda.items.map((i) => i.kind)).toEqual([
      "interview.reply",
      "job.apply",
      "interview.prep",
      "networking.send",
    ]);
  });

  it("ranks interview.reply above even a top-scored job.apply", () => {
    // 950 beats jobBase + matchScore (800 + 95): a recruiter waiting always outranks another apply.
    const agenda = buildAgenda(
      base({
        config: cfg({ networking: { email: "off", linkedIn: "off" } }),
        interviewReplies: [reply("em1")],
        approvedJobs: [job("j1", 95)],
      }),
    );
    expect(agenda.items.map((i) => i.kind)).toEqual(["interview.reply", "job.apply"]);
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
