import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

/** The dashboard analytics summary, inferred from `GET /api/analytics`. */
export type AnalyticsStatsDto = Data<typeof api.analytics.get>;

export type AnalyticsTotals = AnalyticsStatsDto["totals"];
export type AnalyticsWeekly = AnalyticsStatsDto["thisWeek"];
export type AnalyticsStageBreakdownEntry = AnalyticsStatsDto["stageBreakdown"][number];
export type AnalyticsPerDayEntry = AnalyticsStatsDto["perDay"][number];
export type AnalyticsTopBoardEntry = AnalyticsStatsDto["topBoards"][number];
export type AnalyticsTopReasonEntry = AnalyticsStatsDto["topRejectReasons"][number];

export type AnalyticsOutreachStats = AnalyticsStatsDto["outreach"];
export type AnalyticsOutreachTotals = AnalyticsOutreachStats["totals"];
export type AnalyticsOutreachWeekly = AnalyticsOutreachStats["thisWeek"];
export type AnalyticsContactSourceEntry = AnalyticsOutreachStats["topContactSources"][number];
