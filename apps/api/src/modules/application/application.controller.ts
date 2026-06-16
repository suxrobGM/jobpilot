import { stageTransitionSchema } from "@jobpilot/contracts/application";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { applicationListQuerySchema, applicationQuerySchema } from "./application.schema";
import { ApplicationService } from "./application.service";

const svc = container.resolve(ApplicationService);

export const applicationController = new Elysia({
  prefix: "/applied",
  detail: { tags: ["Applied"] },
})
  .use(profileGuard)
  .get("/", ({ profileId, query }) => svc.list(profileId, query), {
    query: applicationListQuerySchema,
    detail: {
      summary: "List applications",
      description:
        "Returns the profile's applied jobs (up to 500, newest first), optionally filtered by stage, board, source, or a search term matched against title, company, and URL.",
    },
  })
  .get("/check", ({ profileId, query }) => svc.check(profileId, query), {
    query: applicationQuerySchema,
    detail: {
      summary: "Check for duplicate application",
      description:
        "Checks whether the profile already applied to a job by exact URL or by a fuzzy title-and-company match within the dedupe window, returning whether a duplicate exists and the matching application when found.",
    },
  })
  .get("/:id", ({ profileId, params }) => svc.get(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "Get application with stage history",
      description:
        "Returns a single owned application by id, including its stage transition events ordered chronologically, or 404 if it does not belong to the profile.",
    },
  })
  .delete("/:id", ({ profileId, params }) => svc.remove(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "Delete application",
      description:
        "Permanently deletes the owned application identified by id and returns the deleted id, or 404 if it does not belong to the profile.",
    },
  })
  .post(
    "/:id/stage",
    ({ profileId, params, body }) => svc.transitionStage(profileId, params.id, body),
    {
      params: idParam,
      body: stageTransitionSchema,
      detail: {
        summary: "Transition application stage",
        description:
          "Moves the owned application to the requested interview stage, recording a stage event and updating its outcome and rejection timestamp, then returns the new stage (no-op if already in that stage).",
      },
    },
  );
