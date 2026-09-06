import {
  ChangeEmailSchema,
  ChangePasswordSchema,
  ConfirmEmailChangeSchema,
} from "@jobpilot/contracts";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { okResponseSchema } from "@/types/response";
import { REFRESH_COOKIE } from "./auth.cookies";
import { SecurityService } from "./security.service";
import { VerificationService } from "./verification.service";

const securityService = container.resolve(SecurityService);
const verificationService = container.resolve(VerificationService);

const limitEmailChangeConfirm = rateLimit(RATE_LIMITS.emailChangeConfirm);
const limitPasswordChange = rateLimit(RATE_LIMITS.passwordChange);
const limitEmailChange = rateLimit(RATE_LIMITS.emailChange);

/** Signed-in account security: password change/set and the two-step email change. */
export const securityController = new Elysia({ prefix: "/auth", detail: { tags: ["Auth"] } })
  // --- public ---
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
  // --- authenticated ---
  .use(authGuard)
  .post(
    "/password/change",
    ({ user, body, cookie }) => {
      const raw = cookie[REFRESH_COOKIE]?.value;
      return securityService.changePassword(user.id, body, typeof raw === "string" ? raw : null);
    },
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
  });
