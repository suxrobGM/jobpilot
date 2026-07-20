import type { AgendaItem } from "@jobpilot/contracts/pilot";
import { MAX_PROMO_COMPOSE, PRIORITY } from "./constants";
import type { AgendaPromoPlatform, AgendaPromoPost } from "./types";

/** Approved posts ready to publish. */
export function buildPromoPostItems(posts: AgendaPromoPost[]): AgendaItem[] {
  return posts.map((p) => ({
    id: `promo.post:${p.id}`,
    kind: "promo.post",
    priority: PRIORITY.promoPost,
    title: `Post to ${p.platform}`.slice(0, 200),
    subjectType: "promotion",
    subjectId: p.id,
    payload: {
      promotionId: p.id,
      platform: p.platform,
      target: p.target,
      title: p.title,
      body: p.body,
    },
  }));
}

/** Compose a fresh post; one per agenda so drafts don't pile up unreviewed. */
export function buildPromoComposeItems(platforms: AgendaPromoPlatform[]): AgendaItem[] {
  return platforms.slice(0, MAX_PROMO_COMPOSE).map((p) => ({
    id: `promo.compose:${p.platform}`,
    kind: "promo.compose",
    priority: PRIORITY.promoCompose,
    title: `Compose post: ${p.platform}`.slice(0, 200),
    subjectType: "promotion",
    subjectId: `platform:${p.platform}`,
    payload: { platform: p.platform, target: p.target },
  }));
}
