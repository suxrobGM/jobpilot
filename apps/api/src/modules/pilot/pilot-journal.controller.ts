import {
  createPilotJournalSchema,
  pilotJournalPageSchema,
  pilotJournalQuerySchema,
} from "@jobpilot/contracts/pilot";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { PilotJournalService } from "./journal.service";
import { createPilotJournalResponseSchema } from "./pilot.schema";

const journal = container.resolve(PilotJournalService);
const limitAgenda = rateLimit(RATE_LIMITS.pilotAgenda);
const limitJournal = rateLimit(RATE_LIMITS.pilotJournal);
const limitJournalExport = rateLimit(RATE_LIMITS.pilotJournalExport);

export const pilotJournalController = new Elysia({ prefix: "/pilot", detail: { tags: ["Pilot"] } })
  .use(authGuard)
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
  .get(
    "/journal",
    ({ user, query }) => journal.listJournal(user.id, query.cursor, query.limit, query.kinds),
    {
      query: pilotJournalQuerySchema,
      beforeHandle: limitAgenda,
      response: pilotJournalPageSchema,
      detail: {
        summary: "List journal entries",
        description: "Cursor-paginated journal history, newest first; optionally filtered by kind.",
      },
    },
  )
  // Streams the whole history as NDJSON; no `response` schema (raw streaming Response).
  .get("/journal/export", ({ user }) => journal.streamJournalExport(user.id), {
    beforeHandle: limitJournalExport,
    detail: {
      summary: "Export the journal",
      description:
        "Streams every journal entry as newline-delimited JSON (createdAt ascending) for offline analysis.",
    },
  });
