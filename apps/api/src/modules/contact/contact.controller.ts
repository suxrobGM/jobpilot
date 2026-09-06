import { paginationQuerySchema } from "@jobpilot/contracts/pagination";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { contactListSchema } from "./contact.schema";
import { ContactService } from "./contact.service";

const contactService = container.resolve(ContactService);

export const contactController = new Elysia({
  prefix: "/contacts",
  detail: { tags: ["Contacts"] },
})
  .use(authGuard)
  .get("/", ({ user, query }) => contactService.list(user.id, query), {
    query: paginationQuerySchema,
    response: contactListSchema,
    detail: {
      summary: "List networking contacts",
      description:
        "Returns one page of the active profile's networking contacts, ordered newest first, as `{ items, pagination }`.",
    },
  });
