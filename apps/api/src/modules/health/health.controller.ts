import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { healthStatusSchema } from "./health.schema";
import { HealthService } from "./health.service";

const healthService = container.resolve(HealthService);

export const healthController = new Elysia({
  prefix: "/health",
  detail: { tags: ["Health"] },
}).get("/", () => healthService.status(), {
  response: healthStatusSchema,
  detail: {
    summary: "Check API liveness",
    description:
      "Returns the API liveness status, including the running application version and the current server time.",
  },
});
