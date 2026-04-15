import type {
  DealIntakeDraft,
  DealRouteValidationIssue,
} from "../contracts/dto";
import type {
  DealAttachmentIngestionStatus,
  DealApprovalStatus,
  DealApprovalType,
  DealLegKind,
  DealLegOperationKind,
  DealLegState,
  DealOperationalPositionKind,
  DealOperationalPositionState,
  DealRouteComponentBasisType,
  DealRouteComponentClassification,
  DealRouteComponentFormulaType,
  DealRouteLegKind,
  DealRoutePartyKind,
  DealRouteTemplateParticipantBinding,
  DealRouteTemplateStatus,
  DealParticipantRole,
  DealStatus,
  DealTimelineEventType,
  DealTimelineVisibility,
  DealType,
} from "../contracts/zod";

export interface CreateDealRootInput {
  agreementId: string;
  agentId: string | null;
  calculationId: string | null;
  customerId: string;
  id: string;
  nextAction: string | null;
  sourceAmountMinor: bigint | null;
  sourceCurrencyId: string | null;
  status?: DealStatus;
  targetCurrencyId: string | null;
  type: DealType;
}

export interface CreateDealIntakeSnapshotStoredInput {
  dealId: string;
  revision: number;
  snapshot: DealIntakeDraft;
}

export interface CreateDealLegStoredInput {
  dealId: string;
  id: string;
  idx: number;
  kind: DealLegKind;
  state: DealLegState;
}

export interface CreateDealParticipantStoredInput {
  counterpartyId: string | null;
  customerId: string | null;
  dealId: string;
  id: string;
  organizationId: string | null;
  role: DealParticipantRole;
}

export interface CreateDealRouteStoredInput {
  dealId: string;
  id: string;
}

export interface CreateDealRouteVersionStoredInput {
  dealId: string;
  id: string;
  routeId: string;
  validationIssues: DealRouteValidationIssue[];
  version: number;
}

export interface CreateDealRouteParticipantStoredInput {
  code: string;
  counterpartyId: string | null;
  customerId: string | null;
  displayNameSnapshot: string | null;
  id: string;
  metadata: Record<string, unknown>;
  organizationId: string | null;
  partyKind: DealRoutePartyKind;
  requisiteId: string | null;
  role: string;
  routeVersionId: string;
  sequence: number;
}

export interface CreateDealRouteLegStoredInput {
  code: string;
  executionCounterpartyId: string | null;
  expectedFromAmountMinor: bigint | null;
  expectedRateDen: bigint | null;
  expectedRateNum: bigint | null;
  expectedToAmountMinor: bigint | null;
  fromCurrencyId: string;
  fromParticipantId: string;
  id: string;
  idx: number;
  kind: DealRouteLegKind;
  notes: string | null;
  routeVersionId: string;
  settlementModel: string;
  toCurrencyId: string;
  toParticipantId: string;
}

export interface CreateDealRouteCostComponentStoredInput {
  basisType: DealRouteComponentBasisType;
  bps: string | null;
  classification: DealRouteComponentClassification;
  code: string;
  currencyId: string;
  family: string;
  fixedAmountMinor: bigint | null;
  formulaType: DealRouteComponentFormulaType;
  id: string;
  includedInClientRate: boolean;
  legId: string | null;
  manualAmountMinor: bigint | null;
  notes: string | null;
  perMillion: string | null;
  roundingMode: string;
  routeVersionId: string;
  sequence: number;
}

export interface CreateDealRouteTemplateStoredInput {
  code: string;
  dealType: DealType;
  description: string | null;
  id: string;
  name: string;
  status: DealRouteTemplateStatus;
}

export interface CreateDealRouteTemplateParticipantStoredInput {
  bindingKind: DealRouteTemplateParticipantBinding;
  code: string;
  counterpartyId: string | null;
  customerId: string | null;
  displayNameTemplate: string | null;
  id: string;
  metadata: Record<string, unknown>;
  organizationId: string | null;
  partyKind: DealRoutePartyKind;
  requisiteId: string | null;
  role: string;
  routeTemplateId: string;
  sequence: number;
}

export interface CreateDealRouteTemplateLegStoredInput {
  code: string;
  executionCounterpartyId: string | null;
  expectedFromAmountMinor: bigint | null;
  expectedRateDen: bigint | null;
  expectedRateNum: bigint | null;
  expectedToAmountMinor: bigint | null;
  fromCurrencyId: string;
  fromParticipantId: string;
  id: string;
  idx: number;
  kind: DealRouteLegKind;
  notes: string | null;
  routeTemplateId: string;
  settlementModel: string;
  toCurrencyId: string;
  toParticipantId: string;
}

export interface CreateDealRouteTemplateCostComponentStoredInput {
  basisType: DealRouteComponentBasisType;
  bps: string | null;
  classification: DealRouteComponentClassification;
  code: string;
  currencyId: string;
  family: string;
  fixedAmountMinor: bigint | null;
  formulaType: DealRouteComponentFormulaType;
  id: string;
  includedInClientRate: boolean;
  legId: string | null;
  manualAmountMinor: bigint | null;
  notes: string | null;
  perMillion: string | null;
  roundingMode: string;
  routeTemplateId: string;
  sequence: number;
}

export interface CreateDealLegOperationLinkStoredInput {
  dealLegId: string;
  id: string;
  operationKind: DealLegOperationKind;
  sourceRef: string;
  treasuryOperationId: string;
}

export interface CreateDealTimelineEventStoredInput {
  actorLabel: string | null;
  actorUserId: string | null;
  dealId: string;
  id: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
  sourceRef: string | null;
  type: DealTimelineEventType;
  visibility: DealTimelineVisibility;
}

export interface CreateDealAttachmentIngestionStoredInput {
  appliedFields: string[];
  appliedRevision: number | null;
  attempts: number;
  availableAt: Date;
  dealId: string;
  errorCode: string | null;
  errorMessage: string | null;
  fileAssetId: string;
  id: string;
  lastProcessedAt: Date | null;
  normalizedPayload: Record<string, unknown> | null;
  observedRevision: number;
  skippedFields: string[];
  status: DealAttachmentIngestionStatus;
}

export interface CreateDealQuoteAcceptanceStoredInput {
  acceptedAt: Date;
  acceptedByUserId: string;
  agreementVersionId: string | null;
  dealId: string;
  dealRevision: number;
  id: string;
  quoteId: string;
}

export interface CreateDealApprovalStoredInput {
  approvalType: DealApprovalType;
  comment: string | null;
  dealId: string;
  decidedAt: Date | null;
  decidedBy: string | null;
  id: string;
  requestedAt: Date;
  requestedBy: string | null;
  status: DealApprovalStatus;
}

export interface ReplaceDealOperationalPositionStoredInput {
  amountMinor: bigint | null;
  currencyId: string | null;
  dealId: string;
  id: string;
  kind: DealOperationalPositionKind;
  reasonCode: string | null;
  sourceRefs: string[];
  state: DealOperationalPositionState;
}

export interface DealStore {
  claimAttachmentIngestions(input: {
    batchSize: number;
    leaseSeconds: number;
    now: Date;
  }): Promise<
    {
      attempts: number;
      availableAt: Date;
      dealId: string;
      fileAssetId: string;
      observedRevision: number;
      status: DealAttachmentIngestionStatus;
    }[]
  >;
  createDealApprovals(input: CreateDealApprovalStoredInput[]): Promise<void>;
  createDealAttachmentIngestion(
    input: CreateDealAttachmentIngestionStoredInput,
  ): Promise<void>;
  createDealRoute(input: CreateDealRouteStoredInput): Promise<void>;
  createDealRouteCostComponents(
    input: CreateDealRouteCostComponentStoredInput[],
  ): Promise<void>;
  createDealRouteLegs(input: CreateDealRouteLegStoredInput[]): Promise<void>;
  createDealRouteParticipants(
    input: CreateDealRouteParticipantStoredInput[],
  ): Promise<void>;
  createDealRouteVersion(input: CreateDealRouteVersionStoredInput): Promise<void>;
  createDealRouteTemplate(
    input: CreateDealRouteTemplateStoredInput,
  ): Promise<void>;
  replaceDealRouteTemplateCostComponents(input: {
    routeTemplateId: string;
    costComponents: CreateDealRouteTemplateCostComponentStoredInput[];
  }): Promise<void>;
  replaceDealRouteTemplateLegs(input: {
    legs: CreateDealRouteTemplateLegStoredInput[];
    routeTemplateId: string;
  }): Promise<void>;
  replaceDealRouteTemplateParticipants(input: {
    participants: CreateDealRouteTemplateParticipantStoredInput[];
    routeTemplateId: string;
  }): Promise<void>;
  createDealCalculationLinks(
    input: {
      calculationId: string;
      dealId: string;
      id: string;
      sourceQuoteId?: string | null;
    }[],
  ): Promise<void>;
  createDealIntakeSnapshot(
    input: CreateDealIntakeSnapshotStoredInput,
  ): Promise<void>;
  createDealLegOperationLinks(
    input: CreateDealLegOperationLinkStoredInput[],
  ): Promise<void>;
  createDealQuoteAcceptance(
    input: CreateDealQuoteAcceptanceStoredInput,
  ): Promise<void>;
  createDealRoot(input: CreateDealRootInput): Promise<void>;
  createDealTimelineEvents(
    input: CreateDealTimelineEventStoredInput[],
  ): Promise<void>;
  setDealAttachmentIngestion(input: {
    appliedFields?: string[];
    appliedRevision?: number | null;
    availableAt?: Date;
    errorCode?: string | null;
    errorMessage?: string | null;
    fileAssetId: string;
    lastProcessedAt?: Date | null;
    normalizedPayload?: Record<string, unknown> | null;
    skippedFields?: string[];
    status?: DealAttachmentIngestionStatus;
  }): Promise<void>;
  replaceDealOperationalPositions(input: {
    dealId: string;
    positions: ReplaceDealOperationalPositionStoredInput[];
  }): Promise<void>;
  replaceDealLegs(input: {
    dealId: string;
    legs: CreateDealLegStoredInput[];
  }): Promise<void>;
  replaceDealParticipants(input: {
    dealId: string;
    participants: CreateDealParticipantStoredInput[];
  }): Promise<void>;
  replaceIntakeSnapshot(input: {
    dealId: string;
    expectedRevision: number;
    nextRevision: number;
    snapshot: DealIntakeDraft;
  }): Promise<boolean>;
  setDealRoot(input: {
    agreementId?: string;
    agentId?: string | null;
    calculationId?: string | null;
    comment?: string | null;
    dealId: string;
    nextAction?: string | null;
    sourceAmountMinor?: bigint | null;
    sourceCurrencyId?: string | null;
    status?: DealStatus;
    targetCurrencyId?: string | null;
  }): Promise<void>;
  setDealRouteCurrentVersion(input: {
    currentVersionId: string;
    dealId: string;
  }): Promise<void>;
  setDealRouteTemplate(input: {
    code?: string;
    dealType?: DealType;
    description?: string | null;
    name?: string;
    status?: DealRouteTemplateStatus;
    templateId: string;
  }): Promise<void>;
  supersedeCurrentQuoteAcceptances(input: {
    dealId: string;
    replacedByQuoteId: string;
    revokedAt: Date;
  }): Promise<void>;
  upsertDealAttachmentIngestion(input: {
    availableAt: Date;
    dealId: string;
    fileAssetId: string;
    id: string;
    observedRevision: number;
  }): Promise<void>;
  updateDealLegState(input: {
    dealId: string;
    idx: number;
    state: DealLegState;
  }): Promise<boolean>;
}
