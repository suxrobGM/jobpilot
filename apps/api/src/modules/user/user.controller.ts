import {
  portfolioSettingsPatchSchema,
  setPrimaryResumeSchema,
  usernameSchema,
  userWithAutoApplySchema,
} from "@jobpilot/contracts/user";
import { Elysia } from "elysia";
import { z } from "zod/v4";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { portfolioSchema } from "@/modules/portfolio/portfolio.schema";
import { PortfolioService } from "@/modules/portfolio/portfolio.service";
import { idResponseSchema } from "@/types/response";
import {
  portfolioSettingsSchema,
  primaryResumeSetSchema,
  userAggregateSchema,
  usernameAvailabilitySchema,
} from "./user.schema";
import { UserService } from "./user.service";

const svc = container.resolve(UserService);
const portfolioSvc = container.resolve(PortfolioService);

export const userController = new Elysia({
  prefix: "/user",
  detail: { tags: ["User"] },
})
  .use(authGuard)
  .get("/", ({ user }) => svc.get(user.id), {
    response: userAggregateSchema,
    detail: {
      summary: "Get current user",
      description:
        "Returns the current user aggregate, including its auto-apply settings, references, and resumes.",
    },
  })
  .put("/", ({ user, body }) => svc.update(user.id, body), {
    body: userWithAutoApplySchema,
    response: idResponseSchema,
    detail: {
      summary: "Replace current user",
      description:
        "Performs a full replace of the current user's applicant data and auto-apply settings, returning the updated user id.",
    },
  })
  .put("/primary-resume", ({ user, body }) => svc.setPrimaryResume(user.id, body.resumeId), {
    body: setPrimaryResumeSchema,
    response: primaryResumeSetSchema,
    detail: {
      summary: "Set primary resume",
      description:
        "Marks one of the user's resumes as primary (or clears it with `null`), returning the new primary resume id.",
    },
  })
  .get("/portfolio", ({ user }) => svc.getPortfolioSettings(user.id), {
    response: portfolioSettingsSchema,
    detail: {
      summary: "Get public-portfolio settings",
      description:
        "Returns the user's portfolio username, availability status, and the four show/hide flags for the resume and links.",
    },
  })
  .get("/portfolio/preview", ({ user }) => portfolioSvc.previewByUserId(user.id), {
    response: portfolioSchema,
    detail: {
      summary: "Preview own portfolio",
      description:
        "Renders the owner's portfolio card exactly as visitors would see it, hidden links included - backs the settings live preview.",
    },
  })
  .get("/portfolio/available", ({ user, query }) => svc.checkUsername(user.id, query.username), {
    query: z.object({ username: usernameSchema }),
    response: usernameAvailabilitySchema,
    detail: {
      summary: "Check username availability",
      description:
        "Whether the given username is free for this user to claim (own current one counts as free).",
    },
  })
  .patch("/portfolio", ({ user, body }) => svc.updatePortfolioSettings(user.id, body), {
    body: portfolioSettingsPatchSchema,
    response: portfolioSettingsSchema,
    detail: {
      summary: "Update public-portfolio settings",
      description:
        "Sets/changes the portfolio username (409 if taken), the availability status, and which of the resume and links are shown publicly.",
    },
  });
