import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { ContactService } from "./contact.service";

const contactService = container.resolve(ContactService);

export const contactController = new Elysia({
  prefix: "/contacts",
  detail: { tags: ["Contacts"] },
})
  .use(profileGuard)
  .get("/", ({ profileId }) => contactService.list(profileId));
