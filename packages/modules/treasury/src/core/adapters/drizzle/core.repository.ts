import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  reconciliationExceptions,
  reconciliationExternalRecords,
} from "@bedrock/reconciliation/schema";

import type {
  AllocationRecord,
  CounterpartyEndpointRecord,
  ExecutionEventRecord,
  ExecutionInstructionRecord,
  ObligationRecord,
  TreasuryAccountBalanceEntryRecord,
  TreasuryAccountBalanceRow,
  TreasuryAccountRecord,
  TreasuryDocumentLinkRecord,
  TreasuryCoreTx,
  TreasuryEndpointRecord,
  TreasuryOperationObligationRecord,
  TreasuryOperationRecord,
  TreasuryPositionRecord,
  UnmatchedExternalRecordRow,
} from "../../../shared/application/core-ports";
import { schema } from "./schema";

function eqNullable<TColumn>(
  column: TColumn,
  value: string | null,
) {
  return value === null ? isNull(column as never) : eq(column as never, value);
}

export class DrizzleTreasuryCoreRepository implements TreasuryCoreTx {
  constructor(private readonly db: Queryable) {}

  async findTreasuryAccount(id: string): Promise<TreasuryAccountRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.treasuryAccounts)
      .where(eq(schema.treasuryAccounts.id, id))
      .limit(1);

    return (row as TreasuryAccountRecord | undefined) ?? null;
  }

  async findTreasuryEndpoint(
    id: string,
  ): Promise<TreasuryEndpointRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.treasuryEndpoints)
      .where(eq(schema.treasuryEndpoints.id, id))
      .limit(1);

    return (row as TreasuryEndpointRecord | undefined) ?? null;
  }

  async findCounterpartyEndpoint(
    id: string,
  ): Promise<CounterpartyEndpointRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.counterpartyEndpoints)
      .where(eq(schema.counterpartyEndpoints.id, id))
      .limit(1);

    return (row as CounterpartyEndpointRecord | undefined) ?? null;
  }

  async findObligation(id: string): Promise<ObligationRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.treasuryObligations)
      .where(eq(schema.treasuryObligations.id, id))
      .limit(1);

    return (row as ObligationRecord | undefined) ?? null;
  }

  async findOperation(id: string): Promise<TreasuryOperationRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.treasuryOperations)
      .where(eq(schema.treasuryOperations.id, id))
      .limit(1);

    return (row as TreasuryOperationRecord | undefined) ?? null;
  }

  async findOperationByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<TreasuryOperationRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.treasuryOperations)
      .where(eq(schema.treasuryOperations.idempotencyKey, idempotencyKey))
      .limit(1);

    return (row as TreasuryOperationRecord | undefined) ?? null;
  }

  async findInstruction(id: string): Promise<ExecutionInstructionRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.treasuryExecutionInstructions)
      .where(eq(schema.treasuryExecutionInstructions.id, id))
      .limit(1);

    return (row as ExecutionInstructionRecord | undefined) ?? null;
  }

  async findExecutionEvent(id: string): Promise<ExecutionEventRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.treasuryExecutionEvents)
      .where(eq(schema.treasuryExecutionEvents.id, id))
      .limit(1);

    return (row as ExecutionEventRecord | undefined) ?? null;
  }

  async findPosition(id: string): Promise<TreasuryPositionRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.treasuryPositions)
      .where(eq(schema.treasuryPositions.id, id))
      .limit(1);

    return (row as TreasuryPositionRecord | undefined) ?? null;
  }

  async listTreasuryAccounts(input?: {
    ownerEntityId?: string | null;
    operatorEntityId?: string | null;
    assetId?: string | null;
    kind?: TreasuryAccountRecord["kind"];
    canReceive?: boolean;
    canSend?: boolean;
    search?: string | null;
  }): Promise<TreasuryAccountRecord[]> {
    const conditions = [];

    if (input?.ownerEntityId) {
      conditions.push(eq(schema.treasuryAccounts.ownerEntityId, input.ownerEntityId));
    }

    if (input?.operatorEntityId) {
      conditions.push(
        eq(schema.treasuryAccounts.operatorEntityId, input.operatorEntityId),
      );
    }

    if (input?.assetId) {
      conditions.push(eq(schema.treasuryAccounts.assetId, input.assetId));
    }

    if (input?.kind) {
      conditions.push(eq(schema.treasuryAccounts.kind, input.kind));
    }

    if (input?.canReceive !== undefined) {
      conditions.push(eq(schema.treasuryAccounts.canReceive, input.canReceive));
    }

    if (input?.canSend !== undefined) {
      conditions.push(eq(schema.treasuryAccounts.canSend, input.canSend));
    }

    if (input?.search) {
      const pattern = `%${input.search}%`;
      conditions.push(
        or(
          ilike(schema.treasuryAccounts.accountReference, pattern),
          ilike(schema.treasuryAccounts.provider, pattern),
          ilike(schema.treasuryAccounts.networkOrRail, pattern),
        )!,
      );
    }

    const rows = await this.db
      .select()
      .from(schema.treasuryAccounts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        asc(schema.treasuryAccounts.ownerEntityId),
        asc(schema.treasuryAccounts.accountReference),
      );

    return rows as TreasuryAccountRecord[];
  }

  async listTreasuryEndpoints(input?: {
    accountId?: string;
    endpointType?: string;
    search?: string | null;
  }): Promise<TreasuryEndpointRecord[]> {
    const conditions = [];

    if (input?.accountId) {
      conditions.push(eq(schema.treasuryEndpoints.accountId, input.accountId));
    }

    if (input?.endpointType) {
      conditions.push(eq(schema.treasuryEndpoints.endpointType, input.endpointType));
    }

    if (input?.search) {
      const pattern = `%${input.search}%`;
      conditions.push(
        or(
          ilike(schema.treasuryEndpoints.value, pattern),
          ilike(schema.treasuryEndpoints.label, pattern),
          ilike(schema.treasuryEndpoints.endpointType, pattern),
        )!,
      );
    }

    const rows = await this.db
      .select()
      .from(schema.treasuryEndpoints)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        asc(schema.treasuryEndpoints.accountId),
        asc(schema.treasuryEndpoints.createdAt),
      );

    return rows as TreasuryEndpointRecord[];
  }

  async listCounterpartyEndpoints(input?: {
    counterpartyId?: string;
    assetId?: string;
    endpointType?: string;
    search?: string | null;
  }): Promise<CounterpartyEndpointRecord[]> {
    const conditions = [];

    if (input?.counterpartyId) {
      conditions.push(
        eq(schema.counterpartyEndpoints.counterpartyId, input.counterpartyId),
      );
    }

    if (input?.assetId) {
      conditions.push(eq(schema.counterpartyEndpoints.assetId, input.assetId));
    }

    if (input?.endpointType) {
      conditions.push(
        eq(schema.counterpartyEndpoints.endpointType, input.endpointType),
      );
    }

    if (input?.search) {
      const pattern = `%${input.search}%`;
      conditions.push(
        or(
          ilike(schema.counterpartyEndpoints.value, pattern),
          ilike(schema.counterpartyEndpoints.label, pattern),
          ilike(schema.counterpartyEndpoints.endpointType, pattern),
        )!,
      );
    }

    const rows = await this.db
      .select()
      .from(schema.counterpartyEndpoints)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        asc(schema.counterpartyEndpoints.counterpartyId),
        asc(schema.counterpartyEndpoints.createdAt),
      );

    return rows as CounterpartyEndpointRecord[];
  }

  async listTreasuryOperations(input?: {
    operationKind?: TreasuryOperationRecord["operationKind"];
    instructionStatus?: TreasuryOperationRecord["instructionStatus"];
    entityId?: string;
    assetId?: string;
    limit?: number;
  }): Promise<TreasuryOperationRecord[]> {
    const conditions = [];

    if (input?.operationKind) {
      conditions.push(eq(schema.treasuryOperations.operationKind, input.operationKind));
    }

    if (input?.instructionStatus) {
      conditions.push(
        eq(
          schema.treasuryOperations.instructionStatus,
          input.instructionStatus,
        ),
      );
    }

    if (input?.entityId) {
      conditions.push(
        or(
          eq(schema.treasuryOperations.economicOwnerEntityId, input.entityId),
          eq(schema.treasuryOperations.executingEntityId, input.entityId),
          eq(schema.treasuryOperations.cashHolderEntityId, input.entityId),
        )!,
      );
    }

    if (input?.assetId) {
      conditions.push(
        or(
          eq(schema.treasuryOperations.sourceAssetId, input.assetId),
          eq(schema.treasuryOperations.destinationAssetId, input.assetId),
        )!,
      );
    }

    const rows = await this.db
      .select()
      .from(schema.treasuryOperations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        desc(schema.treasuryOperations.createdAt),
        desc(schema.treasuryOperations.updatedAt),
      )
      .limit(input?.limit ?? 100);

    return rows as TreasuryOperationRecord[];
  }

  async listExecutionInstructions(input?: {
    operationId?: string;
    sourceAccountId?: string;
    assetId?: string;
    instructionStatus?: ExecutionInstructionRecord["instructionStatus"];
    limit?: number;
  }): Promise<ExecutionInstructionRecord[]> {
    const conditions = [];

    if (input?.operationId) {
      conditions.push(
        eq(schema.treasuryExecutionInstructions.operationId, input.operationId),
      );
    }

    if (input?.sourceAccountId) {
      conditions.push(
        eq(
          schema.treasuryExecutionInstructions.sourceAccountId,
          input.sourceAccountId,
        ),
      );
    }

    if (input?.assetId) {
      conditions.push(eq(schema.treasuryExecutionInstructions.assetId, input.assetId));
    }

    if (input?.instructionStatus) {
      conditions.push(
        eq(
          schema.treasuryExecutionInstructions.instructionStatus,
          input.instructionStatus,
        ),
      );
    }

    const rows = await this.db
      .select()
      .from(schema.treasuryExecutionInstructions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        desc(schema.treasuryExecutionInstructions.createdAt),
        desc(schema.treasuryExecutionInstructions.updatedAt),
      )
      .limit(input?.limit ?? 100);

    return rows as ExecutionInstructionRecord[];
  }

  async listDocumentLinks(
    documentId: string,
  ): Promise<TreasuryDocumentLinkRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.treasuryDocumentLinks)
      .where(eq(schema.treasuryDocumentLinks.documentId, documentId))
      .orderBy(asc(schema.treasuryDocumentLinks.createdAt));

    return rows as TreasuryDocumentLinkRecord[];
  }

  async listObligationsByIds(ids: string[]): Promise<ObligationRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(schema.treasuryObligations)
      .where(inArray(schema.treasuryObligations.id, ids))
      .orderBy(asc(schema.treasuryObligations.createdAt));

    return rows as ObligationRecord[];
  }

  async listOperationObligationLinks(
    operationId: string,
  ): Promise<TreasuryOperationObligationRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.treasuryOperationObligations)
      .where(eq(schema.treasuryOperationObligations.operationId, operationId));

    return rows as TreasuryOperationObligationRecord[];
  }

  async listOperationInstructions(
    operationId: string,
  ): Promise<ExecutionInstructionRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.treasuryExecutionInstructions)
      .where(eq(schema.treasuryExecutionInstructions.operationId, operationId))
      .orderBy(asc(schema.treasuryExecutionInstructions.createdAt));

    return rows as ExecutionInstructionRecord[];
  }

  async listInstructionEvents(
    instructionId: string,
  ): Promise<ExecutionEventRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.treasuryExecutionEvents)
      .where(eq(schema.treasuryExecutionEvents.instructionId, instructionId))
      .orderBy(
        asc(schema.treasuryExecutionEvents.eventAt),
        asc(schema.treasuryExecutionEvents.createdAt),
      );

    return rows as ExecutionEventRecord[];
  }

  async listOperationEvents(
    operationId: string,
  ): Promise<ExecutionEventRecord[]> {
    const rows = await this.db
      .select({
        id: schema.treasuryExecutionEvents.id,
        instructionId: schema.treasuryExecutionEvents.instructionId,
        eventKind: schema.treasuryExecutionEvents.eventKind,
        eventAt: schema.treasuryExecutionEvents.eventAt,
        externalRecordId: schema.treasuryExecutionEvents.externalRecordId,
        metadata: schema.treasuryExecutionEvents.metadata,
        createdAt: schema.treasuryExecutionEvents.createdAt,
      })
      .from(schema.treasuryExecutionEvents)
      .innerJoin(
        schema.treasuryExecutionInstructions,
        eq(
          schema.treasuryExecutionEvents.instructionId,
          schema.treasuryExecutionInstructions.id,
        ),
      )
      .where(eq(schema.treasuryExecutionInstructions.operationId, operationId))
      .orderBy(
        asc(schema.treasuryExecutionEvents.eventAt),
        asc(schema.treasuryExecutionEvents.createdAt),
      );

    return rows as ExecutionEventRecord[];
  }

  async listExecutionAllocations(
    executionEventId: string,
  ): Promise<AllocationRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.treasuryAllocations)
      .where(eq(schema.treasuryAllocations.executionEventId, executionEventId))
      .orderBy(asc(schema.treasuryAllocations.createdAt));

    return rows as AllocationRecord[];
  }

  async listObligationAllocations(
    obligationId: string,
  ): Promise<AllocationRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.treasuryAllocations)
      .where(eq(schema.treasuryAllocations.obligationId, obligationId))
      .orderBy(asc(schema.treasuryAllocations.createdAt));

    return rows as AllocationRecord[];
  }

  async listTreasuryPositions(input?: {
    originOperationId?: string;
    ownerEntityId?: string;
    beneficialOwnerType?: TreasuryPositionRecord["beneficialOwnerType"];
    beneficialOwnerId?: string;
  }): Promise<TreasuryPositionRecord[]> {
    const conditions = [];

    if (input?.originOperationId) {
      conditions.push(
        eq(schema.treasuryPositions.originOperationId, input.originOperationId),
      );
    }

    if (input?.ownerEntityId) {
      conditions.push(eq(schema.treasuryPositions.ownerEntityId, input.ownerEntityId));
    }

    if (input?.beneficialOwnerType) {
      conditions.push(
        eq(
          schema.treasuryPositions.beneficialOwnerType,
          input.beneficialOwnerType,
        ),
      );
    }

    if (input?.beneficialOwnerId) {
      conditions.push(
        eq(schema.treasuryPositions.beneficialOwnerId, input.beneficialOwnerId),
      );
    }

    const rows = await this.db
      .select()
      .from(schema.treasuryPositions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(schema.treasuryPositions.createdAt));

    return rows as TreasuryPositionRecord[];
  }

  async listTreasuryAccountBalances(
    accountIds?: string[],
  ): Promise<TreasuryAccountBalanceRow[]> {
    const whereSql =
      accountIds && accountIds.length > 0
        ? sql`WHERE account_id IN (${sql.join(
            accountIds.map((id) => sql`${id}`),
            sql`, `,
          )})`
        : sql``;

    const result = await this.db.execute(sql`
      SELECT
        account_id,
        asset_id,
        coalesce(sum(CASE WHEN balance_state = 'pending' THEN amount_minor ELSE 0 END), 0)::text AS pending_minor,
        coalesce(sum(CASE WHEN balance_state = 'reserved' THEN amount_minor ELSE 0 END), 0)::text AS reserved_minor,
        coalesce(sum(CASE WHEN balance_state = 'booked' THEN amount_minor ELSE 0 END), 0)::text AS booked_minor
      FROM ${schema.treasuryAccountBalanceEntries}
      ${whereSql}
      GROUP BY account_id, asset_id
    `);

    return ((result.rows ?? []) as {
      account_id: string;
      asset_id: string;
      pending_minor: string;
      reserved_minor: string;
      booked_minor: string;
    }[]).map((row) => ({
      accountId: row.account_id,
      assetId: row.asset_id,
      pendingMinor: BigInt(row.pending_minor),
      reservedMinor: BigInt(row.reserved_minor),
      bookedMinor: BigInt(row.booked_minor),
    }));
  }

  async listUnmatchedExternalRecords(input?: {
    sources?: string[];
    limit?: number;
  }): Promise<UnmatchedExternalRecordRow[]> {
    const conditions = [];

    if (input?.sources && input.sources.length > 0) {
      conditions.push(
        inArray(reconciliationExternalRecords.source, input.sources),
      );
    }

    const rows = await this.db
      .select({
        externalRecordId: reconciliationExternalRecords.id,
        source: reconciliationExternalRecords.source,
        sourceRecordId: reconciliationExternalRecords.sourceRecordId,
        recordKind:
          sql<string | null>`${reconciliationExternalRecords.normalizedPayload} ->> 'kind'`,
        receivedAt: reconciliationExternalRecords.receivedAt,
        reasonCode: reconciliationExceptions.reasonCode,
        reasonMeta: reconciliationExceptions.reasonMeta,
      })
      .from(reconciliationExceptions)
      .innerJoin(
        reconciliationExternalRecords,
        eq(
          reconciliationExceptions.externalRecordId,
          reconciliationExternalRecords.id,
        ),
      )
      .where(
        conditions.length > 0
          ? and(eq(reconciliationExceptions.state, "open"), ...conditions)
          : eq(reconciliationExceptions.state, "open"),
      )
      .orderBy(asc(reconciliationExternalRecords.receivedAt))
      .limit(input?.limit ?? 100);

    return rows as UnmatchedExternalRecordRow[];
  }

  async insertTreasuryAccount(
    input: Omit<TreasuryAccountRecord, "createdAt" | "updatedAt">,
  ): Promise<TreasuryAccountRecord> {
    const [row] = await this.db
      .insert(schema.treasuryAccounts)
      .values(input)
      .returning();

    return row as TreasuryAccountRecord;
  }

  async insertTreasuryEndpoint(
    input: Omit<TreasuryEndpointRecord, "createdAt" | "updatedAt">,
  ): Promise<TreasuryEndpointRecord> {
    const [row] = await this.db
      .insert(schema.treasuryEndpoints)
      .values(input)
      .returning();

    return row as TreasuryEndpointRecord;
  }

  async insertCounterpartyEndpoint(
    input: Omit<CounterpartyEndpointRecord, "createdAt" | "updatedAt">,
  ): Promise<CounterpartyEndpointRecord> {
    const [row] = await this.db
      .insert(schema.counterpartyEndpoints)
      .values(input)
      .returning();

    return row as CounterpartyEndpointRecord;
  }

  async insertObligation(
    input: Omit<ObligationRecord, "createdAt" | "updatedAt" | "settledMinor">,
  ): Promise<ObligationRecord> {
    const [row] = await this.db
      .insert(schema.treasuryObligations)
      .values({
        ...input,
        settledMinor: 0n,
      })
      .returning();

    return row as ObligationRecord;
  }

  async updateObligation(
    input: Pick<ObligationRecord, "id" | "settledMinor" | "updatedAt">,
  ): Promise<void> {
    await this.db
      .update(schema.treasuryObligations)
      .set({
        settledMinor: input.settledMinor,
        updatedAt: input.updatedAt,
      })
      .where(eq(schema.treasuryObligations.id, input.id));
  }

  async insertOperation(
    input: Omit<
      TreasuryOperationRecord,
      "createdAt" | "updatedAt" | "approvedAt" | "reservedAt"
    >,
  ): Promise<TreasuryOperationRecord> {
    const [row] = await this.db
      .insert(schema.treasuryOperations)
      .values(input)
      .returning();

    return row as TreasuryOperationRecord;
  }

  async updateOperationStatus(input: {
    id: string;
    instructionStatus: TreasuryOperationRecord["instructionStatus"];
    updatedAt: Date;
    approvedAt?: Date | null;
    reservedAt?: Date | null;
  }): Promise<void> {
    await this.db
      .update(schema.treasuryOperations)
      .set({
        instructionStatus: input.instructionStatus,
        updatedAt: input.updatedAt,
        approvedAt: input.approvedAt,
        reservedAt: input.reservedAt,
      })
      .where(eq(schema.treasuryOperations.id, input.id));
  }

  async insertOperationObligationLinks(
    links: Omit<TreasuryOperationObligationRecord, "createdAt">[],
  ): Promise<void> {
    if (links.length === 0) {
      return;
    }

    await this.db
      .insert(schema.treasuryOperationObligations)
      .values(links)
      .onConflictDoNothing();
  }

  async insertExecutionInstruction(
    input: Omit<ExecutionInstructionRecord, "createdAt" | "updatedAt">,
  ): Promise<ExecutionInstructionRecord> {
    const [row] = await this.db
      .insert(schema.treasuryExecutionInstructions)
      .values(input)
      .returning();

    return row as ExecutionInstructionRecord;
  }

  async updateExecutionInstructionStatus(input: {
    id: string;
    instructionStatus: ExecutionInstructionRecord["instructionStatus"];
    updatedAt: Date;
  }): Promise<void> {
    await this.db
      .update(schema.treasuryExecutionInstructions)
      .set({
        instructionStatus: input.instructionStatus,
        updatedAt: input.updatedAt,
      })
      .where(eq(schema.treasuryExecutionInstructions.id, input.id));
  }

  async insertExecutionEvent(
    input: Omit<ExecutionEventRecord, "createdAt">,
  ): Promise<ExecutionEventRecord> {
    const [row] = await this.db
      .insert(schema.treasuryExecutionEvents)
      .values(input)
      .returning();

    return row as ExecutionEventRecord;
  }

  async insertDocumentLinks(
    input: Omit<TreasuryDocumentLinkRecord, "id" | "createdAt">[],
  ): Promise<void> {
    if (input.length === 0) {
      return;
    }

    await this.db
      .insert(schema.treasuryDocumentLinks)
      .values(input)
      .onConflictDoNothing();
  }

  async resolveOpenExceptionsForExternalRecord(input: {
    externalRecordId: string;
    resolvedAt: Date;
  }): Promise<void> {
    await this.db
      .update(reconciliationExceptions)
      .set({
        state: "resolved",
        resolvedAt: input.resolvedAt,
      })
      .where(
        and(
          eq(reconciliationExceptions.externalRecordId, input.externalRecordId),
          eq(reconciliationExceptions.state, "open"),
        ),
      );
  }

  async insertAllocation(
    input: Omit<AllocationRecord, "createdAt">,
  ): Promise<AllocationRecord> {
    const [row] = await this.db
      .insert(schema.treasuryAllocations)
      .values(input)
      .returning();

    return row as AllocationRecord;
  }

  async insertPosition(
    input: Omit<
      TreasuryPositionRecord,
      "createdAt" | "updatedAt" | "closedAt" | "settledMinor"
    >,
  ): Promise<TreasuryPositionRecord> {
    const [row] = await this.db
      .insert(schema.treasuryPositions)
      .values({
        ...input,
        settledMinor: 0n,
      })
      .returning();

    return row as TreasuryPositionRecord;
  }

  async updatePosition(input: {
    id: string;
    amountMinor?: bigint;
    settledMinor?: bigint;
    updatedAt: Date;
    closedAt?: Date | null;
  }): Promise<void> {
    await this.db
      .update(schema.treasuryPositions)
      .set({
        amountMinor: input.amountMinor,
        settledMinor: input.settledMinor,
        updatedAt: input.updatedAt,
        closedAt: input.closedAt,
      })
      .where(eq(schema.treasuryPositions.id, input.id));
  }

  async findOpenPositionByKey(input: {
    positionKind: TreasuryPositionRecord["positionKind"];
    ownerEntityId: string;
    counterpartyEntityId: string | null;
    beneficialOwnerType: TreasuryPositionRecord["beneficialOwnerType"];
    beneficialOwnerId: string | null;
    assetId: string;
  }): Promise<TreasuryPositionRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.treasuryPositions)
      .where(
        and(
          eq(schema.treasuryPositions.positionKind, input.positionKind),
          eq(schema.treasuryPositions.ownerEntityId, input.ownerEntityId),
          eqNullable(
            schema.treasuryPositions.counterpartyEntityId,
            input.counterpartyEntityId,
          ),
          eqNullable(
            schema.treasuryPositions.beneficialOwnerType,
            input.beneficialOwnerType,
          ),
          eqNullable(
            schema.treasuryPositions.beneficialOwnerId,
            input.beneficialOwnerId,
          ),
          eq(schema.treasuryPositions.assetId, input.assetId),
          isNull(schema.treasuryPositions.closedAt),
        ),
      )
      .limit(1);

    return (row as TreasuryPositionRecord | undefined) ?? null;
  }

  async findOpenPositionByOrigin(input: {
    originOperationId: string;
    positionKind: TreasuryPositionRecord["positionKind"];
    ownerEntityId: string;
  }): Promise<TreasuryPositionRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.treasuryPositions)
      .where(
        and(
          eq(schema.treasuryPositions.originOperationId, input.originOperationId),
          eq(schema.treasuryPositions.positionKind, input.positionKind),
          eq(schema.treasuryPositions.ownerEntityId, input.ownerEntityId),
          isNull(schema.treasuryPositions.closedAt),
        ),
      )
      .limit(1);

    return (row as TreasuryPositionRecord | undefined) ?? null;
  }

  async insertAccountBalanceEntries(
    entries: Omit<TreasuryAccountBalanceEntryRecord, "createdAt">[],
  ): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    await this.db.insert(schema.treasuryAccountBalanceEntries).values(entries);
  }
}
