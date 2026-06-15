import { Solver } from "@2captcha/captcha-solver";
import type { CaptchaSolveInput, CaptchaSolveResult, CaptchaType } from "@jobpilot/contracts/captcha";
import { SERVICE_PROVIDERS, type ServiceProvider } from "@jobpilot/contracts/credential";
import { singleton } from "tsyringe";
import { ErrorCodes, HttpError, notFound } from "@/common/errors";
import { sleep } from "@/common/utils";
import { PrismaClient } from "@/generated/prisma/client";

/** A single CAPTCHA to solve, normalized across providers. */
interface ProviderJob {
  type: CaptchaType;
  sitekey: string;
  pageurl: string;
}

const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 24; // ~120s budget

/** 502 — the upstream solver failed or timed out. */
function serviceError(message: string): HttpError {
  return new HttpError(ErrorCodes.INTERNAL, message, 502);
}

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

@singleton()
export class CaptchaService {
  constructor(private readonly prisma: PrismaClient) {}

  private solveWith(provider: ServiceProvider, apiKey: string, job: ProviderJob): Promise<string> {
    return provider === "2captcha"
      ? this.solveWithTwoCaptcha(apiKey, job)
      : this.solveWithCapSolver(apiKey, job);
  }

  /**
   * Resolve a CAPTCHA via the profile's configured solving service (2captcha / CapSolver)
   * and return the token to inject. Throws 404 when no key is configured, 502 on solver failure.
   */
  async solve(profileId: number, input: CaptchaSolveInput): Promise<CaptchaSolveResult> {
    const cred = await this.resolveServiceCredential(profileId, input.provider);
    if (!cred) {
      throw notFound(
        "No captcha-solving service key configured. Add a 2captcha or CapSolver key in Settings.",
      );
    }

    const job: ProviderJob = { type: input.type, sitekey: input.sitekey, pageurl: input.pageurl };
    const token = await this.solveWith(cred.provider, cred.apiKey, job);

    return { token, provider: cred.provider };
  }

  private async resolveServiceCredential(
    profileId: number,
    provider?: ServiceProvider,
  ): Promise<{ provider: ServiceProvider; apiKey: string } | null> {
    const rows = await this.prisma.credential.findMany({
      where: { profileId, scope: { in: [...SERVICE_PROVIDERS] }, NOT: { apiKey: null } },
    });
    // Honor an explicit provider; otherwise fall back in SERVICE_PROVIDERS preference order.
    const order: readonly ServiceProvider[] = provider ? [provider] : SERVICE_PROVIDERS;
    for (const p of order) {
      const row = rows.find((r) => r.scope === p && r.apiKey);
      if (row?.apiKey) {
        return { provider: p, apiKey: row.apiKey };
      }
    }
    return null;
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
   * CapSolver has no official Node SDK (REST-only, per docs.capsolver.com) — this
   * is a minimal typed client: create a task, then poll until it's ready.
   */
  private async solveWithCapSolver(apiKey: string, job: ProviderJob): Promise<string> {
    const created = await this.capSolverPost(apiKey, "createTask", {
      task: { type: CAPSOLVER_TASK[job.type], websiteURL: job.pageurl, websiteKey: job.sitekey },
    });
    if (created.errorId !== 0 || !created.taskId) {
      throw serviceError(`CapSolver createTask failed: ${created.errorDescription ?? "unknown"}`);
    }

    const { taskId } = created;
    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);

      const res = await this.capSolverPost(apiKey, "getTaskResult", { taskId });
      if (res.errorId !== 0) {
        throw serviceError(`CapSolver error: ${res.errorDescription ?? "unknown"}`);
      }

      if (res.status === "ready") {
        const token = res.solution?.gRecaptchaResponse ?? res.solution?.token;
        if (!token) {
          throw serviceError("CapSolver returned no token");
        }
        return token;
      }
    }
    throw serviceError("CapSolver timed out");
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
      throw serviceError(`CapSolver responded HTTP ${res.status}`);
    }
    return (await res.json()) as CapSolverResponse;
  }
}
