import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import { schema, type LedgerOperationStatus } from "@bedrock/db/schema";
import type { Dimensions } from "@bedrock/db/schema";
import { isUuidLike } from "@bedrock/kernel";
import {
  type PaginatedList,
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/kernel/pagination";

import {
  ListLedgerOperationsQuerySchema,
  type ListLedgerOperationsQuery,
} from "./list-ledger-operations-query";
import type { LedgerContext } from "../internal/context";

const BANK_ACCOUNT_NO = "1110";

const OPERATION_SORT_COLUMN_MAP = {
  createdAt: schema.ledgerOperations.createdAt,
  postingDate: schema.ledgerOperations.postingDate,
  postedAt: schema.ledgerOperations.postedAt,
} as const;

function inArraySafe<T>(column: any, values: T[] | undefined) {
  if (!values || values.length === 0) return undefined;
  return inArray(column, values as any[]);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length <= size) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export type DimensionLabelResolver = (deps: {
  db: LedgerContext["db"];
  values: string[];
}) => Promise<Map<string, string>>;

export const DIMENSION_LABEL_REGISTRY: Record<string, DimensionLabelResolver> =
  {
    counterpartyId: async ({ db, values }) => {
      const ids = uniqueStrings(values);
      if (ids.length === 0) return new Map();

      const rows = await db
        .select({
          id: schema.counterparties.id,
          label: schema.counterparties.shortName,
        })
        .from(schema.counterparties)
        .where(inArray(schema.counterparties.id, ids));

      return new Map(rows.map((r) => [r.id, r.label]));
    },

    operationalAccountId: async ({ db, values }) => {
      const ids = uniqueStrings(values);
      if (ids.length === 0) return new Map();

      const rows = await db
        .select({
          id: schema.operationalAccounts.id,
          label: schema.operationalAccounts.label,
        })
        .from(schema.operationalAccounts)
        .where(inArray(schema.operationalAccounts.id, ids));

      return new Map(rows.map((r) => [r.id, r.label]));
    },

    customerId: async ({ db, values }) => {
      const ids = uniqueStrings(values);
      if (ids.length === 0) return new Map();

      const rows = await db
        .select({
          id: schema.customers.id,
          label: schema.customers.displayName,
        })
        .from(schema.customers)
        .where(inArray(schema.customers.id, ids));

      return new Map(rows.map((r) => [r.id, r.label]));
    },

    orderId: async ({ db, values }) => {
      const ids = uniqueStrings(values).filter(isUuidLike);
      if (ids.length === 0) return new Map();

      const labels = new Map<string, string>();
      const paymentRows = await db
        .select({ id: schema.paymentOrders.id })
        .from(schema.paymentOrders)
        .where(inArray(schema.paymentOrders.id, ids));
      for (const r of paymentRows) labels.set(r.id, `payment order ${r.id}`);

      const remaining = ids.filter((id) => !labels.has(id));
      if (remaining.length > 0) {
        const transferRows = await db
          .select({ id: schema.transferOrders.id })
          .from(schema.transferOrders)
          .where(inArray(schema.transferOrders.id, remaining));
        for (const r of transferRows) {
          labels.set(r.id, `transfer order ${r.id}`);
        }
      }

      return labels;
    },
  };

export async function resolveDimensionLabelsFromInstances(deps: {
  db: LedgerContext["db"];
  instances: { dimensions: unknown | null }[];
  registry?: Record<string, DimensionLabelResolver>;
  inArrayChunkSize?: number;
}): Promise<Record<string, string>> {
  const { db } = deps;
  const registry = deps.registry ?? DIMENSION_LABEL_REGISTRY;

  const valuesByKey = new Map<string, Set<string>>();

  for (const inst of deps.instances) {
    const dims = (inst.dimensions as Dimensions | null) ?? null;
    if (!dims) continue;

    for (const [k, v] of Object.entries(dims)) {
      if (typeof v !== "string" || v.length === 0) continue;
      let set = valuesByKey.get(k);
      if (!set) {
        set = new Set<string>();
        valuesByKey.set(k, set);
      }
      set.add(v);
    }
  }

  const dimensionLabels: Record<string, string> = {};
  const chunkSize = Math.max(1, deps.inArrayChunkSize ?? 5_000);

  for (const [dimensionKey, valueSet] of valuesByKey) {
    const resolver = registry[dimensionKey];
    if (!resolver) continue;

    const values = Array.from(valueSet);
    if (values.length === 0) continue;

    const chunks = chunk(values, chunkSize);
    const maps = await Promise.all(
      chunks.map((c) => resolver({ db, values: c })),
    );
    for (const m of maps) {
      for (const [value, label] of m) {
        dimensionLabels[value] = label;
      }
    }
  }

  return dimensionLabels;
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
  dimensionLabels: Record<string, string>;
}

export interface LedgerReadQueries {
  listOperations: (
    input?: ListLedgerOperationsQuery,
  ) => Promise<PaginatedList<LedgerOperationListRow>>;
  getOperationDetails: (
    operationId: string,
  ) => Promise<LedgerOperationDetails | null>;
  getBalancesByOperationalAccountIds: (accountIds: string[]) => Promise<
    {
      operationalAccountId: string;
      currency: string;
      balanceMinor: bigint;
      precision: number;
    }[]
  >;
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
      status,
      operationCode,
      sourceType,
      sourceId,
      bookOrgId,
      counterpartyId,
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
          bookOrgIds: sql<
            string[]
          >`coalesce(array_agg(distinct ${schema.postings.bookOrgId}) filter (where ${schema.postings.bookOrgId} is not null), '{}')`,
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
        bookOrgIds: sql<
          string[]
        >`coalesce(array_agg(distinct ${schema.postings.bookOrgId}) filter (where ${schema.postings.bookOrgId} is not null), '{}')`,
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

    const dimensionLabels = await resolveDimensionLabelsFromInstances({
      db,
      instances: instances.map((i) => ({ dimensions: i.dimensions })),
      registry: DIMENSION_LABEL_REGISTRY,
    });

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
      dimensionLabels,
    };
  }

  async function getBalancesByOperationalAccountIds(
    accountIds: string[],
  ): Promise<
    {
      operationalAccountId: string;
      currency: string;
      balanceMinor: bigint;
      precision: number;
    }[]
  > {
    if (accountIds.length === 0) return [];

    const accountIdList = sql.join(
      accountIds.map((id) => sql`${id}`),
      sql`, `,
    );

    const result = await db.execute(sql`
      SELECT
        operational_account_id,
        currency,
        SUM(delta)::text AS balance_minor
      FROM (
        SELECT
          inst.dimensions->>'operationalAccountId' AS operational_account_id,
          inst.currency,
          p.amount_minor AS delta
        FROM book_account_instances inst
        JOIN postings p ON p.debit_instance_id = inst.id
        JOIN ledger_operations lo ON lo.id = p.operation_id AND lo.status = 'posted'
        WHERE inst.account_no = ${BANK_ACCOUNT_NO}
          AND inst.dimensions->>'operationalAccountId' IN (${accountIdList})
        UNION ALL
        SELECT
          inst.dimensions->>'operationalAccountId' AS operational_account_id,
          inst.currency,
          -p.amount_minor AS delta
        FROM book_account_instances inst
        JOIN postings p ON p.credit_instance_id = inst.id
        JOIN ledger_operations lo ON lo.id = p.operation_id AND lo.status = 'posted'
        WHERE inst.account_no = ${BANK_ACCOUNT_NO}
          AND inst.dimensions->>'operationalAccountId' IN (${accountIdList})
      ) t
      GROUP BY operational_account_id, currency
    `);

    const rows = result.rows as {
      operational_account_id: string;
      currency: string;
      balance_minor: string;
    }[];

    const currencyCodes = Array.from(new Set(rows.map((r) => r.currency)));
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

    return rows.map((r) => ({
      operationalAccountId: r.operational_account_id,
      currency: r.currency,
      balanceMinor: BigInt(r.balance_minor),
      precision: precisionByCode.get(r.currency) ?? 2,
    }));
  }

  return {
    listOperations,
    getOperationDetails,
    getBalancesByOperationalAccountIds,
  };
}
