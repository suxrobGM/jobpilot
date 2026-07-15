import {
  agendaResponseSchema,
  answerEscalationSchema,
  createEscalationSchema,
  createPilotJournalSchema,
  createPilotLeaseSchema,
  escalationListSchema,
  escalationSchema,
  escalationsQuerySchema,
  pilotJournalPageSchema,
  pilotJournalQuerySchema,
  pilotLeaseSchema,
  pilotStateSchema,
  pushSubscriptionInputSchema,
  pushSubscriptionListSchema,
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
  releasePilotLeaseSchema,
  setPilotEnabledSchema,
  updatePilotMandateSchema,
  vapidKeySchema,
} from "@jobpilot/contracts/pilot";
import { idParam } from "@jobpilot/contracts/shared";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { notFound } from "@/common/errors";
import { profileGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { sseStream } from "@/common/sse";
import { deletedResponseSchema } from "@/types/response";
import { AgendaService } from "./agenda.service";
import { createPilotJournalResponseSchema } from "./pilot.schema";
import { PilotService } from "./pilot.service";
import { PushService } from "./push.service";

const pilot = container.resolve(PilotService);
const agenda = container.resolve(AgendaService);
const push = container.resolve(PushService);

const limitAgenda = rateLimit(RATE_LIMITS.pilotAgenda);
const limitJournal = rateLimit(RATE_LIMITS.pilotJournal);
const limitLease = rateLimit(RATE_LIMITS.pilotLease);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

export const pilotController = new Elysia({
  prefix: "/pilot",
  detail: { tags: ["Pilot"] },
})
  .use(profileGuard)
  // ── State / mandate ───────────────────────────────────────────────────────────
  .get("/", ({ profileId }) => pilot.getState(profileId), {
    response: pilotStateSchema,
    detail: {
      summary: "Get pilot state",
      description: "Returns the profile's Pilot state, creating it with defaults on first read.",
    },
  })
  .put("/mandate", ({ profileId, body }) => pilot.updateMandate(profileId, body), {
    body: updatePilotMandateSchema,
    beforeHandle: limitMutation,
    response: pilotStateSchema,
    detail: {
      summary: "Update mandate",
      description: "Replaces the Pilot's goals and operating config and returns the updated state.",
    },
  })
  .post("/enabled", ({ profileId, body }) => pilot.setEnabled(profileId, body), {
    body: setPilotEnabledSchema,
    beforeHandle: limitMutation,
    response: pilotStateSchema,
    detail: {
      summary: "Enable or disable the pilot",
      description: "Toggles the autonomous loop on or off and returns the updated state.",
    },
  })
  // ── Agenda ────────────────────────────────────────────────────────────────────
  .get("/agenda", ({ profileId }) => agenda.compile(profileId), {
    beforeHandle: limitAgenda,
    response: agendaResponseSchema,
    detail: {
      summary: "Compile the agenda",
      description:
        "Runs lazy lease/escalation expiry, then returns the prioritized agenda, budget, counts, and sleep hint for the next cycle.",
    },
  })
  // ── Leases ────────────────────────────────────────────────────────────────────
  .post("/lease", ({ profileId, body }) => agenda.lease(profileId, body.itemId), {
    body: createPilotLeaseSchema,
    beforeHandle: limitLease,
    response: pilotLeaseSchema,
    detail: {
      summary: "Lease an agenda item",
      description:
        "Re-validates and leases an agenda item for 15 minutes, applying grant side effects. 409 if the item is no longer available.",
    },
  })
  .post("/lease/:id/heartbeat", ({ profileId, params }) => agenda.heartbeat(profileId, params.id), {
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
    ({ profileId, params, body }) => agenda.release(profileId, params.id, body),
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
  .post("/journal", ({ profileId, body }) => pilot.appendJournal(profileId, body), {
    body: createPilotJournalSchema,
    beforeHandle: limitJournal,
    response: createPilotJournalResponseSchema,
    detail: {
      summary: "Append journal entries",
      description:
        "Writes a batch of journal entries, advances cycle accounting on 'cycle' entries, and broadcasts each entry.",
    },
  })
  .get(
    "/journal",
    ({ profileId, query }) => pilot.listJournal(profileId, query.cursor, query.limit),
    {
      query: pilotJournalQuerySchema,
      beforeHandle: limitAgenda,
      response: pilotJournalPageSchema,
      detail: {
        summary: "List journal entries",
        description: "Cursor-paginated journal history, newest first.",
      },
    },
  )
  // ── Escalations ───────────────────────────────────────────────────────────────
  .post("/escalations", ({ profileId, body }) => pilot.createEscalation(profileId, body), {
    body: createEscalationSchema,
    beforeHandle: limitMutation,
    response: escalationSchema,
    detail: {
      summary: "Create an escalation",
      description: "Opens a question/choice/2fa/approval escalation and notifies subscribers.",
    },
  })
  .get("/escalations", ({ profileId, query }) => pilot.listEscalations(profileId, query.status), {
    query: escalationsQuerySchema,
    response: escalationListSchema,
    detail: {
      summary: "List escalations",
      description: "Returns the profile's escalations, optionally filtered by status.",
    },
  })
  .post(
    "/escalations/:id/answer",
    ({ profileId, params, body }) => pilot.answerEscalation(profileId, params.id, body),
    {
      params: idParam,
      body: answerEscalationSchema,
      beforeHandle: limitMutation,
      response: escalationSchema,
      detail: {
        summary: "Answer an escalation",
        description: "Records the answer, marks the escalation answered, and notifies subscribers.",
      },
    },
  )
  // ── Web push ──────────────────────────────────────────────────────────────────
  .get("/push/vapid-key", () => ({ publicKey: push.publicKey }), {
    response: vapidKeySchema,
    detail: {
      summary: "Get the VAPID public key",
      description:
        "The application-server key the browser subscribes with, or null when push is unconfigured.",
    },
  })
  .post("/push/subscriptions", ({ profileId, body }) => push.subscribe(profileId, body), {
    body: pushSubscriptionInputSchema,
    beforeHandle: limitMutation,
    response: pushSubscriptionSchema,
    detail: {
      summary: "Register a push subscription",
      description:
        "Upserts the browser's push subscription by endpoint, reassigning it to the caller.",
    },
  })
  .delete(
    "/push/subscriptions",
    async ({ profileId, body }) => {
      const deleted = await push.unsubscribe(profileId, body.endpoint);
      if (!deleted) {
        throw notFound("Subscription not found");
      }
      return { deleted };
    },
    {
      body: pushUnsubscribeSchema,
      beforeHandle: limitMutation,
      response: deletedResponseSchema,
      detail: {
        summary: "Remove a push subscription",
        description: "Deletes the caller's subscription for the given endpoint.",
      },
    },
  )
  .get("/push/subscriptions", ({ profileId }) => push.list(profileId), {
    response: pushSubscriptionListSchema,
    detail: {
      summary: "List push subscriptions",
      description: "The caller's registered push devices, newest first.",
    },
  })
  // ── Events (SSE) ────────────────────────────────────────────────────────────────
  .get("/events", ({ profileId, headers }) => sseStream(pilotChannel, { profileId }, headers), {
    detail: {
      summary: "Stream pilot events",
      description:
        "Server-Sent Events for the profile's Pilot: journal appends, escalation lifecycle, and state changes.",
    },
  });
