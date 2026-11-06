import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { researchStatusSchema } from "./pilot.schema";
import { ResearchService } from "./research.service";

const research = container.get(ResearchService);

export const pilotResearchController = new Elysia({
  prefix: "/pilot",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
  .get("/research", ({ user }) => research.getStatus(user.id), {
    response: researchStatusSchema,
    detail: {
      summary: "Get the research status",
      description: "Returns the last research run with its summary and the standing research feed.",
    },
  });
