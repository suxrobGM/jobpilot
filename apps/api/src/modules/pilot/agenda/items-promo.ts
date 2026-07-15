import type { AgendaItem } from "@jobpilot/contracts/pilot";
import { PRIORITY } from "./constants";
import type { AgendaPromoPost, AgendaPromoVenue } from "./types";

/** Approved posts ready to publish. */
export function buildPromoPostItems(posts: AgendaPromoPost[]): AgendaItem[] {
  return posts.map((p) => ({
    id: `promo.post:${p.id}`,
    kind: "promo.post",
    priority: PRIORITY.promoPost,
    title: `Post to ${p.venue}`.slice(0, 200),
    subjectType: "promotion",
    subjectId: p.id,
    payload: { promotionId: p.id, venue: p.venue, target: p.target, title: p.title, body: p.body },
  }));
}

/** Compose a fresh post; one per agenda so drafts don't pile up unreviewed. */
export function buildPromoComposeItems(venues: AgendaPromoVenue[]): AgendaItem[] {
  return venues.slice(0, 1).map((v) => ({
    id: `promo.compose:${v.venue}`,
    kind: "promo.compose",
    priority: PRIORITY.promoCompose,
    title: `Compose post: ${v.venue}`.slice(0, 200),
    subjectType: "promotion",
    subjectId: `venue:${v.venue}`,
    payload: { venue: v.venue, target: v.target },
  }));
}
