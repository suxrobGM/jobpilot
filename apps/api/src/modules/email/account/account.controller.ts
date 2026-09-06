import { sendEmailSchema } from "@jobpilot/contracts/networking";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { accountDisconnectedSchema, accountStatusSchema, sentMessageSchema } from "../email.schema";
import { EmailAccountService } from "./account.service";

const account = container.resolve(EmailAccountService);

/** Mailbox account status, disconnect, and outbound send. */
export const emailAccountController = new Elysia({
  prefix: "/email",
  detail: { tags: ["Email"] },
})
  .use(authGuard)
  .get("/account", ({ user }) => account.accountStatus(user.id), {
    response: accountStatusSchema,
    detail: {
      summary: "Get mailbox account status",
      description:
        "Returns the connection status of the profile's linked email account, including provider, email address, last sync time, and whether it can send.",
    },
  })
  .delete("/account", ({ user }) => account.disconnectAccount(user.id), {
    response: accountDisconnectedSchema,
    detail: {
      summary: "Disconnect mailbox account",
      description:
        "Removes the profile's connected email account and returns a confirmation that it was disconnected.",
    },
  })
  .post("/send", ({ user, body }) => account.send(user.id, body), {
    body: sendEmailSchema,
    response: sentMessageSchema,
    detail: {
      summary: "Send outbound email",
      description:
        "Sends an email from the profile's connected mailbox (refreshing the token first), and returns the provider send result or errors when no account is connected or the mailbox lacks send access.",
    },
  });
