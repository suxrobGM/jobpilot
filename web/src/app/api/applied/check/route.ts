import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import {
  APPLIED_DUPLICATE_THRESHOLD,
  APPLIED_DUPLICATE_WINDOW_DAYS,
  findFuzzyDuplicate,
} from "@/lib/matching";
import type { DuplicateCheckResult } from "@/types/api";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get("url")?.trim();
  const title = url.searchParams.get("title")?.trim();
  const company = url.searchParams.get("company")?.trim();

  if (targetUrl) {
    const exact = await db.application.findUnique({ where: { url: targetUrl } });
    if (exact) {
      const result: DuplicateCheckResult = {
        applied: true,
        match: {
          kind: "url",
          application: {
            id: exact.id,
            url: exact.url,
            title: exact.title,
            company: exact.company,
            appliedAt: exact.appliedAt.toISOString(),
            stage: exact.stage as DuplicateCheckResult["match"] extends infer M
              ? M extends { application: { stage: infer S } }
                ? S
                : never
              : never,
          },
        },
      };
      return ok(result);
    }
  }

  if (title && company) {
    const cutoff = new Date(
      Date.now() - APPLIED_DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const candidates = await db.application.findMany({
      where: { appliedAt: { gte: cutoff } },
      select: {
        id: true,
        url: true,
        title: true,
        company: true,
        appliedAt: true,
        stage: true,
      },
      take: 1000,
    });

    const fuzzy = findFuzzyDuplicate(
      { title, company },
      candidates.map((c) => ({
        id: c.id,
        url: c.url,
        title: c.title,
        company: c.company,
        appliedAt: c.appliedAt,
      })),
      APPLIED_DUPLICATE_THRESHOLD,
    );

    if (fuzzy) {
      const matched = candidates.find((c) => c.id === fuzzy.candidate.id)!;
      const result: DuplicateCheckResult = {
        applied: true,
        match: {
          kind: "fuzzy",
          score: fuzzy.score,
          application: {
            id: matched.id,
            url: matched.url,
            title: matched.title,
            company: matched.company,
            appliedAt: matched.appliedAt.toISOString(),
            stage: matched.stage as DuplicateCheckResult["match"] extends infer M
              ? M extends { application: { stage: infer S } }
                ? S
                : never
              : never,
          },
        },
      };
      return ok(result);
    }
  }

  const empty: DuplicateCheckResult = { applied: false, match: null };
  return ok(empty);
}
