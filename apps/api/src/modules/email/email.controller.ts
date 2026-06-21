import { Elysia } from "elysia";
import { emailAccountController } from "./account/account.controller";
import { emailMessagesController } from "./messages.controller";
import { emailOAuthController } from "./oauth.controller";

/** Email module — composes the account, messages, and OAuth sub-controllers under /email. */
export const emailController = new Elysia({
  prefix: "/email",
  detail: { tags: ["Email"] },
})
  .use(emailAccountController)
  .use(emailMessagesController)
  .use(emailOAuthController);
