import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

export type PortfolioDto = Data<ReturnType<typeof api.public.portfolios>["get"]>;
export type PortfolioDayPoint = PortfolioDto["perDay"][number];
export type PortfolioStats = PortfolioDto["stats"];

export type LeaderboardDto = Data<typeof api.public.portfolios.leaderboard.get>;
export type LeaderboardRow = LeaderboardDto["rows"][number];
export type LeaderboardWindow = NonNullable<LeaderboardDto["window"]>;

export type PortfolioSettingsDto = Data<typeof api.user.portfolio.get>;
