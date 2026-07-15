import { statusTransitionSchema } from "@jobpilot/contracts/application";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
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
  statusTransitionResultSchema,
} from "./application.schema";
import { ApplicationService } from "./application.service";

const svc = container.resolve(ApplicationService);
const limitNote = rateLimit(RATE_LIMITS.applicationNote);

export const applicationController = new Elysia({
  prefix: "/applied",
  detail: { tags: ["Applied"] },
})
  .use(profileGuard)
  .get("/", ({ profileId, query }) => svc.list(profileId, query), {
    query: applicationListQuerySchema,
    response: applicationListSchema,
    detail: {
      summary: "List applications",
      description:
        "Returns the profile's applied jobs (up to 500, newest first), optionally filtered by status, board, source, or a search term matched against title, company, and URL.",
    },
  })
  .get("/check", ({ profileId, query }) => svc.check(profileId, query), {
    query: applicationQuerySchema,
    response: applicationCheckSchema,
    detail: {
      summary: "Check for duplicate application",
      description:
        "Checks whether the profile already applied to a job by exact URL or by a fuzzy title-and-company match within the dedupe window, returning whether a duplicate exists and the matching application when found.",
    },
  })
  .get("/:id", ({ profileId, params }) => svc.get(profileId, params.id), {
    params: idParam,
    response: applicationDetailSchema,
    detail: {
      summary: "Get application with activity history",
      description:
        "Returns a single owned application by id, including its activity events ordered chronologically, or 404 if it does not belong to the profile.",
    },
  })
  .delete("/:id", ({ profileId, params }) => svc.remove(profileId, params.id), {
    params: idParam,
    response: deletedResponseSchema,
    detail: {
      summary: "Delete application",
      description:
        "Permanently deletes the owned application identified by id and returns the deleted id, or 404 if it does not belong to the profile.",
    },
  })
  .post(
    "/:id/status",
    ({ profileId, params, body }) => svc.transitionStatus(profileId, params.id, body),
    {
      params: idParam,
      body: statusTransitionSchema,
      response: statusTransitionResultSchema,
      detail: {
        summary: "Transition application status",
        description:
          "Moves the owned application to the requested status, recording a status-change activity event and updating its rejection timestamp, then returns the new status (no-op if already in that status).",
      },
    },
  )
  .post("/:id/events", ({ profileId, params, body }) => svc.addEvent(profileId, params.id, body), {
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
