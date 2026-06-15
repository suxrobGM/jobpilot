import "@/common/di/container";
import { Elysia } from "elysia";
import { db } from "@/common/database";
import { logger } from "@/common/logger";
import { errorMiddleware } from "@/common/middleware";
import { corsPlugin, swaggerPlugin } from "@/common/plugins";
import { env } from "@/env";
import { analyticsController } from "@/modules/analytics";
import { authController } from "@/modules/auth";
import { captchaController } from "@/modules/captcha";
import { contactsController } from "@/modules/contacts";
import { credentialsController } from "@/modules/credentials";
import { healthController } from "@/modules/health";
import { jobBoardsController } from "@/modules/job-boards";
import { queueController } from "@/modules/queue";

const app = new Elysia()
  .use(errorMiddleware)
  .use(corsPlugin)
  .use(swaggerPlugin)
  .onStop(async () => {
    await db.$disconnect();
  })
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .group("/api", (api) =>
    api
      .use(authController)
      .use(healthController)
      .use(jobBoardsController)
      .use(credentialsController)
      .use(queueController)
      .use(contactsController)
      .use(analyticsController)
      .use(captchaController),
  )
  .listen(env.PORT);

logger.info(`JobPilot API running at http://localhost:${app.server?.port}`);
if (env.NODE_ENV === "development") {
  logger.info(`Swagger docs at http://localhost:${app.server?.port}/swagger`);
}

// Eden Treaty contract for the frontend.
export type App = typeof app;
