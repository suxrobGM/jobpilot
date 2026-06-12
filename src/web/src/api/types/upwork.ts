import type {
  PortfolioProject,
  ScreeningAnswer,
  UpworkProfileStatus,
  UpworkProposalOutcome,
  UpworkProposalSource,
  UpworkProposalStatus,
} from "@/api/contracts/upwork";

export interface UpworkProposalDto {
  id: number;
  jobTitle: string;
  clientName: string | null;
  jobUrl: string | null;
  jobDescription: string | null;
  proposalText: string;
  screeningAnswers: ScreeningAnswer[];
  status: UpworkProposalStatus;
  outcome: UpworkProposalOutcome | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

export interface CreateUpworkProposalRequest {
  jobTitle: string;
  clientName?: string | null;
  jobUrl?: string | null;
  jobDescription?: string | null;
  proposalText?: string;
  screeningAnswers?: ScreeningAnswer[];
  status?: UpworkProposalStatus;
  notes?: string | null;
  source?: UpworkProposalSource;
  campaignId?: string | null;
  jobKey?: string | null;
}

export interface UpworkProfileDto {
  id: number;
  currentTitle: string | null;
  currentOverview: string | null;
  currentHourlyRate: string | null;
  currentPortfolio: PortfolioProject[];
  suggestedTitle: string | null;
  suggestedOverview: string | null;
  suggestedHourlyRate: string | null;
  suggestedPortfolio: PortfolioProject[];
  status: UpworkProfileStatus;
  updatedAt: string;
  appliedAt: string | null;
}

export interface UpdateUpworkProposalRequest {
  jobTitle?: string;
  clientName?: string | null;
  jobUrl?: string | null;
  jobDescription?: string | null;
  proposalText?: string;
  screeningAnswers?: ScreeningAnswer[];
  status?: UpworkProposalStatus;
  outcome?: UpworkProposalOutcome | null;
  notes?: string | null;
  submittedAt?: string | null;
}
