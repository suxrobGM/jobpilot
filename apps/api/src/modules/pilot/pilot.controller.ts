import {
  agendaResponseSchema,
  answerPilotQuestionSchema,
  createPilotClaimSchema,
  createPilotJournalSchema,
  createPilotQuestionSchema,
  currentAgendaResponseSchema,
  pilotClaimSchema,
  pilotJournalPageSchema,
  pilotJournalQuerySchema,
  pilotQuestionListSchema,
  pilotQuestionSchema,
  pilotQuestionsQuerySchema,
  pilotStateSchema,
  releasePilotClaimSchema,
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
import { ClaimService } from "./agenda/claim.service";
import { AgendaService } from "./agenda/service";
import { PilotJournalService } from "./journal.service";
import { createPilotJournalResponseSchema, pilotActivityResponseSchema } from "./pilot.schema";
import { PilotService } from "./pilot.service";

const pilot = container.resolve(PilotService);
const journal = container.resolve(PilotJournalService);
const agenda = container.resolve(AgendaService);
const claims = container.resolve(ClaimService);

const limitAgenda = rateLimit(RATE_LIMITS.pilotAgenda);
const limitJournal = rateLimit(RATE_LIMITS.pilotJournal);
const limitJournalExport = rateLimit(RATE_LIMITS.pilotJournalExport);
const limitClaim = rateLimit(RATE_LIMITS.pilotClaim);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

export const pilotController = new Elysia({
  prefix: "/pilot",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
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
  .get("/agenda", ({ user }) => agenda.getCurrent(user.id), {
    beforeHandle: limitAgenda,
    response: currentAgendaResponseSchema,
    detail: {
      summary: "Get the current agenda snapshot",
      description:
        "Returns the current unexpired agenda snapshot without running expiry, promotion, digest, or any other mutation.",
    },
  })
  .post("/agenda/refresh", ({ user }) => agenda.refresh(user.id), {
    beforeHandle: limitAgenda,
    response: agendaResponseSchema,
    detail: {
      summary: "Refresh the agenda snapshot",
      description:
        "Runs lifecycle maintenance, compiles a typed agenda, persists a new expiring version, and returns that snapshot.",
    },
  })
  .get("/activity", ({ user }) => pilot.getActivity(user.id), {
    beforeHandle: limitAgenda,
    response: pilotActivityResponseSchema,
    detail: {
      summary: "Pilot liveness activity",
      description:
        "Newest server-side agent activity (claims, journal, campaign/job writes) plus the active-claim count, so the terminal orchestrator can tell a live long run from a genuinely stuck one.",
    },
  })
  .post("/claims", ({ user, body }) => claims.claim(user.id, body.agendaVersion, body.itemId), {
    body: createPilotClaimSchema,
    beforeHandle: limitClaim,
    response: pilotClaimSchema,
    detail: {
      summary: "Claim an agenda item",
      description:
        "Atomically claims an item from the supplied agenda version and creates its 15-minute claim; stale versions and races return 409.",
    },
  })
  .post("/claims/:id/heartbeat", ({ user, params }) => claims.heartbeat(user.id, params.id), {
    params: idParam,
    beforeHandle: limitClaim,
    response: pilotClaimSchema,
    detail: {
      summary: "Heartbeat a claim",
      description: "Extends the claim TTL by 15 minutes and records the heartbeat.",
    },
  })
  .post(
    "/claims/:id/release",
    ({ user, params, body }) => claims.release(user.id, params.id, body),
    {
      params: idParam,
      body: releasePilotClaimSchema,
      beforeHandle: limitClaim,
      response: pilotClaimSchema,
      detail: {
        summary: "Release a claim",
        description:
          "Closes a claim (done/failed/abandoned); abandoned reverts the job to approved. Bookkeeping only - terminal job results go through the campaign result route.",
      },
    },
  )
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
  .post("/questions", ({ user, body }) => pilot.createQuestion(user.id, body), {
    body: createPilotQuestionSchema,
    beforeHandle: limitMutation,
    response: pilotQuestionSchema,
    detail: {
      summary: "Create a question",
      description: "Opens a question/choice/2fa/approval question and notifies subscribers.",
    },
  })
  .get("/questions", ({ user, query }) => pilot.listQuestions(user.id, query.status), {
    query: pilotQuestionsQuerySchema,
    response: pilotQuestionListSchema,
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
      body: answerPilotQuestionSchema,
      beforeHandle: limitMutation,
      response: pilotQuestionSchema,
      detail: {
        summary: "Answer a question",
        description: "Records the answer, marks the question answered, and notifies subscribers.",
      },
    },
  )
  .get("/events", ({ user, headers }) => sseStream(pilotChannel, { userId: user.id }, headers), {
    detail: {
      summary: "Stream pilot events",
      description:
        "Server-Sent Events for the profile's Pilot: journal appends, question lifecycle, and state changes.",
    },
  });
