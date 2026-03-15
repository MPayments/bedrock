import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import type { Database } from "@bedrock/platform/persistence";
import {
  type PaginatedList,
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/shared/core/pagination";

import type { LedgerReadPort } from "../../../application/operations/ports";
import {
  ListLedgerOperationsInputSchema,
  type ListLedgerOperationsInput,
} from "../../../contracts";
import type {
  LedgerOperationDetails,
  LedgerOperationListRow,
} from "../../../contracts/dto";
import type { Dimensions } from "../../../domain/dimensions";
import { schema } from "../schema";

const OPERATION_SORT_COLUMN_MAP = {
  createdAt: schema.ledgerOperations.createdAt,
  postingDate: schema.ledgerOperations.postingDate,
  postedAt: schema.ledgerOperations.postedAt,
} as const;

function inArraySafe<T>(column: any, values: readonly T[] | undefined) {
  if (!values || values.length === 0) {
    return undefined;
  }

  return inArray(column, [...values] as T[]);
}

function normalizeDimensionFilters(
  input?: Record<string, string[]>,
): readonly (readonly [string, string[]])[] {
  if (!input) {
    return [];
  }

  return Object.entries(input)
    .map(
      ([key, values]) =>
        [
          key.trim(),
          Array.from(
            new Set(values.map((value) => value.trim()).filter(Boolean)),
          ),
        ] as const,
    )
    .filter(([key, values]) => key.length > 0 && values.length > 0);
}

export function createDrizzleLedgerReadRepository(
  db: Database,
): LedgerReadPort {
  async function listOperationDetailsByIds(
    operationIds: string[],
  ): Promise<Map<string, LedgerOperationDetails>> {
    const uniqueOperationIds = Array.from(new Set(operationIds.filter(Boolean)));
    if (uniqueOperationIds.length === 0) {
      return new Map();
    }

    const operations = await db
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
      .where(inArray(schema.ledgerOperations.id, uniqueOperationIds))
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
      );
    if (operations.length === 0) {
      return new Map();
    }

    const postingRows = await db
      .select()
      .from(schema.postings)
      .where(inArray(schema.postings.operationId, uniqueOperationIds))
      .orderBy(schema.postings.operationId, schema.postings.lineNo);
    const tbPlans = await db
      .select()
      .from(schema.tbTransferPlans)
      .where(inArray(schema.tbTransferPlans.operationId, uniqueOperationIds))
      .orderBy(schema.tbTransferPlans.operationId, schema.tbTransferPlans.lineNo);

    const instanceIds = Array.from(
      new Set(
        postingRows.flatMap((posting) => [
          posting.debitInstanceId,
          posting.creditInstanceId,
        ]),
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
    const bookIds = Array.from(new Set(postingRows.map((posting) => posting.bookId)));
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
    const postingsByOperationId = new Map<
      string,
      (typeof postingRows)[number][]
    >();
    for (const posting of postingRows) {
      const bucket = postingsByOperationId.get(posting.operationId) ?? [];
      bucket.push(posting);
      postingsByOperationId.set(posting.operationId, bucket);
    }
    const tbPlansByOperationId = new Map<string, (typeof tbPlans)[number][]>();
    for (const tbPlan of tbPlans) {
      const bucket = tbPlansByOperationId.get(tbPlan.operationId) ?? [];
      bucket.push(tbPlan);
      tbPlansByOperationId.set(tbPlan.operationId, bucket);
    }

    const operationById = new Map(operations.map((operation) => [operation.id, operation]));
    const detailsById = new Map<string, LedgerOperationDetails>();
    for (const operationId of uniqueOperationIds) {
      const operation = operationById.get(operationId);
      if (!operation) {
        continue;
      }

      const operationPostings = postingsByOperationId.get(operationId) ?? [];
      const operationTbPlans = tbPlansByOperationId.get(operationId) ?? [];

      detailsById.set(operationId, {
        operation: {
          ...operation,
          bookIds: operation.bookIds ?? [],
          currencies: operation.currencies ?? [],
        },
        postings: operationPostings.map((posting) => {
          const debitInstance = instanceById.get(posting.debitInstanceId);
          const creditInstance = instanceById.get(posting.creditInstanceId);

          return {
            id: posting.id,
            lineNo: posting.lineNo,
            bookId: posting.bookId,
            bookName: bookNameById.get(posting.bookId) ?? null,
            debitInstanceId: posting.debitInstanceId,
            debitAccountNo: debitInstance?.accountNo ?? null,
            debitDimensions: (debitInstance?.dimensions as Dimensions) ?? null,
            creditInstanceId: posting.creditInstanceId,
            creditAccountNo: creditInstance?.accountNo ?? null,
            creditDimensions:
              (creditInstance?.dimensions as Dimensions) ?? null,
            postingCode: posting.postingCode,
            currency: posting.currency,
            amountMinor: posting.amountMinor,
            memo: posting.memo,
            context: posting.context as Record<string, string> | null,
            createdAt: posting.createdAt,
          };
        }),
        tbPlans: operationTbPlans.map((plan) => ({
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
      });
    }

    return detailsById;
  }

  return {
    async listOperations(
      input?: ListLedgerOperationsInput,
    ): Promise<PaginatedList<LedgerOperationListRow>> {
      const query = ListLedgerOperationsInputSchema.parse(input ?? {});
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
        dimensionFilters,
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

      const statusCondition = inArraySafe(
        schema.ledgerOperations.status,
        status,
      );
      if (statusCondition) {
        conditions.push(statusCondition);
      }

      const operationCodeCondition = inArraySafe(
        schema.ledgerOperations.operationCode,
        operationCode,
      );
      if (operationCodeCondition) {
        conditions.push(operationCodeCondition);
      }

      const sourceTypeCondition = inArraySafe(
        schema.ledgerOperations.sourceType,
        sourceType,
      );
      if (sourceTypeCondition) {
        conditions.push(sourceTypeCondition);
      }

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

      for (const [dimensionKey, dimensionValues] of normalizeDimensionFilters(
        dimensionFilters,
      )) {
        conditions.push(sql`exists (
          select 1
          from ${schema.postings} p
          inner join ${schema.bookAccountInstances} debit_inst
            on debit_inst.id = p.debit_instance_id
          inner join ${schema.bookAccountInstances} credit_inst
            on credit_inst.id = p.credit_instance_id
          where p.operation_id = ${schema.ledgerOperations.id}
            and (
              debit_inst.dimensions ->> ${dimensionKey} in (${sql.join(
                dimensionValues.map((value) => sql`${value}`),
                sql`, `,
              )})
              or credit_inst.dimensions ->> ${dimensionKey} in (${sql.join(
                dimensionValues.map((value) => sql`${value}`),
                sql`, `,
              )})
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
    },
    listOperationDetails(
      operationIds: string[],
    ): Promise<Map<string, LedgerOperationDetails>> {
      return listOperationDetailsByIds(operationIds);
    },
    async getOperationDetails(
      operationId: string,
    ): Promise<LedgerOperationDetails | null> {
      return (await listOperationDetailsByIds([operationId])).get(operationId) ?? null;
    },
  };
}
