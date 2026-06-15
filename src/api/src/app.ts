import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { env } from "@/env";

// NOTE: skeleton boot (Phase 1). Database, middleware, and controllers are wired
// in later phases. `export type App` is the Eden Treaty contract for the frontend.
const app = new Elysia()
  .use(cors({ origin: env.CORS_ORIGINS.split(","), credentials: true }))
  .use(
    swagger({
      documentation: { info: { title: "JobPilot API", version: "2.0.0" } },
    }),
  )
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .listen(env.PORT);

console.log(`JobPilot API running at http://localhost:${app.server?.port}`);
if (env.NODE_ENV === "development") {
  console.log(`Swagger docs at http://localhost:${app.server?.port}/swagger`);
}

export type App = typeof app;
