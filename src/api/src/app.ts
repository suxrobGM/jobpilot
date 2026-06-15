import { Elysia } from "elysia";
import { db } from "@/common/database";
import { logger } from "@/common/logger";
import { errorMiddleware } from "@/common/middleware";
import { corsPlugin, swaggerPlugin } from "@/common/plugins";
import { env } from "@/env";
import { authController } from "@/modules/auth";

const app = new Elysia()
  .use(errorMiddleware)
  .use(corsPlugin)
  .use(swaggerPlugin)
  .onStop(async () => {
    await db.$disconnect();
  })
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .group("/api", (api) => api.use(authController))
  .listen(env.PORT);

logger.info(`JobPilot API running at http://localhost:${app.server?.port}`);
if (env.NODE_ENV === "development") {
  logger.info(`Swagger docs at http://localhost:${app.server?.port}/swagger`);
}

// Eden Treaty contract for the frontend.
export type App = typeof app;
