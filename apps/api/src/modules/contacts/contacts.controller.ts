import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { ContactsService } from "./contacts.service";

const contactsService = container.resolve(ContactsService);

export const contactsController = new Elysia({
  prefix: "/contacts",
  detail: { tags: ["Contacts"] },
})
  .use(profileGuard)
  .get("/", ({ profileId }) => contactsService.list(profileId));
