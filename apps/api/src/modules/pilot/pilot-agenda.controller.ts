import { agendaResponseSchema, currentAgendaResponseSchema } from "@jobpilot/contracts/pilot";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { AgendaService } from "./agenda/service";

const agenda = container.resolve(AgendaService);
const limitAgenda = rateLimit(RATE_LIMITS.pilotAgenda);

export const pilotAgendaController = new Elysia({ prefix: "/pilot", detail: { tags: ["Pilot"] } })
  .use(authGuard)
  .get("/agenda", ({ user }) => agenda.getCurrent(user.id), {
    beforeHandle: limitAgenda,
    response: currentAgendaResponseSchema,
    detail: {
      summary: "Get the current agenda snapshot",
      description:
        "Returns the current unexpired agenda snapshot without running expiry, promotion, digest, or any other mutation.",
    },
  })
  .post("/agenda/refresh", ({ user }) => agenda.refresh(user.id), {
    beforeHandle: limitAgenda,
    response: agendaResponseSchema,
    detail: {
      summary: "Refresh the agenda snapshot",
      description:
        "Runs lifecycle maintenance, compiles a typed agenda, persists a new expiring version, and returns that snapshot.",
    },
  });
