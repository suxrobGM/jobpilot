import { credentialPatchSchema, credentialSchema } from "@jobpilot/contracts/credential";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { z } from "zod/v4";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { CredentialService } from "./credential.service";

const svc = container.resolve(CredentialService);
const ResolveQuery = z.object({ domain: z.string().trim().min(1) });

export const credentialController = new Elysia({
  prefix: "/credentials",
  detail: { tags: ["Credentials"] },
})
  .use(profileGuard)
  .get("/", ({ profileId }) => svc.list(profileId), {
    detail: {
      summary: "List credentials",
      description:
        "Returns all stored login/service credentials for the active profile, ordered by scope.",
    },
  })
  .post("/", ({ profileId, body }) => svc.create(profileId, body), {
    body: credentialSchema,
    detail: {
      summary: "Create credential",
      description:
        "Creates a new login/service credential for the active profile and returns the created record.",
    },
  })
  .get("/resolve", ({ profileId, query }) => svc.resolveCredential(profileId, query.domain), {
    query: ResolveQuery,
    detail: {
      summary: "Resolve login for domain",
      description:
        "Resolves the effective login for a board domain by precedence (per-board override, then domain-scoped credential, then default-scoped credential) and returns the matching email/password with its source and scope, or null when no complete pair is found.",
    },
  })
  .patch("/:id", ({ profileId, params, body }) => svc.update(profileId, params.id, body), {
    params: idParam,
    body: credentialPatchSchema,
    detail: {
      summary: "Update credential",
      description:
        "Updates the specified credential owned by the active profile and returns the updated record.",
    },
  })
  .delete("/:id", ({ profileId, params }) => svc.remove(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "Delete credential",
      description:
        "Deletes the specified credential owned by the active profile and returns the deleted id.",
    },
  });
