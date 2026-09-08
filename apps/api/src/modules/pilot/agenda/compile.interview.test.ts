import { service } from "./fakes";
import { describe, expect, it } from "bun:test";

describe("AgendaService interview replies", () => {
  const replyApp = (over: Record<string, unknown> = {}) => ({
    id: "app1",
    company: "Acme",
    title: "Engineer",
    emailMessages: [
      {
        id: "em1",
        threadId: "t1",
        fromAddress: "dana@acme.test",
        subject: "Re: interview",
        receivedAt: new Date("2026-07-14T12:00:00.000Z"),
      },
    ],
    ...over,
  });

  it("emits interview.reply for an interviewing app with an unreplied inbound email", async () => {
    const agenda = await service({ interviewReplyApps: [replyApp()] }).refresh("p1");
    const item = agenda.items.find((i) => i.kind === "interview.reply");
    expect(item?.subjectId).toBe("em1");
    expect(item?.payload).toMatchObject({ applicationId: "app1", emailMessageId: "em1" });
  });

  it("suppresses interview.reply while an open/answered question exists for the email", async () => {
    const agenda = await service({
      interviewReplyApps: [replyApp()],
      interviewQuestions: [{ subjectId: "em1" }],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "interview.reply")).toBe(false);
  });

  it("emits no interview.reply for an app without a matched interview email", async () => {
    const agenda = await service({
      interviewReplyApps: [replyApp({ emailMessages: [] })],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "interview.reply")).toBe(false);
  });
});

describe("AgendaService interview prep", () => {
  it("emits interview.prep with a resumeId derived from the campaign config", async () => {
    // Config is schema-parsed now, so the fixture's resumeId must be a real uuid.
    const resumeId = "3f0e1a9c-2b4d-4c8e-9f1a-5b6c7d8e9f0a";
    const agenda = await service({
      interviewPrepApps: [
        {
          id: "app1",
          company: "Acme",
          title: "Engineer",
          url: "https://x/1",
          campaign: { config: { resumeId } },
        },
      ],
    }).refresh("p1");
    const item = agenda.items.find((i) => i.kind === "interview.prep");
    expect(item?.subjectId).toBe("app1");
    expect(item?.payload).toMatchObject({
      applicationId: "app1",
      resumeId,
      jobUrl: "https://x/1",
    });
  });

  it("derives a null resumeId when the app has no campaign", async () => {
    const agenda = await service({
      interviewPrepApps: [
        { id: "app1", company: "Acme", title: "Engineer", url: "https://x/1", campaign: null },
      ],
    }).refresh("p1");
    const item = agenda.items.find((i) => i.kind === "interview.prep");
    expect(item?.payload.resumeId).toBeNull();
  });
});
