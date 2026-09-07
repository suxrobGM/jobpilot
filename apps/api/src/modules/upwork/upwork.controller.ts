import { idParam } from "@jobpilot/contracts/shared";
import { upworkChannel } from "@jobpilot/contracts/sse";
import {
  createUpworkProposalSchema,
  patchUpworkInboxItemSchema,
  patchUpworkProposalSchema,
  syncUpworkInboxSchema,
  updateUpworkAccountSchema,
  updateUpworkProfileSchema,
  upworkClientQualitySchema,
} from "@jobpilot/contracts/upwork";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { publish, sseStream } from "@/common/sse";
import { idResponseSchema } from "@/types/response";
import {
  inboxQuery,
  proposalsQuery,
  upworkAccountResponseSchema,
  upworkAccountSchema,
  upworkInboxItemSchema,
  upworkInboxListSchema,
  upworkInboxSyncResultSchema,
  upworkProfileResponseSchema,
  upworkProfileSchema,
  upworkProposalListSchema,
  upworkProposalSchema,
  upworkQualityResultSchema,
} from "./upwork.schema";
import { UpworkService } from "./upwork.service";

const svc = container.resolve(UpworkService);

export const upworkController = new Elysia({ prefix: "/upwork", detail: { tags: ["Upwork"] } })
  .post("/client-quality", ({ body }) => svc.scoreClientQuality(body.client), {
    body: upworkClientQualitySchema,
    response: upworkQualityResultSchema,
    detail: {
      summary: "Score client quality",
      description:
        "Runs the deterministic, profile-independent Upwork client/job quality assessment and returns the quality score result.",
    },
  })
  .use(authGuard)
  .get("/events", ({ user, headers }) => sseStream(upworkChannel, { userId: user.id }, headers), {
    detail: {
      summary: "Stream Upwork events",
      description:
        "Opens a Server-Sent Events stream that emits profile and proposal change events for the user.",
    },
  })
  .get("/profile", ({ user }) => svc.getProfile(user.id), {
    response: upworkProfileResponseSchema,
    detail: {
      summary: "Get profile enhancement",
      description:
        "Returns the profile-enhancement record for the user, or null if none exists yet.",
    },
  })
  .put(
    "/profile",
    async ({ user, body }) => {
      const profile = await svc.upsertProfile(user.id, body);
      publish(upworkChannel, { userId: user.id }, { type: "profile.updated" });
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
  .get("/account", ({ user }) => svc.getAccount(user.id), {
    response: upworkAccountResponseSchema,
    detail: {
      summary: "Get account snapshot",
      description:
        "Returns the mirrored Upwork account snapshot for the user, or null before the first sync.",
    },
  })
  .put(
    "/account",
    async ({ user, body }) => {
      const account = await svc.upsertAccount(user.id, body);
      publish(upworkChannel, { userId: user.id }, { type: "account.updated" });
      return account;
    },
    {
      body: updateUpworkAccountSchema,
      response: upworkAccountSchema,
      detail: {
        summary: "Upsert account snapshot",
        description:
          "Writes the Connects balance the agent read from the Upwork MCP, stamps the sync time, and publishes an account.updated event.",
      },
    },
  )
  .get("/inbox", ({ user, query }) => svc.listInbox(user.id, query), {
    query: inboxQuery,
    response: upworkInboxListSchema,
    detail: {
      summary: "List inbox items",
      description:
        "Returns one page of the user's mirrored Upwork invitations, offers and message threads as `{ items, pagination }`, newest received first, optionally filtered by kind and status.",
    },
  })
  .post(
    "/inbox/sync",
    async ({ user, body }) => {
      const result = await svc.syncInbox(user.id, body);
      publish(upworkChannel, { userId: user.id }, { type: "inbox.synced" });
      return result;
    },
    {
      body: syncUpworkInboxSchema,
      response: upworkInboxSyncResultSchema,
      detail: {
        summary: "Sync inbox items",
        description:
          "Upserts a batch of invitations, offers and message threads read from the Upwork MCP, keyed on Upwork's own id, and publishes an inbox.synced event. A user's read or archived status survives the sync.",
      },
    },
  )
  .patch(
    "/inbox/:id",
    async ({ user, params, body }) => {
      const item = await svc.updateInboxItem(user.id, params.id, body);
      publish(upworkChannel, { userId: user.id }, { type: "inbox.updated", id: params.id });
      return item;
    },
    {
      params: idParam,
      body: patchUpworkInboxItemSchema,
      response: upworkInboxItemSchema,
      detail: {
        summary: "Update inbox item status",
        description:
          "Sets the read status of one inbox item owned by the user, publishes an inbox.updated event, and returns the updated item.",
      },
    },
  )
  .get("/proposals", ({ user, query }) => svc.listProposals(user.id, query), {
    query: proposalsQuery,
    response: upworkProposalListSchema,
    detail: {
      summary: "List proposals",
      description:
        "Returns one page of the active profile's Upwork proposals as `{ items, pagination }`, newest-updated first, optionally filtered by status and a search term over job title and client name.",
    },
  })
  .post(
    "/proposals",
    async ({ user, body }) => {
      const proposal = await svc.createProposal(user.id, body);
      publish(upworkChannel, { userId: user.id }, { type: "proposal.created", id: proposal.id });
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
  .get("/proposals/:id", ({ user, params }) => svc.getProposal(user.id, params.id), {
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
    async ({ user, params, body }) => {
      const proposal = await svc.updateProposal(user.id, params.id, body);
      publish(upworkChannel, { userId: user.id }, { type: "proposal.updated", id: params.id });
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
    async ({ user, params }) => {
      const result = await svc.deleteProposal(user.id, params.id);
      publish(upworkChannel, { userId: user.id }, { type: "proposal.deleted", id: params.id });
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
