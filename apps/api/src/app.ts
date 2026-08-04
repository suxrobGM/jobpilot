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
import { authController, authProvidersController, securityController } from "@/modules/auth";
import {
  campaignController,
  campaignJobController,
  campaignNetworkingController,
} from "@/modules/campaign";
import { captchaController } from "@/modules/captcha";
import { contactController } from "@/modules/contact";
import { coverLetterController } from "@/modules/cover-letter";
import { credentialController } from "@/modules/credential";
import {
  emailAccountController,
  emailMessagesController,
  emailOAuthController,
} from "@/modules/email";
import { healthController } from "@/modules/health";
import { adminBoardController, jobBoardController } from "@/modules/job-board";
import { adminJobListingController, publicJobListingController } from "@/modules/job-listing";
import { cleanupJob } from "@/modules/maintenance";
import {
  pilotAgendaController,
  pilotClaimsController,
  pilotController,
  pilotJournalController,
  pilotQuestionsController,
  pilotSearchController,
  promotionController,
} from "@/modules/pilot";
import { publicPortfolioController } from "@/modules/portfolio";
import { pushController } from "@/modules/push";
import {
  publicResumeController,
  resumeController,
  resumeFileController,
  resumeJob,
  resumeVariantController,
} from "@/modules/resume";
import { scoringController } from "@/modules/scoring";
import { upworkController } from "@/modules/upwork";
import { userController } from "@/modules/user";
import { workspaceController } from "@/modules/workspace";
import { httpErrorResponses } from "@/types/response";

const app = new Elysia()
  .use(errorMiddleware)
  .use(corsPlugin)
  .use(swaggerPlugin)
  .use(resumeJob)
  .use(cleanupJob)
  .onStop(async () => {
    await db.$disconnect();
  })
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))

  .guard({ as: "scoped", response: httpErrorResponses })
  .group("/api", (api) =>
    api
      .use(authController)
      .use(securityController)
      .use(authProvidersController)
      .use(healthController)
      .use(jobBoardController)
      .use(credentialController)
      .use(contactController)
      .use(analyticsController)
      .use(captchaController)
      .use(userController)
      .use(resumeController)
      .use(resumeFileController)
      .use(resumeVariantController)
      .use(publicResumeController)
      .use(publicJobListingController)
      .use(publicPortfolioController)
      .use(coverLetterController)
      .use(applicationController)
      .use(scoringController)
      .use(upworkController)
      .use(campaignController)
      .use(campaignJobController)
      .use(campaignNetworkingController)
      .use(pilotController)
      .use(pilotSearchController)
      .use(pilotAgendaController)
      .use(pilotClaimsController)
      .use(pilotJournalController)
      .use(pilotQuestionsController)
      .use(promotionController)
      .use(pushController)
      .use(workspaceController)
      .use(emailAccountController)
      .use(emailMessagesController)
      .use(emailOAuthController)
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
