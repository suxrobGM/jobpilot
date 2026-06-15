import { Elysia } from "elysia";
import { container } from "@/common/di";
import { HealthService } from "./health.service";

const healthService = container.resolve(HealthService);

export const healthController = new Elysia({
  prefix: "/health",
  detail: { tags: ["Health"] },
}).get("/", () => healthService.status());
