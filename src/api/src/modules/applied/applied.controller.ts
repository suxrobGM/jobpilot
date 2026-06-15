import { stageTransitionSchema } from "@jobpilot/contracts/application";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { z } from "zod/v4";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { AppliedService } from "./applied.service";

const svc = container.resolve(AppliedService);

const listQuerySchema = z.object({
  stage: z.string().trim().min(1).optional(),
  board: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

const checkQuerySchema = z.object({
  url: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  company: z.string().trim().min(1).optional(),
});

export const appliedController = new Elysia({
  prefix: "/applied",
  detail: { tags: ["Applied"] },
})
  .use(profileGuard)
  .get("/", ({ profileId, query }) => svc.list(profileId, query), { query: listQuerySchema })
  .get("/check", ({ profileId, query }) => svc.check(profileId, query), {
    query: checkQuerySchema,
  })
  .get("/:id", ({ profileId, params }) => svc.get(profileId, params.id), { params: idParam })
  .delete("/:id", ({ profileId, params }) => svc.remove(profileId, params.id), {
    params: idParam,
  })
  .post(
    "/:id/stage",
    ({ profileId, params, body }) => svc.transitionStage(profileId, params.id, body),
    { params: idParam, body: stageTransitionSchema },
  );
