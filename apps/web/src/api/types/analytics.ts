import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

/** The dashboard analytics summary, inferred from `GET /api/analytics`. */
export type AnalyticsStatsDto = Data<typeof api.analytics.get>;

export type AnalyticsStatusBreakdownEntry = AnalyticsStatsDto["statusBreakdown"][number];
export type AnalyticsPerDayEntry = AnalyticsStatsDto["perDay"][number];

export type AnalyticsNetworkingStats = AnalyticsStatsDto["networking"];
