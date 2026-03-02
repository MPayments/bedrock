import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import { schema as currenciesSchema } from "@bedrock/currencies/schema";
import {
  type PaginatedList,
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/foundation/kernel/pagination";
import {
  schema as ledgerSchema,
  type Dimensions,
  type LedgerOperationStatus,
} from "@bedrock/ledger/schema";

import {
  ListLedgerOperationsQuerySchema,
  type ListLedgerOperationsQuery,
} from "./list-ledger-operations-query";
import type { LedgerContext } from "../internal/context";

const schema = {
  ...ledgerSchema,
  ...currenciesSchema,
};

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
  bookIds: string[];
  currencies: string[];
}

interface LedgerOperationPostingRow {
  id: string;
  lineNo: number;
  bookId: string;
  bookName: string | null;
  debitInstanceId: string;
  debitAccountNo: string | null;
  debitDimensions: Dimensions | null;
  creditInstanceId: string;
  creditAccountNo: string | null;
  creditDimensions: Dimensions | null;
  postingCode: string;
  currency: string;
  currencyPrecision: number;
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

export interface LedgerReadQueries {
  listOperations: (
    input?: ListLedgerOperationsQuery,
  ) => Promise<PaginatedList<LedgerOperationListRow>>;
  getOperationDetails: (
    operationId: string,
  ) => Promise<LedgerOperationDetails | null>;
}

export function createLedgerReadQueries(
  context: LedgerContext,
): LedgerReadQueries {
  const { db } = context;

  async function listOperations(
    input?: ListLedgerOperationsQuery,
  ): Promise<PaginatedList<LedgerOperationListRow>> {
    const query = ListLedgerOperationsQuerySchema.parse(input ?? {});
    const {
      limit,
      offset,
      sortBy,
      sortOrder,
      query: searchQuery,
      status,
      operationCode,
      sourceType,
      sourceId,
      bookId,
      counterpartyId,
    } = query;

    const conditions: SQL[] = [];
    if (searchQuery) {
      const pattern = `%${searchQuery}%`;

      conditions.push(sql<boolean>`(
        ${schema.ledgerOperations.id}::text ilike ${pattern}
        or ${schema.ledgerOperations.sourceType} ilike ${pattern}
        or ${schema.ledgerOperations.sourceId} ilike ${pattern}
        or ${schema.ledgerOperations.operationCode} ilike ${pattern}
        or exists (
          select 1
          from ${schema.postings} p
          where p.operation_id = ${schema.ledgerOperations.id}
            and (
              p.book_id::text ilike ${pattern}
              or p.currency ilike ${pattern}
            )
        )
      )`);
    }
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

    if (bookId) {
      conditions.push(sql`exists (
        select 1
        from ${schema.postings} p
        where p.operation_id = ${schema.ledgerOperations.id}
          and p.book_id = ${bookId}
      )`);
    }

    if (counterpartyId) {
      conditions.push(sql`exists (
        select 1
        from ${schema.postings} p
        inner join ${schema.bookAccountInstances} debit_inst
          on debit_inst.id = p.debit_instance_id
        inner join ${schema.bookAccountInstances} credit_inst
          on credit_inst.id = p.credit_instance_id
        where p.operation_id = ${schema.ledgerOperations.id}
          and (
            debit_inst.dimensions->>'counterpartyId' = ${counterpartyId}
            or credit_inst.dimensions->>'counterpartyId' = ${counterpartyId}
          )
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
          bookIds: sql<
            string[]
          >`coalesce(array_agg(distinct ${schema.postings.bookId}) filter (where ${schema.postings.bookId} is not null), '{}')`,
          currencies: sql<
            string[]
          >`coalesce(array_agg(distinct ${schema.postings.currency}) filter (where ${schema.postings.currency} is not null), '{}')`,
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
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.ledgerOperations)
        .where(where),
    ]);

    return {
      data: rows.map((row) => ({
        ...row,
        bookIds: row.bookIds ?? [],
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
        bookIds: sql<
          string[]
        >`coalesce(array_agg(distinct ${schema.postings.bookId}) filter (where ${schema.postings.bookId} is not null), '{}')`,
        currencies: sql<
          string[]
        >`coalesce(array_agg(distinct ${schema.postings.currency}) filter (where ${schema.postings.currency} is not null), '{}')`,
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

    if (!operation) return null;

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

    const instanceById = new Map(instances.map((inst) => [inst.id, inst]));
    const bookIds = Array.from(new Set(postingRows.map((p) => p.bookId)));
    const bookRows =
      bookIds.length === 0
        ? []
        : await db
            .select({
              id: schema.books.id,
              name: schema.books.name,
            })
            .from(schema.books)
            .where(inArray(schema.books.id, bookIds));
    const bookNameById = new Map(bookRows.map((book) => [book.id, book.name]));

    const currencyCodes = Array.from(
      new Set(postingRows.map((p) => p.currency)),
    );
    const currencyRows =
      currencyCodes.length === 0
        ? []
        : await db
            .select({
              code: schema.currencies.code,
              precision: schema.currencies.precision,
            })
            .from(schema.currencies)
            .where(inArray(schema.currencies.code, currencyCodes));
    const precisionByCode = new Map(
      currencyRows.map((c) => [c.code, c.precision]),
    );

    return {
      operation: {
        ...operation,
        bookIds: operation.bookIds ?? [],
        currencies: operation.currencies ?? [],
      },
      postings: postingRows.map((p) => {
        const debitInst = instanceById.get(p.debitInstanceId);
        const creditInst = instanceById.get(p.creditInstanceId);
        return {
          id: p.id,
          lineNo: p.lineNo,
          bookId: p.bookId,
          bookName: bookNameById.get(p.bookId) ?? null,
          debitInstanceId: p.debitInstanceId,
          debitAccountNo: debitInst?.accountNo ?? null,
          debitDimensions: (debitInst?.dimensions as Dimensions) ?? null,
          creditInstanceId: p.creditInstanceId,
          creditAccountNo: creditInst?.accountNo ?? null,
          creditDimensions: (creditInst?.dimensions as Dimensions) ?? null,
          postingCode: p.postingCode,
          currency: p.currency,
          currencyPrecision: precisionByCode.get(p.currency) ?? 2,
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
