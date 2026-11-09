import { Elysia } from "elysia";
import { db } from "@/common/database/prisma.client";
import { logger } from "@/common/logger";
import { errorMiddleware } from "@/common/middleware";
import { corsPlugin } from "@/common/plugins/cors.plugin";
import { openapiPlugin } from "@/common/plugins/openapi.plugin";
import { env } from "@/env";
import { adminController } from "@/modules/admin/admin.controller";
import { analyticsController } from "@/modules/analytics/analytics.controller";
import { applicationController } from "@/modules/application/application.controller";
import { authController } from "@/modules/auth/auth.controller";
import { authProvidersController } from "@/modules/auth/providers.controller";
import { securityController } from "@/modules/auth/security.controller";
import { captchaController } from "@/modules/captcha/captcha.controller";
import { contactController } from "@/modules/contact/contact.controller";
import { coverLetterController } from "@/modules/cover-letter/cover-letter.controller";
import { credentialController } from "@/modules/credential/credential.controller";
import { emailAccountController } from "@/modules/email/account/account.controller";
import { emailMessagesController } from "@/modules/email/messages.controller";
import { emailOAuthController } from "@/modules/email/oauth.controller";
import { feedController } from "@/modules/feed/feed.controller";
import { jobController } from "@/modules/feed/jobs/job.controller";
import { healthController } from "@/modules/health/health.controller";
import { adminBoardController } from "@/modules/job-board/admin-board.controller";
import { jobBoardController } from "@/modules/job-board/job-board.controller";
import { adminJobListingController } from "@/modules/job-listing/admin-listing.controller";
import { publicJobListingController } from "@/modules/job-listing/job-listing.controller";
import { pdfCacheJob } from "@/modules/maintenance/pdf-cache.job";
import { retentionJob } from "@/modules/maintenance/retention.job";
import { networkingController } from "@/modules/networking/networking.controller";
import { pilotChangesController } from "@/modules/pilot/changes/change.controller";
import { pilotJobAlertsController } from "@/modules/pilot/feeds/job-alerts.controller";
import { pilotJobLookupController } from "@/modules/pilot/feeds/job-lookup.controller";
import { pilotResearchController } from "@/modules/pilot/feeds/research.controller";
import { pilotMessagesController } from "@/modules/pilot/messages/message.controller";
import { pilotNoticesController } from "@/modules/pilot/notices/notice.controller";
import { pilotController } from "@/modules/pilot/pilot.controller";
import { profileAnswersController } from "@/modules/pilot/questions/answer.controller";
import { pilotQuestionsController } from "@/modules/pilot/questions/question.controller";
import { pilotRequestsController } from "@/modules/pilot/requests/request.controller";
import { expiryJob } from "@/modules/pilot/runs/expiry.job";
import { pilotRunsController } from "@/modules/pilot/runs/run.controller";
import { pilotTasksController } from "@/modules/pilot/tasks/tasks.controller";
import { pilotThreadController } from "@/modules/pilot/thread/thread.controller";
import { pipelineController } from "@/modules/pipeline/pipeline.controller";
import { publicPortfolioController } from "@/modules/portfolio/portfolio.controller";
import { publicResumeController, resumeController } from "@/modules/resume/resume.controller";
import { resumeVariantController } from "@/modules/resume/variants/variant.controller";
import { scoringController } from "@/modules/scoring/scoring.controller";
import { publicStatsController } from "@/modules/stats/stats.controller";
import { upworkController } from "@/modules/upwork/upwork.controller";
import { userController } from "@/modules/user/user.controller";
import { webPushController } from "@/modules/web-push/web-push.controller";
import { workspaceController } from "@/modules/workspace/workspace.controller";
import { httpErrorResponses } from "@/types/response";

const app = new Elysia()
  .use(errorMiddleware)
  .use(corsPlugin)
  .use(openapiPlugin)
  .use(pdfCacheJob)
  .use(retentionJob)
  .use(expiryJob)
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
      .use(resumeVariantController)
      .use(publicResumeController)
      .use(publicJobListingController)
      .use(publicPortfolioController)
      .use(publicStatsController)
      .use(coverLetterController)
      .use(applicationController)
      .use(scoringController)
      .use(upworkController)
      .use(feedController)
      .use(jobController)
      .use(networkingController)
      .use(pilotController)
      .use(pilotTasksController)
      .use(pilotJobAlertsController)
      .use(pilotJobLookupController)
      .use(pilotResearchController)
      .use(pilotThreadController)
      .use(pilotChangesController)
      .use(pilotMessagesController)
      .use(pilotNoticesController)
      .use(pilotRunsController)
      .use(pilotRequestsController)
      .use(pipelineController)
      .use(pilotQuestionsController)
      .use(profileAnswersController)
      .use(webPushController)
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
