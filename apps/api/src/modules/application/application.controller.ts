import { applicationFilterSchema, statusTransitionSchema } from "@jobpilot/contracts/application";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { deletedResponseSchema } from "@/types/response";
import {
  appendNoteSchema,
  applicationCheckSchema,
  applicationDetailSchema,
  applicationEventSchema,
  applicationListQuerySchema,
  applicationListSchema,
  applicationQuerySchema,
  applicationSummarySchema,
  statusTransitionResultSchema,
} from "./application.schema";
import { ApplicationService } from "./application.service";

const svc = container.resolve(ApplicationService);
const limitNote = rateLimit(RATE_LIMITS.applicationNote);

export const applicationController = new Elysia({
  prefix: "/applied",
  detail: { tags: ["Applied"] },
})
  .use(authGuard)
  .get("/", ({ user, query }) => svc.list(user.id, query), {
    query: applicationListQuerySchema,
    response: applicationListSchema,
    detail: {
      summary: "List applications",
      description:
        "Returns one page of the profile's applied jobs (newest first) as `{ items, pagination }`, optionally filtered by status, board, source, campaign (`none` for single applies), or a search term matched against title, company, and URL.",
    },
  })
  .get("/summary", ({ user, query }) => svc.summary(user.id, query), {
    query: applicationFilterSchema.omit({ status: true }),
    response: applicationSummarySchema,
    detail: {
      summary: "Application totals by status",
      description:
        "Returns the profile's application count grouped by status across every row matching the given filters, so funnel tallies cover the whole account rather than one page.",
    },
  })
  .get("/check", ({ user, query }) => svc.check(user.id, query), {
    query: applicationQuerySchema,
    response: applicationCheckSchema,
    detail: {
      summary: "Check for duplicate application",
      description:
        "Checks whether the profile already applied to a job by exact URL or by a fuzzy title-and-company match within the dedupe window, returning whether a duplicate exists and the matching application when found.",
    },
  })
  .get("/:id", ({ user, params }) => svc.get(user.id, params.id), {
    params: idParam,
    response: applicationDetailSchema,
    detail: {
      summary: "Get application with activity history",
      description:
        "Returns a single owned application by id, including its activity events ordered chronologically, or 404 if it does not belong to the profile.",
    },
  })
  .delete("/:id", ({ user, params }) => svc.remove(user.id, params.id), {
    params: idParam,
    response: deletedResponseSchema,
    detail: {
      summary: "Delete application",
      description:
        "Permanently deletes the owned application identified by id and returns the deleted id, or 404 if it does not belong to the profile.",
    },
  })
  .post("/:id/status", ({ user, params, body }) => svc.transitionStatus(user.id, params.id, body), {
    params: idParam,
    body: statusTransitionSchema,
    response: statusTransitionResultSchema,
    detail: {
      summary: "Transition application status",
      description:
        "Moves the owned application to the requested status, recording a status-change activity event and updating its rejection timestamp, then returns the new status (no-op if already in that status).",
    },
  })
  .post("/:id/events", ({ user, params, body }) => svc.addEvent(user.id, params.id, body), {
    params: idParam,
    body: appendNoteSchema,
    beforeHandle: limitNote,
    response: applicationEventSchema,
    detail: {
      summary: "Append a note to an application",
      description:
        "Appends a free-text note event to the owned application's activity timeline (e.g. a generated interview prep sheet) and returns the created event, or 404 if it does not belong to the profile.",
    },
  });
