import { profileWithAutoApplySchema } from "@jobpilot/contracts/profile";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { ProfileService } from "./profile.service";

const svc = container.resolve(ProfileService);

export const profileController = new Elysia({
  prefix: "/profile",
  detail: { tags: ["Profile"] },
})
  .use(profileGuard)
  .get("/", ({ profileId }) => svc.get(profileId))
  .put("/", ({ profileId, body }) => svc.update(profileId, body), {
    body: profileWithAutoApplySchema,
  });
