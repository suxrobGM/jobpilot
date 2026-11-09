import { captchaSolveSchema } from "@jobpilot/contracts/captcha";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { captchaSolveResultSchema } from "./captcha.schema";
import { CaptchaService } from "./captcha.service";

const svc = container.get(CaptchaService);

// Runs after authGuard's derive, so `user` is in context - the policy is user-keyed.

export const captchaController = new Elysia({
  prefix: "/captcha",
  detail: { tags: ["Captcha"] },
})
  .use(authGuard)
  .post("/solve", ({ user, body }) => svc.solve(user.id, body), {
    body: captchaSolveSchema,
    // Runs after authGuard's derive, so `user` is in context - the policy is user-keyed.
    beforeHandle: rateLimit(RATE_LIMITS.captchaSolve),
    response: captchaSolveResultSchema,
    detail: {
      summary: "Solve a CAPTCHA",
      description:
        "Solves the supplied CAPTCHA challenge through the user's configured third-party solver (2captcha or CapSolver) and returns the resolved token along with the provider that solved it.",
    },
  });
