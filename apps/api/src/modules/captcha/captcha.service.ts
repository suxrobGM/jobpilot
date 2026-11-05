import { Solver } from "@2captcha/captcha-solver";
import type {
  CaptchaSolveInput,
  CaptchaSolveResult,
  CaptchaType,
} from "@jobpilot/contracts/captcha";
import type { CaptchaProvider } from "@jobpilot/contracts/credential";
import { inject, injectable } from "@needle-di/core";
import { badGateway, notFound } from "@/common/errors";
import { acquireSlot, RATE_LIMITS } from "@/common/rate-limit";
import { sleep } from "@/common/utils";
import { CredentialService } from "@/modules/credential/credential.service";

/** A single CAPTCHA to solve, normalized across providers. */
interface ProviderJob {
  type: CaptchaType;
  sitekey: string;
  pageurl: string;
}

const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 24; // ~120s budget

const CAPSOLVER_TASK: Record<CaptchaType, string> = {
  recaptcha: "ReCaptchaV2TaskProxyLess",
  hcaptcha: "HCaptchaTaskProxyLess",
  turnstile: "AntiTurnstileTaskProxyLess",
};

interface CapSolverResponse {
  errorId: number;
  errorDescription?: string;
  status?: string;
  taskId?: string;
  solution?: { gRecaptchaResponse?: string; token?: string };
}

@injectable()
export class CaptchaService {
  constructor(private readonly credentials = inject(CredentialService)) {}

  private solveWith(provider: CaptchaProvider, apiKey: string, job: ProviderJob): Promise<string> {
    return provider === "two_captcha"
      ? this.solveWithTwoCaptcha(apiKey, job)
      : this.solveWithCapSolver(apiKey, job);
  }

  /**
   * Resolve a CAPTCHA via the user's configured solving service (2captcha / CapSolver)
   * and return the token to inject. Throws 404 when no key is configured, 502 on solver failure.
   */
  async solve(userId: string, input: CaptchaSolveInput): Promise<CaptchaSolveResult> {
    // try/finally rather than a lifecycle hook: no hook is guaranteed to run when the client aborts
    // mid-poll, and a leaked counter would lock this user out permanently.
    const release = acquireSlot(`captcha-solve:${userId}`, RATE_LIMITS.captchaSolve.maxInFlight);
    try {
      const cred = await this.credentials.resolveServiceKey(userId, input.provider ?? null);
      if (!cred) {
        throw notFound(
          "No captcha-solving service key configured. Add a 2captcha or CapSolver key in Settings.",
        );
      }

      const job: ProviderJob = { type: input.type, sitekey: input.sitekey, pageurl: input.pageurl };
      const token = await this.solveWith(cred.provider, cred.apiKey, job);

      return { token, provider: cred.provider };
    } finally {
      release();
    }
  }

  /**
   * Solve via the official `@2captcha/captcha-solver` SDK, which handles task
   * submission, polling, and timeout internally and throws `APIError` on failure.
   */
  private async solveWithTwoCaptcha(apiKey: string, job: ProviderJob): Promise<string> {
    const solver = new Solver(apiKey);
    const { pageurl, sitekey } = job;

    switch (job.type) {
      case "recaptcha":
        return (await solver.recaptcha({ pageurl, googlekey: sitekey })).data;
      case "hcaptcha":
        return (await solver.hcaptcha({ pageurl, sitekey })).data;
      case "turnstile":
        return (await solver.cloudflareTurnstile({ pageurl, sitekey })).data;
    }
  }

  /**
   * CapSolver has no official Node SDK (REST-only, per docs.capsolver.com) - this
   * is a minimal typed client: create a task, then poll until it's ready.
   */
  private async solveWithCapSolver(apiKey: string, job: ProviderJob): Promise<string> {
    const created = await this.capSolverPost(apiKey, "createTask", {
      task: { type: CAPSOLVER_TASK[job.type], websiteURL: job.pageurl, websiteKey: job.sitekey },
    });
    if (created.errorId !== 0 || !created.taskId) {
      throw badGateway(`CapSolver createTask failed: ${created.errorDescription ?? "unknown"}`);
    }

    const { taskId } = created;
    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);

      const res = await this.capSolverPost(apiKey, "getTaskResult", { taskId });
      if (res.errorId !== 0) {
        throw badGateway(`CapSolver error: ${res.errorDescription ?? "unknown"}`);
      }

      if (res.status === "ready") {
        const token = res.solution?.gRecaptchaResponse ?? res.solution?.token;
        if (!token) {
          throw badGateway("CapSolver returned no token");
        }
        return token;
      }
    }
    throw badGateway("CapSolver timed out");
  }

  private async capSolverPost(
    apiKey: string,
    path: string,
    extra: Record<string, unknown>,
  ): Promise<CapSolverResponse> {
    const res = await fetch(`https://api.capsolver.com/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientKey: apiKey, ...extra }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw badGateway(`CapSolver responded HTTP ${res.status}`);
    }
    return (await res.json()) as CapSolverResponse;
  }
}
