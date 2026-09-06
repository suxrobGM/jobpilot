import {
  createPilotClaimSchema,
  pilotClaimSchema,
  releasePilotClaimSchema,
} from "@jobpilot/contracts/pilot";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { ClaimService } from "./agenda/claim.service";

const claims = container.resolve(ClaimService);
const limitClaim = rateLimit(RATE_LIMITS.pilotClaim);

export const pilotClaimsController = new Elysia({ prefix: "/pilot", detail: { tags: ["Pilot"] } })
  .use(authGuard)
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
  );
