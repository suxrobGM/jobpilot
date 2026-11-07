import {
  createPilotJournalSchema,
  pilotJournalPageSchema,
  pilotJournalQuerySchema,
} from "@jobpilot/contracts/pilot";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { createPilotJournalResponseSchema } from "../pilot.schema";
import { PilotJournalService } from "./journal.service";

const journal = container.get(PilotJournalService);
const limitTaskList = rateLimit(RATE_LIMITS.pilotTasks);
const limitJournal = rateLimit(RATE_LIMITS.pilotJournal);
const limitJournalExport = rateLimit(RATE_LIMITS.pilotJournalExport);

export const pilotJournalController = new Elysia({ prefix: "/pilot", detail: { tags: ["Pilot"] } })
  .use(authGuard)
  .post("/journal", ({ user, body }) => journal.append(user.id, body), {
    body: createPilotJournalSchema,
    beforeHandle: limitJournal,
    response: createPilotJournalResponseSchema,
    detail: {
      summary: "Append journal entries",
      description:
        "Writes a batch of journal entries, advances cycle accounting on 'cycle' entries, and broadcasts each entry.",
    },
  })
  .get("/journal", ({ user, query }) => journal.list(user.id, query, query.kinds), {
    query: pilotJournalQuerySchema,
    beforeHandle: limitTaskList,
    response: pilotJournalPageSchema,
    detail: {
      summary: "List journal entries",
      description: "Paginated journal history, newest first; optionally filtered by kind.",
    },
  })
  .get("/journal/export", ({ user }) => journal.streamExport(user.id), {
    beforeHandle: limitJournalExport,
    detail: {
      summary: "Export the journal",
      description:
        "Streams every journal entry as newline-delimited JSON (createdAt ascending) for offline analysis.",
    },
  });
