import type {
  DealApprovalStatus,
  DealApprovalType,
  DealLegKind,
  DealParticipantRole,
  DealStatus,
  DealType,
} from "../contracts/zod";

export interface CreateDealRootInput {
  id: string;
  customerId: string;
  agreementId: string;
  calculationId: string;
  type: DealType;
  status?: DealStatus;
  comment: string | null;
}

export interface CreateDealLegStoredInput {
  id: string;
  dealId: string;
  idx: number;
  kind: DealLegKind;
  status: DealStatus;
}

export interface CreateDealParticipantStoredInput {
  id: string;
  dealId: string;
  role: DealParticipantRole;
  customerId: string | null;
  organizationId: string | null;
  counterpartyId: string | null;
}

export interface CreateDealStatusHistoryStoredInput {
  id: string;
  dealId: string;
  status: DealStatus;
  changedBy: string | null;
  comment: string | null;
}

export interface CreateDealApprovalStoredInput {
  id: string;
  dealId: string;
  approvalType: DealApprovalType;
  status: DealApprovalStatus;
  requestedBy: string | null;
  decidedBy: string | null;
  comment: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
}

export interface DealStore {
  createDealRoot(input: CreateDealRootInput): Promise<void>;
  createDealLegs(input: CreateDealLegStoredInput[]): Promise<void>;
  createDealParticipants(input: CreateDealParticipantStoredInput[]): Promise<void>;
  createDealStatusHistory(
    input: CreateDealStatusHistoryStoredInput[],
  ): Promise<void>;
  createDealApprovals(input: CreateDealApprovalStoredInput[]): Promise<void>;
}
