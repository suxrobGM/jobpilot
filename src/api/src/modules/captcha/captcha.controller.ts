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
  });
