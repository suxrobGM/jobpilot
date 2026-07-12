import { captchaSolveSchema } from "@jobpilot/contracts/captcha";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { captchaSolveResultSchema } from "./captcha.schema";
import { CaptchaService } from "./captcha.service";

const svc = container.resolve(CaptchaService);

export const captchaController = new Elysia({
  prefix: "/captcha",
  detail: { tags: ["Captcha"] },
})
  .use(profileGuard)
  // After profileGuard, so `user` is derived - the policy is user-keyed. One policy covers this
  // whole instance, which is what the scoped plugin form is for.
  .use(rateLimit(RATE_LIMITS.captchaSolve))
  .post("/solve", ({ user, profileId, body }) => svc.solve(user.id, profileId, body), {
    body: captchaSolveSchema,
    response: captchaSolveResultSchema,
    detail: {
      summary: "Solve a CAPTCHA",
      description:
        "Solves the supplied CAPTCHA challenge through the active profile's configured third-party solver (2captcha or CapSolver) and returns the resolved token along with the provider that solved it.",
    },
  });
