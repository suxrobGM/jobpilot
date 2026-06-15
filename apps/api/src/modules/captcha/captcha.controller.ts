import { captchaSolveSchema } from "@jobpilot/contracts/captcha";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { CaptchaService } from "./captcha.service";

const svc = container.resolve(CaptchaService);

export const captchaController = new Elysia({
  prefix: "/captcha",
  detail: { tags: ["Captcha"] },
})
  .use(profileGuard)
  .post("/solve", ({ profileId, body }) => svc.solve(profileId, body), {
    body: captchaSolveSchema,
    detail: {
      summary: "Solve a CAPTCHA",
      description:
        "Solves the supplied CAPTCHA challenge through the active profile's configured third-party solver (2captcha or CapSolver) and returns the resolved token along with the provider that solved it.",
    },
  });
