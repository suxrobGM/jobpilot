import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

/** One public portfolio, from `GET /api/public/portfolios/:username`. */
export type PortfolioDto = Data<ReturnType<typeof api.public.portfolios>["get"]>;
export type PortfolioDayPoint = PortfolioDto["perDay"][number];
export type PortfolioStats = PortfolioDto["stats"];

/** The trending leaderboard, from `GET /api/public/portfolios/leaderboard`. */
export type LeaderboardDto = Data<typeof api.public.portfolios.leaderboard.get>;
export type LeaderboardRow = LeaderboardDto["rows"][number];
export type LeaderboardWindow = NonNullable<LeaderboardDto["window"]>;

/** The user's own portfolio settings, from `GET /api/user/portfolio`. */
export type PortfolioSettingsDto = Data<typeof api.user.portfolio.get>;
