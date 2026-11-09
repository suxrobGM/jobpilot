import {
  ChangeEmailSchema,
  ChangePasswordSchema,
  ConfirmEmailChangeSchema,
  DeleteAccountSchema,
} from "@jobpilot/contracts/auth";
import { Elysia } from "elysia";
import { clearSessionCookie } from "@/common/auth";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { okResponseSchema } from "@/types/response";
import { SecurityService } from "./security.service";
import { VerificationService } from "./verification.service";

const securityService = container.get(SecurityService);
const verificationService = container.get(VerificationService);

const limitEmailChangeConfirm = rateLimit(RATE_LIMITS.emailChangeConfirm);
const limitPasswordChange = rateLimit(RATE_LIMITS.passwordChange);
const limitEmailChange = rateLimit(RATE_LIMITS.emailChange);
const limitAccountDelete = rateLimit(RATE_LIMITS.accountDelete);

export const securityController = new Elysia({ prefix: "/auth", detail: { tags: ["Auth"] } })
  .post("/email/change/confirm", ({ body }) => verificationService.confirmEmailChange(body.token), {
    body: ConfirmEmailChangeSchema,
    beforeHandle: limitEmailChangeConfirm,
    response: okResponseSchema,
    detail: {
      summary: "Confirm an email change",
      description:
        "Switches the login email to the pending address from an email-change magic link, marks it verified, consumes the token, and revokes all sessions so the user signs back in with the new address.",
    },
  })
  .use(authGuard)
  .post(
    "/password/change",
    ({ user, body }) => securityService.changePassword(user.id, body, user.tokenId),
    {
      body: ChangePasswordSchema,
      beforeHandle: limitPasswordChange,
      response: okResponseSchema,
      detail: {
        summary: "Change or set the password",
        description:
          "Sets a new password after verifying the current one (accounts without a password - OAuth signups - skip that check). Revokes every other session; the current one stays signed in.",
      },
    },
  )
  .post("/email/change", ({ user, body }) => securityService.requestEmailChange(user.id, body), {
    body: ChangeEmailSchema,
    beforeHandle: limitEmailChange,
    response: okResponseSchema,
    detail: {
      summary: "Request an email change",
      description:
        "Verifies the current password (when set), then emails a confirmation link to the new address. The login email only switches when that link is clicked; until then the old address keeps working.",
    },
  })
  .delete(
    "/account",
    async ({ user, body, cookie }) => {
      const result = await securityService.deleteAccount(user.id, body);
      clearSessionCookie(cookie);
      return result;
    },
    {
      body: DeleteAccountSchema,
      beforeHandle: limitAccountDelete,
      response: okResponseSchema,
      detail: {
        summary: "Delete the account",
        description:
          "Verifies the current password (when set), then permanently deletes the user and everything it owns - profile, resumes and their files, applications, feeds, mailbox, credentials, Pilot history, sessions and the terminal token. No soft delete. Clears the session cookie. The super admin can't be deleted.",
      },
    },
  );
