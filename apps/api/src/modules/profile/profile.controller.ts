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
  .get("/", ({ profileId }) => svc.get(profileId), {
    detail: {
      summary: "Get active profile",
      description:
        "Returns the active profile aggregate, including its auto-apply settings, references, and resumes.",
    },
  })
  .put("/", ({ profileId, body }) => svc.update(profileId, body), {
    body: profileWithAutoApplySchema,
    detail: {
      summary: "Replace active profile",
      description:
        "Performs a full replace of the active profile and its auto-apply settings, returning the updated profile aggregate.",
    },
  });
