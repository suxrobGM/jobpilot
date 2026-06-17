import { credentialPatchSchema, credentialSchema } from "@jobpilot/contracts/credential";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { deletedResponseSchema } from "@/types/response";
import {
  credentialListSchema,
  credentialRecordSchema,
  domainResolveQuery,
  resolvedCredentialSchema,
} from "./credential.schema";
import { CredentialService } from "./credential.service";

const svc = container.resolve(CredentialService);

export const credentialController = new Elysia({
  prefix: "/credentials",
  detail: { tags: ["Credentials"] },
})
  .use(profileGuard)
  .get("/", ({ user, profileId }) => svc.list(user.id, profileId), {
    response: credentialListSchema,
    detail: {
      summary: "List credentials",
      description:
        "Returns all stored login/service credentials for the active profile, ordered by scope.",
    },
  })
  .post("/", ({ user, profileId, body }) => svc.create(user.id, profileId, body), {
    body: credentialSchema,
    response: credentialRecordSchema,
    detail: {
      summary: "Create credential",
      description:
        "Creates a new login/service credential for the active profile and returns the created record.",
    },
  })
  .get(
    "/resolve",
    ({ user, profileId, query }) => svc.resolveCredential(user.id, profileId, query.domain),
    {
      query: domainResolveQuery,
      response: resolvedCredentialSchema,
      detail: {
        summary: "Resolve login for domain",
        description:
          "Resolves the effective login for a board domain by precedence (per-board override, then domain-scoped credential, then default-scoped credential) and returns the matching email/password with its source and scope, or null when no complete pair is found.",
      },
    },
  )
  .patch(
    "/:id",
    ({ user, profileId, params, body }) => svc.update(user.id, profileId, params.id, body),
    {
      params: idParam,
      body: credentialPatchSchema,
      response: credentialRecordSchema,
      detail: {
        summary: "Update credential",
        description:
          "Updates the specified credential owned by the active profile and returns the updated record.",
      },
    },
  )
  .delete("/:id", ({ profileId, params }) => svc.remove(profileId, params.id), {
    params: idParam,
    response: deletedResponseSchema,
    detail: {
      summary: "Delete credential",
      description:
        "Deletes the specified credential owned by the active profile and returns the deleted id.",
    },
  });
