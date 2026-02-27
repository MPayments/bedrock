import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import type { TransferAccountBinding } from "@bedrock/accounts";
import type { Transaction } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/kernel/pagination";

import { InvalidStateError, TransferCurrencyMismatchError } from "../errors";
import type { TransfersServiceContext } from "./context";

export const SYSTEM_LEDGER_ORG_ID = "00000000-0000-4000-8000-000000000001";

export type TransferOrderRow = typeof schema.transferOrders.$inferSelect;
export type TransferOrderProjection = TransferOrderRow & {
  currencyCode: string | null;
  sourceCounterpartyName: string | null;
  destinationCounterpartyName: string | null;
  sourceOperationalAccountLabel: string | null;
  destinationOperationalAccountLabel: string | null;
};

export const SORT_COLUMN_MAP = {
  createdAt: schema.transferOrders.createdAt,
  updatedAt: schema.transferOrders.updatedAt,
  approvedAt: schema.transferOrders.approvedAt,
} as const;

export const TRANSFER_SELECT_FIELDS = {
  id: schema.transferOrders.id,
  sourceCounterpartyId: schema.transferOrders.sourceCounterpartyId,
  destinationCounterpartyId: schema.transferOrders.destinationCounterpartyId,
  sourceOperationalAccountId: schema.transferOrders.sourceOperationalAccountId,
  destinationOperationalAccountId:
    schema.transferOrders.destinationOperationalAccountId,
  currencyId: schema.transferOrders.currencyId,
  amountMinor: schema.transferOrders.amountMinor,
  kind: schema.transferOrders.kind,
  settlementMode: schema.transferOrders.settlementMode,
  timeoutSeconds: schema.transferOrders.timeoutSeconds,
  status: schema.transferOrders.status,
  memo: schema.transferOrders.memo,
  makerUserId: schema.transferOrders.makerUserId,
  checkerUserId: schema.transferOrders.checkerUserId,
  approvedAt: schema.transferOrders.approvedAt,
  rejectedAt: schema.transferOrders.rejectedAt,
  rejectReason: schema.transferOrders.rejectReason,
  ledgerOperationId: schema.transferOrders.ledgerOperationId,
  sourcePendingTransferId: schema.transferOrders.sourcePendingTransferId,
  destinationPendingTransferId:
    schema.transferOrders.destinationPendingTransferId,
  idempotencyKey: schema.transferOrders.idempotencyKey,
  lastError: schema.transferOrders.lastError,
  createdAt: schema.transferOrders.createdAt,
  updatedAt: schema.transferOrders.updatedAt,
  currencyCode: sql<string | null>`(
    select ${schema.currencies.code}
    from ${schema.currencies}
    where ${schema.currencies.id} = ${schema.transferOrders.currencyId}
    limit 1
  )`,
  sourceCounterpartyName: sql<string | null>`(
    select ${schema.counterparties.shortName}
    from ${schema.counterparties}
    where ${schema.counterparties.id} = ${schema.transferOrders.sourceCounterpartyId}
    limit 1
  )`,
  destinationCounterpartyName: sql<string | null>`(
    select ${schema.counterparties.shortName}
    from ${schema.counterparties}
    where ${schema.counterparties.id} = ${schema.transferOrders.destinationCounterpartyId}
    limit 1
  )`,
  sourceOperationalAccountLabel: sql<string | null>`(
    select ${schema.operationalAccounts.label}
    from ${schema.operationalAccounts}
    where ${schema.operationalAccounts.id} = ${schema.transferOrders.sourceOperationalAccountId}
    limit 1
  )`,
  destinationOperationalAccountLabel: sql<string | null>`(
    select ${schema.operationalAccounts.label}
    from ${schema.operationalAccounts}
    where ${schema.operationalAccounts.id} = ${schema.transferOrders.destinationOperationalAccountId}
    limit 1
  )`,
};

export function inArraySafe<T>(column: any, values: T[] | undefined) {
  if (!values || values.length === 0) return undefined;
  return inArray(column, values as any[]);
}

export function createResolveTransferBindings(
  context: TransfersServiceContext,
) {
  const { accountService } = context;

  return async function resolveTransferBindings(
    sourceOperationalAccountId: string,
    destinationOperationalAccountId: string,
  ): Promise<[TransferAccountBinding, TransferAccountBinding]> {
    const [sourceBinding, destinationBinding] =
      await accountService.resolveTransferBindings({
        accountIds: [
          sourceOperationalAccountId,
          destinationOperationalAccountId,
        ],
      });

    if (!sourceBinding || !destinationBinding) {
      throw new InvalidStateError(
        "Unable to resolve transfer account bindings",
      );
    }

    if (sourceBinding.currencyId !== destinationBinding.currencyId) {
      throw new TransferCurrencyMismatchError(
        sourceBinding.currencyId,
        destinationBinding.currencyId,
      );
    }

    return [sourceBinding, destinationBinding];
  };
}

export async function getTransferProjection(
  tx: Transaction | TransfersServiceContext["db"],
  transferId: string,
): Promise<TransferOrderProjection | null> {
  const [transfer] = await tx
    .select(TRANSFER_SELECT_FIELDS)
    .from(schema.transferOrders)
    .where(eq(schema.transferOrders.id, transferId))
    .limit(1);
  return transfer ?? null;
}

export async function listTransferProjections(
  db: TransfersServiceContext["db"],
  input: {
    limit: number;
    offset: number;
    sortBy: keyof typeof SORT_COLUMN_MAP | undefined;
    sortOrder: "asc" | "desc" | undefined;
    sourceCounterpartyId?: string;
    destinationCounterpartyId?: string;
    status?: string[];
    settlementMode?: string[];
    kind?: string[];
  },
): Promise<PaginatedList<TransferOrderProjection>> {
  const conditions: SQL[] = [];
  if (input.sourceCounterpartyId) {
    conditions.push(
      eq(
        schema.transferOrders.sourceCounterpartyId,
        input.sourceCounterpartyId,
      ),
    );
  }
  if (input.destinationCounterpartyId) {
    conditions.push(
      eq(
        schema.transferOrders.destinationCounterpartyId,
        input.destinationCounterpartyId,
      ),
    );
  }

  const statusCondition = inArraySafe(
    schema.transferOrders.status,
    input.status,
  );
  if (statusCondition) conditions.push(statusCondition);

  const settlementModeCondition = inArraySafe(
    schema.transferOrders.settlementMode,
    input.settlementMode,
  );
  if (settlementModeCondition) conditions.push(settlementModeCondition);

  const kindCondition = inArraySafe(schema.transferOrders.kind, input.kind);
  if (kindCondition) conditions.push(kindCondition);

  const where = conditions.length ? and(...conditions) : undefined;
  const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
  const orderByCol = resolveSortValue(
    input.sortBy,
    SORT_COLUMN_MAP,
    schema.transferOrders.createdAt,
  );

  const [rows, countRows] = await Promise.all([
    db
      .select(TRANSFER_SELECT_FIELDS)
      .from(schema.transferOrders)
      .where(where)
      .orderBy(orderByFn(orderByCol))
      .limit(input.limit)
      .offset(input.offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.transferOrders)
      .where(where),
  ]);

  return {
    data: rows,
    total: countRows[0]?.total ?? 0,
    limit: input.limit,
    offset: input.offset,
  };
}
