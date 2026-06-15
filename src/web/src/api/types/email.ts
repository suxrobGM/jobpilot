export interface EmailAccountStatus {
  connected: boolean;
  /** Whether the granted scope permits sending (false until reconnected). */
  canSend: boolean;
  provider?: string;
  email?: string;
  lastSyncAt?: string | null;
}

export interface EmailMessageDto {
  id: number;
  providerId: string;
  threadId: string | null;
  subject: string;
  fromAddress: string;
  fromName: string | null;
  fromDomain: string;
  snippet: string;
  rawBody: string;
  receivedAt: string;
  fetchedAt: string;
  scannedAt: string | null;
  classification: string | null;
  confidence: number | null;
  reasoning: string | null;
  matchedAppId: number | null;
  matchScore: number | null;
  reviewStatus: "pending" | "approved" | "denied" | "auto";
  appliedStage: string | null;
  verificationCode: string | null;
  verificationLink: string | null;
  verificationDomain: string | null;
}

export interface SyncResultDto {
  fetched: number;
  new: number;
}
