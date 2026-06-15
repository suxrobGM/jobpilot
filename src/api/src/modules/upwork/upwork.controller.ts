import { idParam } from "@jobpilot/contracts/shared";
import {
  createUpworkProposalSchema,
  patchUpworkProposalSchema,
  updateUpworkProfileSchema,
  upworkClientQualitySchema,
} from "@jobpilot/contracts/upwork";
import { Elysia } from "elysia";
import { z } from "zod/v4";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { publish, sseResponse, subscribe } from "@/common/sse";
import { upworkChannel } from "@/common/sse/channels/upwork";
import { UpworkService } from "./upwork.service";

const svc = container.resolve(UpworkService);

const proposalsQuery = z.object({
  status: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

export const upworkController = new Elysia({ prefix: "/upwork", detail: { tags: ["Upwork"] } })
  // --- public: deterministic client/job quality assessment (profile-independent) ---
  .post("/client-quality", ({ body }) => svc.scoreClientQuality(body.client), {
    body: upworkClientQualitySchema,
  })
  // --- profile-scoped ---
  .use(profileGuard)
  .get("/events", ({ profileId }) => sseResponse(subscribe(upworkChannel, { profileId })))
  .get("/profile", ({ profileId }) => svc.getProfile(profileId))
  .put(
    "/profile",
    async ({ profileId, body }) => {
      const profile = await svc.upsertProfile(profileId, body);
      publish(upworkChannel, { profileId }, { type: "profile.updated" });
      return profile;
    },
    { body: updateUpworkProfileSchema },
  )
  .get("/proposals", ({ profileId, query }) => svc.listProposals(profileId, query), {
    query: proposalsQuery,
  })
  .post(
    "/proposals",
    async ({ profileId, body }) => {
      const proposal = await svc.createProposal(profileId, body);
      publish(upworkChannel, { profileId }, { type: "proposal.created", id: proposal.id });
      return proposal;
    },
    { body: createUpworkProposalSchema },
  )
  .get("/proposals/:id", ({ profileId, params }) => svc.getProposal(profileId, params.id), {
    params: idParam,
  })
  .patch(
    "/proposals/:id",
    async ({ profileId, params, body }) => {
      const proposal = await svc.updateProposal(profileId, params.id, body);
      publish(upworkChannel, { profileId }, { type: "proposal.updated", id: params.id });
      return proposal;
    },
    { params: idParam, body: patchUpworkProposalSchema },
  )
  .delete(
    "/proposals/:id",
    async ({ profileId, params }) => {
      const result = await svc.deleteProposal(profileId, params.id);
      publish(upworkChannel, { profileId }, { type: "proposal.deleted", id: params.id });
      return result;
    },
    { params: idParam },
  );
