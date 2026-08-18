import { Elysia } from "elysia";
import { container } from "@/common/di";
import { authGuard } from "@/common/middleware";
import { networkingMessageListSchema, networkingMessageQuerySchema } from "./networking.schema";
import { CampaignNetworkingService } from "./networking.service";

const svc = container.resolve(CampaignNetworkingService);

export const networkingMessageController = new Elysia({
  prefix: "/networking",
  detail: { tags: ["Campaigns"] },
})
  .use(authGuard)
  .get("/messages", ({ user, query }) => svc.listNetworking(user.id, { ...query, order: "desc" }), {
    query: networkingMessageQuerySchema,
    response: networkingMessageListSchema,
    detail: {
      summary: "List networking messages across campaigns",
      description:
        "Returns one page of the active profile's networking messages, newest first, as `{ items, pagination }`. Optional `status` and `campaignId` filters.",
    },
  });
