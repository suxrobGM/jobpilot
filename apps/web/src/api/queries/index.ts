import { resumeQueries, userQueries } from "./account";
import { applicationQueries, campaignQueries, emailQueries } from "./work";

export {
  authQueries,
  credentialQueries,
  jobBoardQueries,
  leaderboardQueries,
  resumeQueries,
  userQueries,
} from "./account";
export { pilotQueries } from "./pilot";
export { OPTIONS_PAGE } from "./shared";
export {
  upworkAccountQueries,
  upworkInboxQueries,
  upworkProfileQueries,
  upworkProposalQueries,
} from "./upwork";
export {
  analyticsQueries,
  applicationQueries,
  campaignQueries,
  coverLetterQueries,
  emailQueries,
  networkingQueries,
} from "./work";

/** Named invalidation sets for useApiMutation's `invalidate:` option. */
export const invalidations = {
  resume: [resumeQueries.all, userQueries.all],
  campaign: [campaignQueries.all],
  application: [applicationQueries.all],
  // Approving a message can write an application status, so both trees go stale.
  emailReview: [emailQueries.all, applicationQueries.all],
} as const;
