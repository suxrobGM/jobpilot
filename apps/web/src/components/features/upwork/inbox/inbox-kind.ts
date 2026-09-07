import type { UpworkInboxKind, UpworkInboxStatus } from "@jobpilot/contracts/upwork";
import { UPWORK_INBOX_KINDS, UPWORK_INBOX_STATUSES } from "@jobpilot/contracts/upwork";

export const KIND_LABEL: Record<UpworkInboxKind, string> = {
  invitation: "Invitation",
  offer: "Offer",
  message: "Message",
};

export const KIND_COLOR: Record<UpworkInboxKind, "primary" | "success" | "default"> = {
  invitation: "primary",
  offer: "success",
  message: "default",
};

const STATUS_LABEL: Record<UpworkInboxStatus, string> = {
  unread: "Unread",
  read: "Read",
  archived: "Archived",
  actioned: "Actioned",
};

export const KIND_OPTIONS = UPWORK_INBOX_KINDS.map((kind) => ({
  value: kind,
  label: KIND_LABEL[kind],
}));

export const INBOX_STATUS_OPTIONS = UPWORK_INBOX_STATUSES.map((status) => ({
  value: status,
  label: STATUS_LABEL[status],
}));
