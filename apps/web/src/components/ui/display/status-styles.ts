import type { ApplicationSource, ApplicationStatus } from "@jobpilot/contracts/application";
import type {
  CampaignJobStatus,
  CampaignSource,
  CampaignStatus,
} from "@jobpilot/contracts/campaign";
import type { CoverLetterSource } from "@jobpilot/contracts/cover-letter";
import type { Classification } from "@jobpilot/contracts/email";
import type { JobListingStatus } from "@jobpilot/contracts/job-listing";
import type {
  CONTACT_LINKEDIN_CONNECTIONS,
  NetworkingMessageStatus,
} from "@jobpilot/contracts/networking";
import type { PilotCycleStatus, PromotionStatus } from "@jobpilot/contracts/pilot";
import type { Role } from "@jobpilot/contracts/role";
import type {
  UpworkInboxKind,
  UpworkInboxStatus,
  UpworkProfileStatus,
  UpworkProposalOutcome,
  UpworkProposalStatus,
} from "@jobpilot/contracts/upwork";
import type { ChipProps } from "@mui/material";

interface StatusStyle {
  label: string;
  color: ChipProps["color"];
}

// Typed by each enum, so a new value is a compile error here rather than a grey raw slug.
type Styles<T extends string> = Record<T, StatusStyle>;

const application: Styles<ApplicationStatus> = {
  applied: { label: "Applied", color: "default" },
  screening: { label: "Screening", color: "info" },
  interviewing: { label: "Interviewing", color: "primary" },
  offer: { label: "Offer", color: "success" },
  rejected: { label: "Rejected", color: "error" },
  withdrawn: { label: "Withdrawn", color: "default" },
};

/** Campaign, application and cover-letter sources share one vocabulary. */
const source: Styles<CampaignSource | ApplicationSource | CoverLetterSource> = {
  search: { label: "Search", color: "default" },
  auto_apply: { label: "Auto-apply", color: "success" },
  apply: { label: "Single apply", color: "info" },
  manual: { label: "Manual", color: "default" },
  networking: { label: "Networking", color: "default" },
};

const campaign: Styles<CampaignStatus> = {
  in_progress: { label: "In progress", color: "info" },
  paused: { label: "Paused", color: "default" },
  completed: { label: "Completed", color: "success" },
  failed: { label: "Failed", color: "error" },
};

const campaignJob: Styles<CampaignJobStatus> = {
  queued: { label: "Queued", color: "default" },
  pending: { label: "Pending", color: "default" },
  approved: { label: "Approved", color: "info" },
  applying: { label: "Applying", color: "primary" },
  needs_user: { label: "Needs you", color: "warning" },
  applied: { label: "Applied", color: "success" },
  failed: { label: "Failed", color: "error" },
  skipped: { label: "Skipped", color: "warning" },
};

const networking: Styles<NetworkingMessageStatus> = {
  draft: { label: "Draft", color: "default" },
  approved: { label: "Approved", color: "info" },
  sent: { label: "Sent", color: "primary" },
  replied: { label: "Replied", color: "success" },
  bounced: { label: "Bounced", color: "warning" },
  failed: { label: "Failed", color: "error" },
  skipped: { label: "Skipped", color: "default" },
};

const connection: Styles<(typeof CONTACT_LINKEDIN_CONNECTIONS)[number]> = {
  none: { label: "Not connected", color: "default" },
  pending: { label: "Pending", color: "info" },
  connected: { label: "Connected", color: "success" },
};

const promotion: Styles<PromotionStatus> = {
  draft: { label: "Draft", color: "warning" },
  approved: { label: "Approved", color: "info" },
  declined: { label: "Declined", color: "default" },
  posted: { label: "Posted", color: "success" },
  failed: { label: "Failed", color: "error" },
  skipped: { label: "Skipped", color: "default" },
  expired: { label: "Expired", color: "default" },
};

const cycle: Styles<PilotCycleStatus> = {
  ok: { label: "OK", color: "success" },
  empty: { label: "Nothing to do", color: "default" },
  error: { label: "Error", color: "error" },
};

const classification: Styles<Classification> = {
  interviewing: { label: "Interviewing", color: "primary" },
  offer: { label: "Offer", color: "success" },
  rejected: { label: "Rejected", color: "error" },
  verification: { label: "Verification", color: "warning" },
  irrelevant: { label: "Irrelevant", color: "default" },
};

const upworkProposal: Styles<UpworkProposalStatus> = {
  draft: { label: "Draft", color: "default" },
  submitted: { label: "Submitted", color: "info" },
  closed: { label: "Closed", color: "success" },
};

const upworkOutcome: Styles<UpworkProposalOutcome> = {
  hired: { label: "Hired", color: "success" },
  declined: { label: "Declined", color: "default" },
  no_response: { label: "No response", color: "default" },
};

const upworkInboxKind: Styles<UpworkInboxKind> = {
  invitation: { label: "Invitation", color: "primary" },
  offer: { label: "Offer", color: "success" },
  message: { label: "Message", color: "default" },
};

const upworkInboxStatus: Styles<UpworkInboxStatus> = {
  unread: { label: "Unread", color: "primary" },
  archived: { label: "Archived", color: "default" },
};

const upworkProfile: Styles<UpworkProfileStatus> = {
  empty: { label: "Not generated", color: "default" },
  draft: { label: "Draft - review", color: "info" },
  approved: { label: "Approved - ready to apply", color: "warning" },
  applied: { label: "Applied to Upwork", color: "success" },
};

const listing: Styles<JobListingStatus> = {
  published: { label: "Published", color: "primary" },
  hidden: { label: "Hidden", color: "default" },
};

const role: Styles<Role> = {
  super_admin: { label: "Super admin", color: "warning" },
  admin: { label: "Admin", color: "primary" },
  user: { label: "User", color: "default" },
};

const STATUS_STYLES = {
  application,
  source,
  campaign,
  campaignJob,
  networking,
  connection,
  promotion,
  cycle,
  classification,
  upworkProposal,
  upworkOutcome,
  upworkInboxKind,
  upworkInboxStatus,
  upworkProfile,
  listing,
  role,
} as const;

export type StatusDomain = keyof typeof STATUS_STYLES;
export type StatusValue<D extends StatusDomain> = keyof (typeof STATUS_STYLES)[D] & string;

// Falls back to the raw value: an API ahead of this build must not crash the page.
function styleOf<D extends StatusDomain>(domain: D, value: StatusValue<D>): StatusStyle {
  const styles = STATUS_STYLES[domain] as Record<string, StatusStyle | undefined>;
  return styles[value] ?? { label: value, color: "default" };
}

export function statusLabel<D extends StatusDomain>(domain: D, value: StatusValue<D>): string {
  return styleOf(domain, value).label;
}

export function statusColor<D extends StatusDomain>(
  domain: D,
  value: StatusValue<D>,
): ChipProps["color"] {
  return styleOf(domain, value).color;
}

/** Select options for a domain, in the order the values are declared. */
export function statusOptions<D extends StatusDomain>(
  domain: D,
): { value: StatusValue<D>; label: string }[] {
  return Object.entries(STATUS_STYLES[domain] as Record<string, StatusStyle>).map(
    ([value, style]) => ({ value: value as StatusValue<D>, label: style.label }),
  );
}
