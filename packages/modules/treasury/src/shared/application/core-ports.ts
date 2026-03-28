import type { UnitOfWork } from "./unit-of-work";
import type {
  AllocationType,
  BalanceState,
  BeneficialOwnerType,
  ExecutionEventKind,
  InstructionStatus,
  LegalBasis,
  LegKind,
  ObligationKind,
  OperationKind,
  PositionKind,
  SettlementModel,
  SubmissionChannel,
  TreasuryAccountKind,
} from "../domain/taxonomy";

export interface TreasuryAccountRecord {
  id: string;
  kind: TreasuryAccountKind;
  ownerEntityId: string;
  operatorEntityId: string;
  assetId: string;
  provider: string | null;
  networkOrRail: string | null;
  accountReference: string;
  reconciliationMode: string | null;
  finalityModel: string | null;
  segregationModel: string | null;
  canReceive: boolean;
  canSend: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface TreasuryEndpointRecord {
  id: string;
  accountId: string;
  endpointType: string;
  value: string;
  label: string | null;
  memoTag: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface CounterpartyEndpointRecord {
  id: string;
  counterpartyId: string;
  assetId: string;
  endpointType: string;
  value: string;
  label: string | null;
  memoTag: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface ObligationRecord {
  id: string;
  obligationKind: ObligationKind;
  debtorEntityId: string;
  creditorEntityId: string;
  beneficialOwnerType: BeneficialOwnerType | null;
  beneficialOwnerId: string | null;
  assetId: string;
  amountMinor: bigint;
  settledMinor: bigint;
  dueAt: Date | null;
  memo: string | null;
  payload: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TreasuryOperationRecord {
  id: string;
  idempotencyKey: string;
  operationKind: OperationKind;
  economicOwnerEntityId: string;
  executingEntityId: string;
  cashHolderEntityId: string | null;
  beneficialOwnerType: BeneficialOwnerType | null;
  beneficialOwnerId: string | null;
  legalBasis: LegalBasis | null;
  settlementModel: SettlementModel;
  instructionStatus: InstructionStatus;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  sourceAssetId: string | null;
  destinationAssetId: string | null;
  sourceAmountMinor: bigint | null;
  destinationAmountMinor: bigint | null;
  memo: string | null;
  payload: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  reservedAt: Date | null;
}

export interface TreasuryOperationObligationRecord {
  operationId: string;
  obligationId: string;
  createdAt: Date;
}

export interface ExecutionInstructionRecord {
  id: string;
  operationId: string;
  sourceAccountId: string;
  destinationEndpointId: string | null;
  submissionChannel: SubmissionChannel;
  instructionStatus: InstructionStatus;
  assetId: string;
  amountMinor: bigint;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionEventRecord {
  id: string;
  instructionId: string;
  eventKind: ExecutionEventKind;
  eventAt: Date;
  externalRecordId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AllocationRecord {
  id: string;
  obligationId: string;
  executionEventId: string;
  allocatedMinor: bigint;
  allocationType: AllocationType;
  createdAt: Date;
}

export interface TreasuryPositionRecord {
  id: string;
  originOperationId: string | null;
  positionKind: PositionKind;
  ownerEntityId: string;
  counterpartyEntityId: string | null;
  beneficialOwnerType: BeneficialOwnerType | null;
  beneficialOwnerId: string | null;
  assetId: string;
  amountMinor: bigint;
  settledMinor: bigint;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

export interface TreasuryAccountBalanceEntryRecord {
  id: string;
  accountId: string;
  assetId: string;
  executionEventId: string | null;
  instructionId: string | null;
  operationId: string | null;
  balanceState: BalanceState;
  legKind: LegKind;
  amountMinor: bigint;
  createdAt: Date;
}

export interface TreasuryDocumentLinkRecord {
  id: string;
  documentId: string;
  linkKind: "obligation" | "operation" | "instruction";
  targetId: string;
  createdAt: Date;
}

export interface UnmatchedExternalRecordRow {
  externalRecordId: string;
  source: string;
  sourceRecordId: string;
  recordKind: string | null;
  receivedAt: Date;
  reasonCode: string;
  reasonMeta: Record<string, unknown> | null;
}

export interface TreasuryAccountBalanceRow {
  accountId: string;
  assetId: string;
  pendingMinor: bigint;
  reservedMinor: bigint;
  bookedMinor: bigint;
}

export interface TreasuryCoreReads {
  findTreasuryAccount(id: string): Promise<TreasuryAccountRecord | null>;
  findTreasuryEndpoint(id: string): Promise<TreasuryEndpointRecord | null>;
  findCounterpartyEndpoint(
    id: string,
  ): Promise<CounterpartyEndpointRecord | null>;
  findObligation(id: string): Promise<ObligationRecord | null>;
  findOperation(id: string): Promise<TreasuryOperationRecord | null>;
  findOperationByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<TreasuryOperationRecord | null>;
  findInstruction(id: string): Promise<ExecutionInstructionRecord | null>;
  findExecutionEvent(id: string): Promise<ExecutionEventRecord | null>;
  findPosition(id: string): Promise<TreasuryPositionRecord | null>;
  listTreasuryAccounts(input?: {
    ownerEntityId?: string | null;
    operatorEntityId?: string | null;
    assetId?: string | null;
    kind?: TreasuryAccountKind;
    canReceive?: boolean;
    canSend?: boolean;
    search?: string | null;
  }): Promise<TreasuryAccountRecord[]>;
  listTreasuryEndpoints(input?: {
    accountId?: string;
    endpointType?: string;
    search?: string | null;
  }): Promise<TreasuryEndpointRecord[]>;
  listCounterpartyEndpoints(input?: {
    counterpartyId?: string;
    assetId?: string;
    endpointType?: string;
    search?: string | null;
  }): Promise<CounterpartyEndpointRecord[]>;
  listTreasuryOperations(input?: {
    operationKind?: OperationKind;
    instructionStatus?: InstructionStatus;
    entityId?: string;
    assetId?: string;
    limit?: number;
  }): Promise<TreasuryOperationRecord[]>;
  listExecutionInstructions(input?: {
    operationId?: string;
    sourceAccountId?: string;
    assetId?: string;
    instructionStatus?: InstructionStatus;
    limit?: number;
  }): Promise<ExecutionInstructionRecord[]>;
  listDocumentLinks(documentId: string): Promise<TreasuryDocumentLinkRecord[]>;
  listDocumentLinksByTargetIds(
    targetIds: string[],
    input?: {
      linkKinds?: TreasuryDocumentLinkRecord["linkKind"][];
    },
  ): Promise<TreasuryDocumentLinkRecord[]>;
  listObligationsByIds(ids: string[]): Promise<ObligationRecord[]>;
  listOperationObligationLinks(
    operationId: string,
  ): Promise<TreasuryOperationObligationRecord[]>;
  listOperationInstructions(
    operationId: string,
  ): Promise<ExecutionInstructionRecord[]>;
  listInstructionEvents(
    instructionId: string,
  ): Promise<ExecutionEventRecord[]>;
  listOperationEvents(operationId: string): Promise<ExecutionEventRecord[]>;
  listExecutionAllocations(
    executionEventId: string,
  ): Promise<AllocationRecord[]>;
  listObligationAllocations(obligationId: string): Promise<AllocationRecord[]>;
  listTreasuryPositions(input?: {
    originOperationId?: string;
    ownerEntityId?: string;
    beneficialOwnerType?: BeneficialOwnerType;
    beneficialOwnerId?: string;
  }): Promise<TreasuryPositionRecord[]>;
  listTreasuryAccountBalances(
    accountIds?: string[],
  ): Promise<TreasuryAccountBalanceRow[]>;
  listUnmatchedExternalRecords(input?: {
    sources?: string[];
    limit?: number;
  }): Promise<UnmatchedExternalRecordRow[]>;
}

export interface TreasuryCoreWrites {
  insertTreasuryAccount(
    input: Omit<TreasuryAccountRecord, "createdAt" | "updatedAt">,
  ): Promise<TreasuryAccountRecord>;
  insertTreasuryEndpoint(
    input: Omit<TreasuryEndpointRecord, "createdAt" | "updatedAt">,
  ): Promise<TreasuryEndpointRecord>;
  insertCounterpartyEndpoint(
    input: Omit<CounterpartyEndpointRecord, "createdAt" | "updatedAt">,
  ): Promise<CounterpartyEndpointRecord>;
  insertObligation(
    input: Omit<ObligationRecord, "createdAt" | "updatedAt" | "settledMinor">,
  ): Promise<ObligationRecord>;
  updateObligation(
    input: Pick<ObligationRecord, "id" | "settledMinor" | "updatedAt">,
  ): Promise<void>;
  insertOperation(
    input: Omit<
      TreasuryOperationRecord,
      "createdAt" | "updatedAt" | "approvedAt" | "reservedAt"
    >,
  ): Promise<TreasuryOperationRecord>;
  updateOperationStatus(input: {
    id: string;
    instructionStatus: InstructionStatus;
    updatedAt: Date;
    approvedAt?: Date | null;
    reservedAt?: Date | null;
  }): Promise<void>;
  insertOperationObligationLinks(
    links: Omit<TreasuryOperationObligationRecord, "createdAt">[],
  ): Promise<void>;
  insertExecutionInstruction(
    input: Omit<ExecutionInstructionRecord, "createdAt" | "updatedAt">,
  ): Promise<ExecutionInstructionRecord>;
  updateExecutionInstructionStatus(input: {
    id: string;
    instructionStatus: InstructionStatus;
    updatedAt: Date;
  }): Promise<void>;
  insertExecutionEvent(
    input: Omit<ExecutionEventRecord, "createdAt">,
  ): Promise<ExecutionEventRecord>;
  insertDocumentLinks(
    input: Omit<TreasuryDocumentLinkRecord, "id" | "createdAt">[],
  ): Promise<void>;
  resolveOpenExceptionsForExternalRecord(input: {
    externalRecordId: string;
    resolvedAt: Date;
  }): Promise<void>;
  insertAllocation(
    input: Omit<AllocationRecord, "createdAt">,
  ): Promise<AllocationRecord>;
  insertPosition(
    input: Omit<
      TreasuryPositionRecord,
      "createdAt" | "updatedAt" | "closedAt" | "settledMinor"
    >,
  ): Promise<TreasuryPositionRecord>;
  updatePosition(input: {
    id: string;
    amountMinor?: bigint;
    settledMinor?: bigint;
    updatedAt: Date;
    closedAt?: Date | null;
  }): Promise<void>;
  findOpenPositionByKey(input: {
    positionKind: PositionKind;
    ownerEntityId: string;
    counterpartyEntityId: string | null;
    beneficialOwnerType: BeneficialOwnerType | null;
    beneficialOwnerId: string | null;
    assetId: string;
  }): Promise<TreasuryPositionRecord | null>;
  findOpenPositionByOrigin(input: {
    originOperationId: string;
    positionKind: PositionKind;
    ownerEntityId: string;
  }): Promise<TreasuryPositionRecord | null>;
  insertAccountBalanceEntries(
    entries: Omit<TreasuryAccountBalanceEntryRecord, "createdAt">[],
  ): Promise<void>;
}

export interface TreasuryCoreTx extends TreasuryCoreReads, TreasuryCoreWrites {}

export interface TreasuryCoreUnitOfWork extends UnitOfWork<TreasuryCoreTx> {}
