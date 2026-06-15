export interface AnalyticsTotals {
  applications: number;
  submitted: number;
  interviewing: number;
  offers: number;
  rejected: number;
  queueDepth: number;
}

export interface AnalyticsWeekly {
  submitted: number;
  interviewing: number;
  rejected: number;
}

export interface AnalyticsStageBreakdownEntry {
  stage: string;
  count: number;
}

export interface AnalyticsPerDayEntry {
  date: string;
  count: number;
}

export interface AnalyticsTopBoardEntry {
  board: string;
  count: number;
}

export interface AnalyticsTopReasonEntry {
  reason: string;
  count: number;
}

export interface AnalyticsOutreachTotals {
  contacts: number;
  sent: number; // dispatched: sent + replied + bounced
  replied: number;
  bounced: number;
}

export interface AnalyticsOutreachWeekly {
  sent: number;
  replied: number;
}

export interface AnalyticsContactSourceEntry {
  source: string;
  count: number;
}

export interface AnalyticsOutreachStats {
  totals: AnalyticsOutreachTotals;
  thisWeek: AnalyticsOutreachWeekly;
  replyRatePct: number;
  perDaySent: AnalyticsPerDayEntry[];
  topContactSources: AnalyticsContactSourceEntry[];
}

export interface AnalyticsStatsDto {
  totals: AnalyticsTotals;
  thisWeek: AnalyticsWeekly;
  responseRatePct: number;
  stageBreakdown: AnalyticsStageBreakdownEntry[];
  perDay: AnalyticsPerDayEntry[];
  topBoards: AnalyticsTopBoardEntry[];
  topRejectReasons: AnalyticsTopReasonEntry[];
  outreach: AnalyticsOutreachStats;
}
