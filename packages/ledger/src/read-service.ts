import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import {
  ListAccountingOperationsQuerySchema,
  type ListAccountingOperationsQuery,
} from "@bedrock/accounting";
import { type Database } from "@bedrock/db";
import { schema, type LedgerOperationStatus } from "@bedrock/db/schema";
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
  debitBookAccountId: string;
  debitAccountNo: string | null;
  creditBookAccountId: string;
  creditAccountNo: string | null;
  postingCode: string;
  currency: string;
  amountMinor: bigint;
  memo: string | null;
  analyticCounterpartyId: string | null;
  analyticCustomerId: string | null;
  analyticOrderId: string | null;
  analyticOperationalAccountId: string | null;
  analyticTransferId: string | null;
  analyticQuoteId: string | null;
  analyticFeeBucket: string | null;
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
        from ${schema.ledgerPostings} lp
        where lp.operation_id = ${schema.ledgerOperations.id}
          and lp.book_org_id = ${bookOrgId}
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
          postingCount: sql<number>`count(${schema.ledgerPostings.id})::int`,
          bookOrgIds: sql<string[]>`coalesce(array_agg(distinct ${schema.ledgerPostings.bookOrgId}) filter (where ${schema.ledgerPostings.bookOrgId} is not null), '{}')`,
          currencies: sql<string[]>`coalesce(array_agg(distinct ${schema.ledgerPostings.currency}) filter (where ${schema.ledgerPostings.currency} is not null), '{}')`,
        })
        .from(schema.ledgerOperations)
        .leftJoin(
          schema.ledgerPostings,
          eq(schema.ledgerPostings.operationId, schema.ledgerOperations.id),
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
        postingCount: sql<number>`count(${schema.ledgerPostings.id})::int`,
        bookOrgIds: sql<string[]>`coalesce(array_agg(distinct ${schema.ledgerPostings.bookOrgId}) filter (where ${schema.ledgerPostings.bookOrgId} is not null), '{}')`,
        currencies: sql<string[]>`coalesce(array_agg(distinct ${schema.ledgerPostings.currency}) filter (where ${schema.ledgerPostings.currency} is not null), '{}')`,
      })
      .from(schema.ledgerOperations)
      .leftJoin(
        schema.ledgerPostings,
        eq(schema.ledgerPostings.operationId, schema.ledgerOperations.id),
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

    const postings = await db
      .select()
      .from(schema.ledgerPostings)
      .where(eq(schema.ledgerPostings.operationId, operationId))
      .orderBy(schema.ledgerPostings.lineNo);

    const tbPlans = await db
      .select()
      .from(schema.tbTransferPlans)
      .where(eq(schema.tbTransferPlans.operationId, operationId))
      .orderBy(schema.tbTransferPlans.lineNo);

    const bookAccountIds = Array.from(
      new Set(
        postings.flatMap((posting) => [
          posting.debitBookAccountId,
          posting.creditBookAccountId,
        ]),
      ),
    );

    const bookAccounts =
      bookAccountIds.length === 0
        ? []
        : await db
            .select({
              id: schema.bookAccounts.id,
              accountNo: schema.bookAccounts.accountNo,
            })
            .from(schema.bookAccounts)
            .where(inArray(schema.bookAccounts.id, bookAccountIds));

    const bookAccountById = new Map(
      bookAccounts.map((bookAccount) => [bookAccount.id, bookAccount.accountNo]),
    );

    const bookOrgIds = Array.from(new Set(postings.map((posting) => posting.bookOrgId)));
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
      postings: postings.map((posting) => ({
        id: posting.id,
        lineNo: posting.lineNo,
        bookOrgId: posting.bookOrgId,
        bookOrgName: orgNameById.get(posting.bookOrgId) ?? null,
        debitBookAccountId: posting.debitBookAccountId,
        debitAccountNo: bookAccountById.get(posting.debitBookAccountId) ?? null,
        creditBookAccountId: posting.creditBookAccountId,
        creditAccountNo: bookAccountById.get(posting.creditBookAccountId) ?? null,
        postingCode: posting.postingCode,
        currency: posting.currency,
        amountMinor: posting.amountMinor,
        memo: posting.memo,
        analyticCounterpartyId: posting.analyticCounterpartyId,
        analyticCustomerId: posting.analyticCustomerId,
        analyticOrderId: posting.analyticOrderId,
        analyticOperationalAccountId: posting.analyticOperationalAccountId,
        analyticTransferId: posting.analyticTransferId,
        analyticQuoteId: posting.analyticQuoteId,
        analyticFeeBucket: posting.analyticFeeBucket,
        createdAt: posting.createdAt,
      })),
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
