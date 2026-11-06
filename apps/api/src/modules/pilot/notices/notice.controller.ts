import { pilotNoticeListSchema, pilotNoticeParamsSchema } from "@jobpilot/contracts/pilot";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { NoticeService } from "./notice.service";

const notices = container.get(NoticeService);

export const pilotNoticesController = new Elysia({
  prefix: "/pilot/notices",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
  .get("/", ({ user }) => notices.list(user.id), {
    response: pilotNoticeListSchema,
    detail: {
      summary: "Read the heads-up notices",
      description:
        "Computed from live data on each read: missing email, unread mail, no replies, near-miss scores, an unused cap.",
    },
  })
  .post("/:key/dismiss", ({ user, params }) => notices.dismiss(user.id, params.key), {
    params: pilotNoticeParamsSchema,
    beforeHandle: rateLimit(RATE_LIMITS.pilotMutation),
    response: pilotNoticeListSchema,
    detail: {
      summary: "Dismiss a notice",
      description: "Hides it for 14 days and returns the notices still showing.",
    },
  });
