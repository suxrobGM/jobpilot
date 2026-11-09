import {
  createPilotChangeSchema,
  pilotChangeListSchema,
  pilotChangeSchema,
  pilotChangesQuerySchema,
} from "@jobpilot/contracts/pilot";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { ChangeService } from "./change.service";

const changes = container.get(ChangeService);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

export const pilotChangesController = new Elysia({
  prefix: "/pilot/changes",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
  .get("/", ({ user, query }) => changes.list(user.id, query.status), {
    query: pilotChangesQuerySchema,
    response: pilotChangeListSchema,
    detail: {
      summary: "List changes",
      description: "The user's newest 100 changes to rules, searches, answers and jobs.",
    },
  })
  .post("/", ({ user, body }) => changes.create(user.id, body), {
    body: createPilotChangeSchema,
    beforeHandle: limitMutation,
    response: pilotChangeSchema,
    detail: {
      summary: "Make or propose a change",
      description:
        "Applies the actions in one transaction and stores their inverse for Undo, or with propose: true stores them for the user to apply or dismiss. A pilot change to rules or answers must be a proposal.",
    },
  })
  .post("/:id/apply", ({ user, params }) => changes.applyProposed(user.id, params.id), {
    params: idParam,
    beforeHandle: limitMutation,
    response: pilotChangeSchema,
    detail: { summary: "Apply a proposed change", description: "Applies a proposal with Undo." },
  })
  .post("/:id/dismiss", ({ user, params }) => changes.dismiss(user.id, params.id), {
    params: idParam,
    beforeHandle: limitMutation,
    response: pilotChangeSchema,
    detail: { summary: "Dismiss a proposed change", description: "Drops a proposal unapplied." },
  })
  .post("/:id/undo", ({ user, params }) => changes.undo(user.id, params.id), {
    params: idParam,
    beforeHandle: limitMutation,
    response: pilotChangeSchema,
    detail: {
      summary: "Undo a change",
      description: "Replays an applied change's inverse, up to 7 days after it was applied.",
    },
  });
