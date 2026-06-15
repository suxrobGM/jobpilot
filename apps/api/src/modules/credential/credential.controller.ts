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
  .get("/", ({ profileId }) => svc.list(profileId))
  .post("/", ({ profileId, body }) => svc.create(profileId, body), { body: credentialSchema })
  .get("/resolve", ({ profileId, query }) => svc.resolveCredential(profileId, query.domain), {
    query: ResolveQuery,
  })
  .patch("/:id", ({ profileId, params, body }) => svc.update(profileId, params.id, body), {
    params: idParam,
    body: credentialPatchSchema,
  })
  .delete("/:id", ({ profileId, params }) => svc.remove(profileId, params.id), {
    params: idParam,
  });
