import {
  APPLICATION_EVENT_KINDS,
  APPLICATION_EVENT_SOURCES,
  APPLICATION_SOURCES,
  APPLICATION_STATUSES,
} from "@jobpilot/contracts/application";
import { AUTH_TOKEN_KINDS, OAUTH_PROVIDERS } from "@jobpilot/contracts/auth";
import {
  ACTORS,
  CAMPAIGN_FEEDS,
  CAMPAIGN_JOB_STATUSES,
  CAMPAIGN_SOURCES,
  CAMPAIGN_STATUSES,
  CAP_EXEMPT_BASES,
} from "@jobpilot/contracts/campaign";
import { COVER_LETTER_SOURCES } from "@jobpilot/contracts/cover-letter";
import { CAPTCHA_PROVIDERS, CREDENTIAL_KINDS } from "@jobpilot/contracts/credential";
import { CLASSIFICATIONS, REVIEW_STATUSES } from "@jobpilot/contracts/email";
import { JOB_LISTING_STATUSES } from "@jobpilot/contracts/job-listing";
import {
  CONTACT_DISCOVERY_SOURCES,
  CONTACT_EMAIL_SOURCES,
  CONTACT_LINKEDIN_CONNECTIONS,
  LINKEDIN_KINDS,
  NETWORKING_CHANNELS,
  NETWORKING_MESSAGE_STATUSES,
} from "@jobpilot/contracts/networking";
import { PILOT_JOURNAL_KINDS } from "@jobpilot/contracts/pilot/journal";
import { PROMOTION_STATUSES } from "@jobpilot/contracts/pilot/promotion";
import { PILOT_QUESTION_KINDS, PILOT_QUESTION_STATUSES } from "@jobpilot/contracts/pilot/question";
import { PILOT_RUN_OUTCOMES } from "@jobpilot/contracts/pilot/run";
import { PILOT_SUBJECT_TYPES } from "@jobpilot/contracts/pilot/tasks";
import { ROLES } from "@jobpilot/contracts/role";
import {
  UPWORK_INBOX_KINDS,
  UPWORK_INBOX_STATUSES,
  UPWORK_PROFILE_STATUSES,
  UPWORK_PROPOSAL_OUTCOMES,
  UPWORK_PROPOSAL_SOURCES,
  UPWORK_PROPOSAL_STATUSES,
} from "@jobpilot/contracts/upwork";
import { AVAILABILITY, SALARY_CURRENCIES, SALARY_PERIODS } from "@jobpilot/contracts/user";
import * as prismaEnums from "@/generated/prisma/enums";
import { describe, expect, it } from "bun:test";

// The web cannot import the generated Prisma client, so `@jobpilot/contracts` keeps its own copy of
// every DB enum's values. This is the only thing stopping the two from drifting.
/** Prisma-only enums: never on the wire, so no contracts copy. */
const API_ONLY = ["VerificationTokenType"] as const;

type PrismaEnumName = Exclude<keyof typeof prismaEnums, (typeof API_ONLY)[number]>;

/** A Record over every Prisma enum, so a new one fails typecheck until it has a contracts copy. */
const CONTRACTS: Record<PrismaEnumName, readonly string[]> = {
  ApplicationEventKind: APPLICATION_EVENT_KINDS,
  ApplicationEventSource: APPLICATION_EVENT_SOURCES,
  ApplicationSource: APPLICATION_SOURCES,
  ApplicationStatus: APPLICATION_STATUSES,
  AuthTokenKind: AUTH_TOKEN_KINDS,
  Availability: AVAILABILITY,
  Actor: ACTORS,
  CampaignFeed: CAMPAIGN_FEEDS,
  CampaignJobStatus: CAMPAIGN_JOB_STATUSES,
  CampaignSource: CAMPAIGN_SOURCES,
  CampaignStatus: CAMPAIGN_STATUSES,
  CapExemptBasis: CAP_EXEMPT_BASES,
  ContactDiscoverySource: CONTACT_DISCOVERY_SOURCES,
  ContactEmailSource: CONTACT_EMAIL_SOURCES,
  ContactLinkedinConnection: CONTACT_LINKEDIN_CONNECTIONS,
  CoverLetterSource: COVER_LETTER_SOURCES,
  CredentialKind: CREDENTIAL_KINDS,
  EmailClassification: CLASSIFICATIONS,
  EmailReviewStatus: REVIEW_STATUSES,
  JobListingStatus: JOB_LISTING_STATUSES,
  LinkedinMessageKind: LINKEDIN_KINDS,
  NetworkingChannel: NETWORKING_CHANNELS,
  NetworkingMessageStatus: NETWORKING_MESSAGE_STATUSES,
  OAuthProvider: OAUTH_PROVIDERS,
  PilotJournalKind: PILOT_JOURNAL_KINDS,
  PilotQuestionKind: PILOT_QUESTION_KINDS,
  PilotQuestionStatus: PILOT_QUESTION_STATUSES,
  PilotRunOutcome: PILOT_RUN_OUTCOMES,
  PilotSubjectType: PILOT_SUBJECT_TYPES,
  PromotionStatus: PROMOTION_STATUSES,
  SalaryCurrency: SALARY_CURRENCIES,
  SalaryPeriod: SALARY_PERIODS,
  CaptchaProvider: CAPTCHA_PROVIDERS,
  UpworkInboxKind: UPWORK_INBOX_KINDS,
  UpworkInboxStatus: UPWORK_INBOX_STATUSES,
  UpworkProfileStatus: UPWORK_PROFILE_STATUSES,
  UpworkProposalOutcome: UPWORK_PROPOSAL_OUTCOMES,
  UpworkProposalSource: UPWORK_PROPOSAL_SOURCES,
  UpworkProposalStatus: UPWORK_PROPOSAL_STATUSES,
  UserRole: ROLES,
};

describe("contracts enums match the Prisma schema", () => {
  for (const [name, prismaEnum] of Object.entries(prismaEnums)) {
    if ((API_ONLY as readonly string[]).includes(name)) continue;
    it(name, () => {
      const contract = CONTRACTS[name as PrismaEnumName];
      expect([...contract].sort()).toEqual(Object.values(prismaEnum).sort());
    });
  }
});
