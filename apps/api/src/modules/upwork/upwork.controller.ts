import { idParam } from "@jobpilot/contracts/shared";
import {
  createUpworkProposalSchema,
  patchUpworkProposalSchema,
  updateUpworkProfileSchema,
  upworkClientQualitySchema,
} from "@jobpilot/contracts/upwork";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { publish, sseStream } from "@/common/sse";
import { upworkChannel } from "@/common/sse/channels/upwork";
import { idResponseSchema } from "@/types/response";
import {
  proposalsQuery,
  upworkProfileResponseSchema,
  upworkProfileSchema,
  upworkProposalListSchema,
  upworkProposalSchema,
  upworkQualityResultSchema,
} from "./upwork.schema";
import { UpworkService } from "./upwork.service";

const svc = container.resolve(UpworkService);

export const upworkController = new Elysia({ prefix: "/upwork", detail: { tags: ["Upwork"] } })
  // --- public: deterministic client/job quality assessment (profile-independent) ---
  .post("/client-quality", ({ body }) => svc.scoreClientQuality(body.client), {
    body: upworkClientQualitySchema,
    response: upworkQualityResultSchema,
    detail: {
      summary: "Score client quality",
      description:
        "Runs the deterministic, profile-independent Upwork client/job quality assessment and returns the quality score result.",
    },
  })
  // --- profile-scoped ---
  .use(profileGuard)
  .get("/events", ({ profileId, headers }) => sseStream(upworkChannel, { profileId }, headers), {
    detail: {
      summary: "Stream Upwork events",
      description:
        "Opens a Server-Sent Events stream that emits profile and proposal change events for the active profile.",
    },
  })
  .get("/profile", ({ profileId }) => svc.getProfile(profileId), {
    response: upworkProfileResponseSchema,
    detail: {
      summary: "Get profile enhancement",
      description:
        "Returns the profile-enhancement record for the active profile, or null if none exists yet.",
    },
  })
  .put(
    "/profile",
    async ({ profileId, body }) => {
      const profile = await svc.upsertProfile(profileId, body);
      publish(upworkChannel, { profileId }, { type: "profile.updated" });
      return profile;
    },
    {
      body: updateUpworkProfileSchema,
      response: upworkProfileSchema,
      detail: {
        summary: "Upsert profile enhancement",
        description:
          "Creates or updates the profile-enhancement record for the active profile, writing only provided fields, and publishes a profile.updated event.",
      },
    },
  )
  .get("/proposals", ({ profileId, query }) => svc.listProposals(profileId, query), {
    query: proposalsQuery,
    response: upworkProposalListSchema,
    detail: {
      summary: "List proposals",
      description:
        "Returns the active profile's Upwork proposals, optionally filtered by status and a search term over job title and client name.",
    },
  })
  .post(
    "/proposals",
    async ({ profileId, body }) => {
      const proposal = await svc.createProposal(profileId, body);
      publish(upworkChannel, { profileId }, { type: "proposal.created", id: proposal.id });
      return proposal;
    },
    {
      body: createUpworkProposalSchema,
      response: upworkProposalSchema,
      detail: {
        summary: "Create proposal",
        description:
          "Creates a new Upwork proposal for the active profile, publishes a proposal.created event, and returns the created proposal.",
      },
    },
  )
  .get("/proposals/:id", ({ profileId, params }) => svc.getProposal(profileId, params.id), {
    params: idParam,
    response: upworkProposalSchema,
    detail: {
      summary: "Get proposal",
      description:
        "Returns a single Upwork proposal owned by the active profile, or 404 if it does not exist.",
    },
  })
  .patch(
    "/proposals/:id",
    async ({ profileId, params, body }) => {
      const proposal = await svc.updateProposal(profileId, params.id, body);
      publish(upworkChannel, { profileId }, { type: "proposal.updated", id: params.id });
      return proposal;
    },
    {
      params: idParam,
      body: patchUpworkProposalSchema,
      response: upworkProposalSchema,
      detail: {
        summary: "Update proposal",
        description:
          "Applies a partial update to an Upwork proposal owned by the active profile, publishes a proposal.updated event, and returns the updated proposal.",
      },
    },
  )
  .delete(
    "/proposals/:id",
    async ({ profileId, params }) => {
      const result = await svc.deleteProposal(profileId, params.id);
      publish(upworkChannel, { profileId }, { type: "proposal.deleted", id: params.id });
      return result;
    },
    {
      params: idParam,
      response: idResponseSchema,
      detail: {
        summary: "Delete proposal",
        description:
          "Deletes an Upwork proposal owned by the active profile, publishes a proposal.deleted event, and returns the deleted proposal id.",
      },
    },
  );
