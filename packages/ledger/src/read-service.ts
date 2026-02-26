import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import {
  ListAccountingOperationsQuerySchema,
  type ListAccountingOperationsQuery,
} from "@bedrock/accounting";
import { type Database } from "@bedrock/db";
import { schema, type LedgerOperationStatus } from "@bedrock/db/schema";
import type { Dimensions } from "@bedrock/db/schema";
import {
  type PaginatedList,
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/kernel/pagination";

const OPERATION_SORT_COLUMN_MAP = {
  createdAt: schema.ledgerOperations.createdAt,
  postingDate: schema.ledgerOperations.postingDate,
  postedAt: schema.ledgerOperations.postedAt,
} as const;

function inArraySafe<T>(column: any, values: T[] | undefined) {
  if (!values || values.length === 0) return undefined;
  return inArray(column, values as any[]);
}

interface LedgerOperationListRow {
  id: string;
  sourceType: string;
  sourceId: string;
  operationCode: string;
  operationVersion: number;
  postingDate: Date;
  status: LedgerOperationStatus;
  error: string | null;
  postedAt: Date | null;
  outboxAttempts: number;
  lastOutboxErrorAt: Date | null;
  createdAt: Date;
  postingCount: number;
  bookOrgIds: string[];
  currencies: string[];
}

interface LedgerOperationPostingRow {
  id: string;
  lineNo: number;
  bookOrgId: string;
  bookOrgName: string | null;
  debitInstanceId: string;
  debitAccountNo: string | null;
  debitDimensions: Dimensions | null;
  creditInstanceId: string;
  creditAccountNo: string | null;
  creditDimensions: Dimensions | null;
  postingCode: string;
  currency: string;
  amountMinor: bigint;
  memo: string | null;
  context: Record<string, string> | null;
  createdAt: Date;
}

interface LedgerOperationTbPlanRow {
  id: string;
  lineNo: number;
  type: "create" | "post_pending" | "void_pending";
  transferId: bigint;
  debitTbAccountId: bigint | null;
  creditTbAccountId: bigint | null;
  tbLedger: number;
  amount: bigint;
  code: number;
  pendingRef: string | null;
  pendingId: bigint | null;
  isLinked: boolean;
  isPending: boolean;
  timeoutSeconds: number;
  status: "pending" | "posted" | "failed";
  error: string | null;
  createdAt: Date;
}

interface LedgerOperationDetails {
  operation: LedgerOperationListRow;
  postings: LedgerOperationPostingRow[];
  tbPlans: LedgerOperationTbPlanRow[];
}

export type LedgerReadService = ReturnType<typeof createLedgerReadService>;

export function createLedgerReadService(deps: { db: Database }) {
  const { db } = deps;

  async function listOperations(
    input?: ListAccountingOperationsQuery,
  ): Promise<PaginatedList<LedgerOperationListRow>> {
    const query = ListAccountingOperationsQuerySchema.parse(input ?? {});
    const {
      limit,
      offset,
      sortBy,
      sortOrder,
      status,
      operationCode,
      sourceType,
      sourceId,
      bookOrgId,
    } = query;

    const conditions: SQL[] = [];

    const statusCondition = inArraySafe(schema.ledgerOperations.status, status);
    if (statusCondition) conditions.push(statusCondition);

    const operationCodeCondition = inArraySafe(
      schema.ledgerOperations.operationCode,
      operationCode,
    );
    if (operationCodeCondition) conditions.push(operationCodeCondition);

    const sourceTypeCondition = inArraySafe(
      schema.ledgerOperations.sourceType,
      sourceType,
    );
    if (sourceTypeCondition) conditions.push(sourceTypeCondition);

    if (sourceId) {
      conditions.push(eq(schema.ledgerOperations.sourceId, sourceId));
    }

    if (bookOrgId) {
      conditions.push(sql`exists (
        select 1
        from ${schema.postings} p
        where p.operation_id = ${schema.ledgerOperations.id}
          and p.book_org_id = ${bookOrgId}
      )`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      sortBy,
      OPERATION_SORT_COLUMN_MAP,
      schema.ledgerOperations.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: schema.ledgerOperations.id,
          sourceType: schema.ledgerOperations.sourceType,
          sourceId: schema.ledgerOperations.sourceId,
          operationCode: schema.ledgerOperations.operationCode,
          operationVersion: schema.ledgerOperations.operationVersion,
          postingDate: schema.ledgerOperations.postingDate,
          status: schema.ledgerOperations.status,
          error: schema.ledgerOperations.error,
          postedAt: schema.ledgerOperations.postedAt,
          outboxAttempts: schema.ledgerOperations.outboxAttempts,
          lastOutboxErrorAt: schema.ledgerOperations.lastOutboxErrorAt,
          createdAt: schema.ledgerOperations.createdAt,
          postingCount: sql<number>`count(${schema.postings.id})::int`,
          bookOrgIds: sql<string[]>`coalesce(array_agg(distinct ${schema.postings.bookOrgId}) filter (where ${schema.postings.bookOrgId} is not null), '{}')`,
          currencies: sql<string[]>`coalesce(array_agg(distinct ${schema.postings.currency}) filter (where ${schema.postings.currency} is not null), '{}')`,
        })
        .from(schema.ledgerOperations)
        .leftJoin(
          schema.postings,
          eq(schema.postings.operationId, schema.ledgerOperations.id),
        )
        .where(where)
        .groupBy(
          schema.ledgerOperations.id,
          schema.ledgerOperations.sourceType,
          schema.ledgerOperations.sourceId,
          schema.ledgerOperations.operationCode,
          schema.ledgerOperations.operationVersion,
          schema.ledgerOperations.postingDate,
          schema.ledgerOperations.status,
          schema.ledgerOperations.error,
          schema.ledgerOperations.postedAt,
          schema.ledgerOperations.outboxAttempts,
          schema.ledgerOperations.lastOutboxErrorAt,
          schema.ledgerOperations.createdAt,
        )
        .orderBy(orderByFn(orderByCol))
        .limit(limit)
        .offset(offset),
      db
        .select({
          total: sql<number>`count(*)::int`,
        })
        .from(schema.ledgerOperations)
        .where(where),
    ]);

    return {
      data: rows.map((row) => ({
        ...row,
        bookOrgIds: row.bookOrgIds ?? [],
        currencies: row.currencies ?? [],
      })),
      total: countRows[0]?.total ?? 0,
      limit,
      offset,
    };
  }

  async function getOperationDetails(
    operationId: string,
  ): Promise<LedgerOperationDetails | null> {
    const [operation] = await db
      .select({
        id: schema.ledgerOperations.id,
        sourceType: schema.ledgerOperations.sourceType,
        sourceId: schema.ledgerOperations.sourceId,
        operationCode: schema.ledgerOperations.operationCode,
        operationVersion: schema.ledgerOperations.operationVersion,
        postingDate: schema.ledgerOperations.postingDate,
        status: schema.ledgerOperations.status,
        error: schema.ledgerOperations.error,
        postedAt: schema.ledgerOperations.postedAt,
        outboxAttempts: schema.ledgerOperations.outboxAttempts,
        lastOutboxErrorAt: schema.ledgerOperations.lastOutboxErrorAt,
        createdAt: schema.ledgerOperations.createdAt,
        postingCount: sql<number>`count(${schema.postings.id})::int`,
        bookOrgIds: sql<string[]>`coalesce(array_agg(distinct ${schema.postings.bookOrgId}) filter (where ${schema.postings.bookOrgId} is not null), '{}')`,
        currencies: sql<string[]>`coalesce(array_agg(distinct ${schema.postings.currency}) filter (where ${schema.postings.currency} is not null), '{}')`,
      })
      .from(schema.ledgerOperations)
      .leftJoin(
        schema.postings,
        eq(schema.postings.operationId, schema.ledgerOperations.id),
      )
      .where(eq(schema.ledgerOperations.id, operationId))
      .groupBy(
        schema.ledgerOperations.id,
        schema.ledgerOperations.sourceType,
        schema.ledgerOperations.sourceId,
        schema.ledgerOperations.operationCode,
        schema.ledgerOperations.operationVersion,
        schema.ledgerOperations.postingDate,
        schema.ledgerOperations.status,
        schema.ledgerOperations.error,
        schema.ledgerOperations.postedAt,
        schema.ledgerOperations.outboxAttempts,
        schema.ledgerOperations.lastOutboxErrorAt,
        schema.ledgerOperations.createdAt,
      )
      .limit(1);

    if (!operation) {
      return null;
    }

    const postingRows = await db
      .select()
      .from(schema.postings)
      .where(eq(schema.postings.operationId, operationId))
      .orderBy(schema.postings.lineNo);

    const tbPlans = await db
      .select()
      .from(schema.tbTransferPlans)
      .where(eq(schema.tbTransferPlans.operationId, operationId))
      .orderBy(schema.tbTransferPlans.lineNo);

    const instanceIds = Array.from(
      new Set(
        postingRows.flatMap((p) => [p.debitInstanceId, p.creditInstanceId]),
      ),
    );

    const instances =
      instanceIds.length === 0
        ? []
        : await db
            .select({
              id: schema.bookAccountInstances.id,
              accountNo: schema.bookAccountInstances.accountNo,
              dimensions: schema.bookAccountInstances.dimensions,
            })
            .from(schema.bookAccountInstances)
            .where(inArray(schema.bookAccountInstances.id, instanceIds));

    const instanceById = new Map(
      instances.map((inst) => [inst.id, inst]),
    );

    const bookOrgIds = Array.from(new Set(postingRows.map((p) => p.bookOrgId)));
    const orgNames =
      bookOrgIds.length === 0
        ? []
        : await db
            .select({
              id: schema.counterparties.id,
              shortName: schema.counterparties.shortName,
            })
            .from(schema.counterparties)
            .where(inArray(schema.counterparties.id, bookOrgIds));

    const orgNameById = new Map(orgNames.map((org) => [org.id, org.shortName]));

    return {
      operation: {
        ...operation,
        bookOrgIds: operation.bookOrgIds ?? [],
        currencies: operation.currencies ?? [],
      },
      postings: postingRows.map((p) => {
        const debitInst = instanceById.get(p.debitInstanceId);
        const creditInst = instanceById.get(p.creditInstanceId);
        return {
          id: p.id,
          lineNo: p.lineNo,
          bookOrgId: p.bookOrgId,
          bookOrgName: orgNameById.get(p.bookOrgId) ?? null,
          debitInstanceId: p.debitInstanceId,
          debitAccountNo: debitInst?.accountNo ?? null,
          debitDimensions: (debitInst?.dimensions as Dimensions) ?? null,
          creditInstanceId: p.creditInstanceId,
          creditAccountNo: creditInst?.accountNo ?? null,
          creditDimensions: (creditInst?.dimensions as Dimensions) ?? null,
          postingCode: p.postingCode,
          currency: p.currency,
          amountMinor: p.amountMinor,
          memo: p.memo,
          context: p.context as Record<string, string> | null,
          createdAt: p.createdAt,
        };
      }),
      tbPlans: tbPlans.map((plan) => ({
        id: plan.id,
        lineNo: plan.lineNo,
        type: plan.type,
        transferId: plan.transferId,
        debitTbAccountId: plan.debitTbAccountId,
        creditTbAccountId: plan.creditTbAccountId,
        tbLedger: plan.tbLedger,
        amount: plan.amount,
        code: plan.code,
        pendingRef: plan.pendingRef,
        pendingId: plan.pendingId,
        isLinked: plan.isLinked,
        isPending: plan.isPending,
        timeoutSeconds: plan.timeoutSeconds,
        status: plan.status,
        error: plan.error,
        createdAt: plan.createdAt,
      })),
    };
  }

  return {
    listOperations,
    getOperationDetails,
  };
}
