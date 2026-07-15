import "@/common/di/container";
import { Elysia } from "elysia";
import { db } from "@/common/database";
import { logger } from "@/common/logger";
import { errorMiddleware } from "@/common/middleware";
import { corsPlugin, swaggerPlugin } from "@/common/plugins";
import { env } from "@/env";
import { adminController } from "@/modules/admin";
import { analyticsController } from "@/modules/analytics";
import { applicationController } from "@/modules/application";
import { authController } from "@/modules/auth";
import { campaignController } from "@/modules/campaign";
import { captchaController } from "@/modules/captcha";
import { contactController } from "@/modules/contact";
import { coverLetterController } from "@/modules/cover-letter";
import { credentialController } from "@/modules/credential";
import { emailController } from "@/modules/email";
import { healthController } from "@/modules/health";
import { adminBoardController, jobBoardController } from "@/modules/job-board";
import { adminJobListingController, publicJobListingController } from "@/modules/job-listing";
import { pilotController } from "@/modules/pilot";
import { profileController } from "@/modules/profile";
import { queueController } from "@/modules/queue";
import { publicResumeController, resumeController, resumeJob } from "@/modules/resume";
import { scoringController } from "@/modules/scoring";
import { upworkController } from "@/modules/upwork";
import { workspaceController } from "@/modules/workspace";
import { httpErrorResponses } from "@/types/response";

const app = new Elysia()
  .use(errorMiddleware)
  .use(corsPlugin)
  .use(swaggerPlugin)
  .use(resumeJob)
  .onStop(async () => {
    await db.$disconnect();
  })
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))

  .guard({ as: "scoped", response: httpErrorResponses })
  .group("/api", (api) =>
    api
      .use(authController)
      .use(healthController)
      .use(jobBoardController)
      .use(credentialController)
      .use(queueController)
      .use(contactController)
      .use(analyticsController)
      .use(captchaController)
      .use(profileController)
      .use(resumeController)
      .use(publicResumeController)
      .use(publicJobListingController)
      .use(coverLetterController)
      .use(applicationController)
      .use(scoringController)
      .use(upworkController)
      .use(campaignController)
      .use(pilotController)
      .use(workspaceController)
      .use(emailController)
      // Mounted one by one: an array widens them to AnyElysia and collapses the `App` type Eden reads.
      .use(adminController)
      .use(adminBoardController)
      .use(adminJobListingController),
  )
  .listen(env.PORT);

logger.info(`JobPilot API running at http://localhost:${app.server?.port}`);
if (env.NODE_ENV === "development") {
  logger.info(`Swagger docs at http://localhost:${app.server?.port}/swagger`);
}

// Eden Treaty contract for the frontend.
export type App = typeof app;
