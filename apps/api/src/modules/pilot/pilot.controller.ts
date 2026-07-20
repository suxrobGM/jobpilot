import {
  agendaResponseSchema,
  answerQuestionSchema,
  createPilotJournalSchema,
  createPilotLeaseSchema,
  createQuestionSchema,
  pilotJournalPageSchema,
  pilotJournalQuerySchema,
  pilotLeaseSchema,
  pilotStateSchema,
  questionListSchema,
  questionSchema,
  questionsQuerySchema,
  releasePilotLeaseSchema,
  setPilotEnabledSchema,
  updatePilotInstructionsSchema,
} from "@jobpilot/contracts/pilot";
import { idParam } from "@jobpilot/contracts/shared";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { sseStream } from "@/common/sse";
import { LeaseService } from "./agenda/lease.service";
import { AgendaService } from "./agenda/service";
import { PilotJournalService } from "./journal.service";
import { createPilotJournalResponseSchema, pilotActivityResponseSchema } from "./pilot.schema";
import { PilotService } from "./pilot.service";
import { promotionController } from "./promotion.controller";

const pilot = container.resolve(PilotService);
const journal = container.resolve(PilotJournalService);
const agenda = container.resolve(AgendaService);
const leases = container.resolve(LeaseService);

const limitAgenda = rateLimit(RATE_LIMITS.pilotAgenda);
const limitJournal = rateLimit(RATE_LIMITS.pilotJournal);
const limitJournalExport = rateLimit(RATE_LIMITS.pilotJournalExport);
const limitLease = rateLimit(RATE_LIMITS.pilotLease);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

export const pilotController = new Elysia({
  prefix: "/pilot",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
  // ── State / instructions ──────────────────────────────────────────────────────
  .get("/", ({ user }) => pilot.getState(user.id), {
    response: pilotStateSchema,
    detail: {
      summary: "Get pilot state",
      description: "Returns the profile's Pilot state, creating it with defaults on first read.",
    },
  })
  .put("/instructions", ({ user, body }) => pilot.updateInstructions(user.id, body), {
    body: updatePilotInstructionsSchema,
    beforeHandle: limitMutation,
    response: pilotStateSchema,
    detail: {
      summary: "Update instructions",
      description: "Replaces the Pilot's goals and operating config and returns the updated state.",
    },
  })
  .post("/enabled", ({ user, body }) => pilot.setEnabled(user.id, body), {
    body: setPilotEnabledSchema,
    beforeHandle: limitMutation,
    response: pilotStateSchema,
    detail: {
      summary: "Enable or disable the pilot",
      description: "Toggles the autonomous loop on or off and returns the updated state.",
    },
  })
  // ── Agenda ────────────────────────────────────────────────────────────────────
  .get("/agenda", ({ user }) => agenda.compile(user.id), {
    beforeHandle: limitAgenda,
    response: agendaResponseSchema,
    detail: {
      summary: "Compile the agenda",
      description:
        "Runs lazy lease/question expiry, then returns the prioritized agenda, budget, counts, and sleep hint for the next cycle.",
    },
  })
  // ── Activity (watchdog liveness) ───────────────────────────────────────────────
  .get("/activity", ({ user }) => pilot.getActivity(user.id), {
    beforeHandle: limitAgenda,
    response: pilotActivityResponseSchema,
    detail: {
      summary: "Pilot liveness activity",
      description:
        "Newest server-side agent activity (leases, journal, campaign/job writes) plus the active-lease count, so the terminal watchdog can tell a live long cycle from a real stall.",
    },
  })
  // ── Leases ────────────────────────────────────────────────────────────────────
  .post("/lease", ({ user, body }) => leases.lease(user.id, body.itemId), {
    body: createPilotLeaseSchema,
    beforeHandle: limitLease,
    response: pilotLeaseSchema,
    detail: {
      summary: "Lease an agenda item",
      description:
        "Re-validates and leases an agenda item for 15 minutes, applying grant side effects. 409 if the item is no longer available.",
    },
  })
  .post("/lease/:id/heartbeat", ({ user, params }) => leases.heartbeat(user.id, params.id), {
    params: idParam,
    beforeHandle: limitLease,
    response: pilotLeaseSchema,
    detail: {
      summary: "Heartbeat a lease",
      description: "Extends the lease TTL by 15 minutes and records the heartbeat.",
    },
  })
  .post(
    "/lease/:id/release",
    ({ user, params, body }) => leases.release(user.id, params.id, body),
    {
      params: idParam,
      body: releasePilotLeaseSchema,
      beforeHandle: limitLease,
      response: pilotLeaseSchema,
      detail: {
        summary: "Release a lease",
        description:
          "Closes a lease (done/failed/abandoned); abandoned reverts the job to approved. Bookkeeping only - terminal job results go through the campaign result route.",
      },
    },
  )
  // ── Journal ───────────────────────────────────────────────────────────────────
  .post("/journal", ({ user, body }) => journal.appendJournal(user.id, body), {
    body: createPilotJournalSchema,
    beforeHandle: limitJournal,
    response: createPilotJournalResponseSchema,
    detail: {
      summary: "Append journal entries",
      description:
        "Writes a batch of journal entries, advances cycle accounting on 'cycle' entries, and broadcasts each entry.",
    },
  })
  .get("/journal", ({ user, query }) => journal.listJournal(user.id, query.cursor, query.limit), {
    query: pilotJournalQuerySchema,
    beforeHandle: limitAgenda,
    response: pilotJournalPageSchema,
    detail: {
      summary: "List journal entries",
      description: "Cursor-paginated journal history, newest first.",
    },
  })
  // Streams the whole history as NDJSON; no `response` schema (raw streaming Response).
  .get("/journal/export", ({ user }) => journal.streamJournalExport(user.id), {
    beforeHandle: limitJournalExport,
    detail: {
      summary: "Export the journal",
      description:
        "Streams every journal entry as newline-delimited JSON (createdAt ascending) for offline analysis.",
    },
  })
  // ── Questions ─────────────────────────────────────────────────────────────────
  .post("/questions", ({ user, body }) => pilot.createQuestion(user.id, body), {
    body: createQuestionSchema,
    beforeHandle: limitMutation,
    response: questionSchema,
    detail: {
      summary: "Create a question",
      description: "Opens a question/choice/2fa/approval question and notifies subscribers.",
    },
  })
  .get("/questions", ({ user, query }) => pilot.listQuestions(user.id, query.status), {
    query: questionsQuerySchema,
    response: questionListSchema,
    detail: {
      summary: "List questions",
      description: "Returns the profile's questions, optionally filtered by status.",
    },
  })
  .post(
    "/questions/:id/answer",
    ({ user, params, body }) => pilot.answerQuestion(user.id, params.id, body),
    {
      params: idParam,
      body: answerQuestionSchema,
      beforeHandle: limitMutation,
      response: questionSchema,
      detail: {
        summary: "Answer a question",
        description: "Records the answer, marks the question answered, and notifies subscribers.",
      },
    },
  )
  // ── Sub-domain controllers (promotions) ───────────────────────────────────────
  .use(promotionController)
  // ── Events (SSE) ────────────────────────────────────────────────────────────────
  .get("/events", ({ user, headers }) => sseStream(pilotChannel, { userId: user.id }, headers), {
    detail: {
      summary: "Stream pilot events",
      description:
        "Server-Sent Events for the profile's Pilot: journal appends, question lifecycle, and state changes.",
    },
  });
