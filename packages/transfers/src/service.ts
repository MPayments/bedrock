import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import {
  buildTransferApproveTemplate,
  buildTransferPendingActionTemplate,
} from "@bedrock/accounting";
import type { AccountService, TransferAccountBinding } from "@bedrock/accounts";
import { type Database } from "@bedrock/db";
import { schema, type TransferStatus } from "@bedrock/db/schema";
import { type Logger } from "@bedrock/kernel";
import {
  DAY_IN_SECONDS,
} from "@bedrock/kernel/constants";
import { NotFoundError, PermissionError } from "@bedrock/kernel/errors";
import {
  type PaginatedList,
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/kernel/pagination";
import { type createLedgerEngine } from "@bedrock/ledger";

import {
  InvalidStateError,
  MakerCheckerViolationError,
  TransferCurrencyMismatchError,
} from "./errors";
import {
  ListTransfersQuerySchema,
  validateApproveTransferInput,
  validateCreateTransferDraftInput,
  validateRejectTransferInput,
  validateSettlePendingTransferInput,
  validateVoidPendingTransferInput,
  type ListTransfersQuery,
  type ApproveTransferInput,
  type CreateTransferDraftInput,
  type RejectTransferInput,
  type SettlePendingTransferInput,
  type VoidPendingTransferInput,
} from "./validation";

type LedgerEngine = ReturnType<typeof createLedgerEngine>;
type TransactionClient = Parameters<Parameters<Database["transaction"]>[0]>[0];

const SORT_COLUMN_MAP = {
  createdAt: schema.transferOrders.createdAt,
  updatedAt: schema.transferOrders.updatedAt,
  approvedAt: schema.transferOrders.approvedAt,
} as const;

type TransferOrderRow = typeof schema.transferOrders.$inferSelect;
type PendingTransferEventType = "settle" | "void";

function inArraySafe<T>(column: any, values: T[] | undefined) {
  if (!values || values.length === 0) return undefined;
  return inArray(column, values as any[]);
}

export interface TransfersServiceResult {
  transferId: string;
  ledgerOperationId: string;
}

export type TransfersService = ReturnType<typeof createTransfersService>;

export function createTransfersService(deps: {
  db: Database;
  ledger: LedgerEngine;
  accountService: Pick<AccountService, "resolveTransferBindings">;
  canApprove?: (
    actorUserId: string,
    sourceCounterpartyId: string,
    destinationCounterpartyId: string,
  ) => Promise<boolean> | boolean;
  logger?: Logger;
}) {
  const { db, ledger, accountService, logger } = deps;

  async function resolveTransferBindings(
    sourceAccountId: string,
    destinationAccountId: string,
  ): Promise<[TransferAccountBinding, TransferAccountBinding]> {
    const [sourceBinding, destinationBinding] =
      await accountService.resolveTransferBindings({
        accountIds: [sourceAccountId, destinationAccountId],
      });

    if (!sourceBinding || !destinationBinding) {
      throw new InvalidStateError("Unable to resolve transfer account bindings");
    }

    if (sourceBinding.currencyId !== destinationBinding.currencyId) {
      throw new TransferCurrencyMismatchError(
        sourceBinding.currencyId,
        destinationBinding.currencyId,
      );
    }

    return [sourceBinding, destinationBinding];
  }

  async function createDraft(input: CreateTransferDraftInput) {
    const validated = validateCreateTransferDraftInput(input);
    const [sourceBinding, destinationBinding] = await resolveTransferBindings(
      validated.sourceAccountId,
      validated.destinationAccountId,
    );

    const kind: typeof schema.transferOrders.$inferInsert.kind =
      sourceBinding.counterpartyId === destinationBinding.counterpartyId
        ? "intra_org"
        : "cross_org";
    const settlementMode = validated.settlementMode ?? "immediate";
    const timeoutSeconds =
      settlementMode === "pending"
        ? (validated.timeoutSeconds ?? DAY_IN_SECONDS)
        : 0;

    const inserted = await db
      .insert(schema.transferOrders)
      .values({
        sourceCounterpartyId: sourceBinding.counterpartyId,
        destinationCounterpartyId: destinationBinding.counterpartyId,
        sourceAccountId: sourceBinding.accountId,
        destinationAccountId: destinationBinding.accountId,
        currencyId: sourceBinding.currencyId,
        amountMinor: validated.amountMinor,
        kind,
        settlementMode,
        timeoutSeconds,
        status: "draft",
        memo: validated.memo ?? null,
        makerUserId: validated.makerUserId,
        idempotencyKey: validated.idempotencyKey,
      })
      .onConflictDoNothing()
      .returning({ id: schema.transferOrders.id });

    if (inserted.length > 0) {
      const transferId = inserted[0]!.id;
      logger?.info("Transfer draft created", {
        transferId,
        kind,
        settlementMode,
        amountMinor: validated.amountMinor.toString(),
      });
      return transferId;
    }

    const [existing] = await db
      .select({ id: schema.transferOrders.id })
      .from(schema.transferOrders)
      .where(
        and(
          eq(
            schema.transferOrders.sourceCounterpartyId,
            sourceBinding.counterpartyId,
          ),
          eq(schema.transferOrders.idempotencyKey, validated.idempotencyKey),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new InvalidStateError(
        "Draft upsert failed unexpectedly - conflicting row not found",
      );
    }

    logger?.debug("Transfer draft already exists (idempotent)", {
      transferId: existing.id,
      idempotencyKey: validated.idempotencyKey,
    });
    return existing.id;
  }

  async function approve(
    input: ApproveTransferInput,
  ): Promise<TransfersServiceResult> {
    const validated = validateApproveTransferInput(input);

    return db.transaction(async (tx: TransactionClient) => {
      const [transfer] = await tx
        .select()
        .from(schema.transferOrders)
        .where(eq(schema.transferOrders.id, validated.transferId))
        .limit(1);

      if (!transfer) {
        throw new NotFoundError("Transfer", validated.transferId);
      }

      const existingLedgerOperationId = transfer.ledgerOperationId;

      if (transfer.status !== "draft") {
        if (
          existingLedgerOperationId &&
          (transfer.status === "approved_pending_posting" ||
            transfer.status === "pending" ||
            transfer.status === "posted")
        ) {
          return {
            transferId: transfer.id,
            ledgerOperationId: existingLedgerOperationId,
          };
        }

        throw new InvalidStateError(
          `approve allowed only from draft, got ${transfer.status}`,
          transfer.status,
          ["draft"],
        );
      }

      if (transfer.makerUserId === validated.checkerUserId) {
        throw new MakerCheckerViolationError();
      }

      const allowed = await deps.canApprove?.(
        validated.checkerUserId,
        transfer.sourceCounterpartyId,
        transfer.destinationCounterpartyId,
      );
      if (allowed === false) {
        throw new PermissionError("Not allowed to approve transfer");
      }

      const [sourceBinding, destinationBinding] = await resolveTransferBindings(
        transfer.sourceAccountId,
        transfer.destinationAccountId,
      );

      const template = buildTransferApproveTemplate({
        transferId: transfer.id,
        kind: transfer.kind,
        settlementMode: transfer.settlementMode,
        amountMinor: transfer.amountMinor,
        timeoutSeconds: transfer.timeoutSeconds || DAY_IN_SECONDS,
        memo: transfer.memo,
        source: {
          accountId: transfer.sourceAccountId,
          counterpartyId: sourceBinding.counterpartyId,
          bookOrgId: sourceBinding.bookOrgId,
          bookAccountNo: sourceBinding.bookAccountNo,
          currencyCode: sourceBinding.currencyCode,
        },
        destination: {
          accountId: transfer.destinationAccountId,
          counterpartyId: destinationBinding.counterpartyId,
          bookOrgId: destinationBinding.bookOrgId,
          bookAccountNo: destinationBinding.bookAccountNo,
          currencyCode: destinationBinding.currencyCode,
        },
      });

      const result = await ledger.createOperationTx(tx, {
        source: {
          type: "transfer/v3/approve",
          id: transfer.id,
        },
        operationCode: template.operationCode,
        operationVersion: 1,
        payload: {
          transferId: transfer.id,
          sourceAccountId: transfer.sourceAccountId,
          destinationAccountId: transfer.destinationAccountId,
          amountMinor: transfer.amountMinor.toString(),
          settlementMode: transfer.settlementMode,
          kind: transfer.kind,
        },
        idempotencyKey: `tr3:approve:${transfer.id}`,
        postingDate: validated.occurredAt,
        transfers: template.transfers,
      });

      const sourcePendingTransferId =
        transfer.settlementMode === "pending"
          ? (result.pendingTransferIdsByRef.get(template.sourcePendingRef) ?? null)
          : null;

      const destinationPendingTransferId =
        transfer.settlementMode === "pending" &&
        transfer.kind === "cross_org" &&
        template.destinationPendingRef
          ? (result.pendingTransferIdsByRef.get(template.destinationPendingRef) ?? null)
          : null;

      const moved = await tx
        .update(schema.transferOrders)
        .set({
          status: "approved_pending_posting",
          checkerUserId: validated.checkerUserId,
          approvedAt: validated.occurredAt,
          ledgerOperationId: result.operationId,
          sourcePendingTransferId,
          destinationPendingTransferId,
          lastError: null,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(schema.transferOrders.id, transfer.id),
            eq(schema.transferOrders.status, "draft"),
          ),
        )
        .returning({ id: schema.transferOrders.id });

      if (!moved.length) {
        const [current] = await tx
          .select({
            status: schema.transferOrders.status,
            ledgerOperationId: schema.transferOrders.ledgerOperationId,
          })
          .from(schema.transferOrders)
          .where(eq(schema.transferOrders.id, transfer.id))
          .limit(1);

        if (
          current &&
          current.ledgerOperationId === result.operationId &&
          (current.status === "approved_pending_posting" ||
            current.status === "pending" ||
            current.status === "posted")
        ) {
          return {
            transferId: transfer.id,
            ledgerOperationId: result.operationId,
          };
        }

        throw new InvalidStateError(
          "Approve race: transfer state changed during transaction",
        );
      }

      logger?.info("Transfer approved", {
        transferId: transfer.id,
        ledgerOperationId: result.operationId,
        settlementMode: transfer.settlementMode,
      });

      return {
        transferId: transfer.id,
        ledgerOperationId: result.operationId,
      };
    });
  }

  async function reject(input: RejectTransferInput) {
    const validated = validateRejectTransferInput(input);

    return db.transaction(async (tx: TransactionClient) => {
      const [transfer] = await tx
        .select()
        .from(schema.transferOrders)
        .where(eq(schema.transferOrders.id, validated.transferId))
        .limit(1);

      if (!transfer) {
        throw new NotFoundError("Transfer", validated.transferId);
      }

      const allowed = await deps.canApprove?.(
        validated.checkerUserId,
        transfer.sourceCounterpartyId,
        transfer.destinationCounterpartyId,
      );
      if (allowed === false) {
        throw new PermissionError("Not allowed to reject transfer");
      }

      if (transfer.status !== "draft") {
        if (transfer.status === "rejected") {
          return transfer.id;
        }

        throw new InvalidStateError(
          `reject allowed only from draft, got ${transfer.status}`,
          transfer.status,
          ["draft"],
        );
      }

      if (transfer.makerUserId === validated.checkerUserId) {
        throw new MakerCheckerViolationError();
      }

      const updated = await tx
        .update(schema.transferOrders)
        .set({
          status: "rejected",
          checkerUserId: validated.checkerUserId,
          rejectedAt: validated.occurredAt,
          rejectReason: validated.reason,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(schema.transferOrders.id, transfer.id),
            eq(schema.transferOrders.status, "draft"),
          ),
        )
        .returning({ id: schema.transferOrders.id });

      if (!updated.length) {
        throw new InvalidStateError(
          "Reject race: transfer state changed during transaction",
        );
      }

      logger?.info("Transfer rejected", {
        transferId: transfer.id,
        checkerUserId: validated.checkerUserId,
      });
      return transfer.id;
    });
  }

  async function movePendingTransfer(
    tx: TransactionClient,
    transfer: TransferOrderRow,
    input: SettlePendingTransferInput | VoidPendingTransferInput,
    eventType: PendingTransferEventType,
  ): Promise<TransfersServiceResult> {
    const idempotentStatuses: TransferStatus[] =
      eventType === "settle"
        ? ["settle_pending_posting", "posted"]
        : ["void_pending_posting", "voided"];

    const [existingEvent] = await tx
      .select({
        ledgerOperationId: schema.transferEvents.ledgerOperationId,
      })
      .from(schema.transferEvents)
      .where(
        and(
          eq(schema.transferEvents.transferId, transfer.id),
          eq(schema.transferEvents.eventType, eventType),
          eq(
            schema.transferEvents.eventIdempotencyKey,
            input.eventIdempotencyKey,
          ),
        ),
      )
      .limit(1);

    if (
      existingEvent?.ledgerOperationId &&
      idempotentStatuses.includes(transfer.status)
    ) {
      return {
        transferId: transfer.id,
        ledgerOperationId: existingEvent.ledgerOperationId,
      };
    }

    if (transfer.status !== "pending") {
      throw new InvalidStateError(
        `${eventType} allowed only from pending, got ${transfer.status}`,
        transfer.status,
        ["pending"],
      );
    }
    if (transfer.settlementMode !== "pending") {
      throw new InvalidStateError(
        "settle/void is only allowed for pending settlement mode",
      );
    }

    const pendingIds = [
      transfer.sourcePendingTransferId,
      transfer.destinationPendingTransferId,
    ].filter((value): value is bigint => value !== null);

    if (pendingIds.length === 0) {
      throw new InvalidStateError(
        "Pending transfer is missing pending transfer IDs",
      );
    }

    const insertedEvent = await tx
      .insert(schema.transferEvents)
      .values({
        transferId: transfer.id,
        eventType,
        eventIdempotencyKey: input.eventIdempotencyKey,
        externalRef: input.externalRef ?? null,
      })
      .onConflictDoNothing()
      .returning({
        id: schema.transferEvents.id,
        ledgerOperationId: schema.transferEvents.ledgerOperationId,
      });

    if (!insertedEvent.length) {
      const [conflictEvent] = await tx
        .select({
          ledgerOperationId: schema.transferEvents.ledgerOperationId,
        })
        .from(schema.transferEvents)
        .where(
          and(
            eq(schema.transferEvents.transferId, transfer.id),
            eq(schema.transferEvents.eventType, eventType),
            eq(
              schema.transferEvents.eventIdempotencyKey,
              input.eventIdempotencyKey,
            ),
          ),
        )
        .limit(1);

      if (
        conflictEvent?.ledgerOperationId &&
        idempotentStatuses.includes(transfer.status)
      ) {
        return {
          transferId: transfer.id,
          ledgerOperationId: conflictEvent.ledgerOperationId,
        };
      }

      throw new InvalidStateError(
        `${eventType} conflict for eventIdempotencyKey=${input.eventIdempotencyKey}`,
      );
    }

    const [sourceBinding] = await accountService.resolveTransferBindings({
      accountIds: [transfer.sourceAccountId],
    });
    if (!sourceBinding) {
      throw new InvalidStateError("Unable to resolve source account binding");
    }

    const template = buildTransferPendingActionTemplate({
      transferId: transfer.id,
      eventIdempotencyKey: input.eventIdempotencyKey,
      eventType,
      currency: sourceBinding.currencyCode,
      pendingIds,
    });

    const entry = await ledger.createOperationTx(tx, {
      source: {
        type: `transfer/v3/${eventType}`,
        id: transfer.id,
      },
      operationCode: template.operationCode,
      operationVersion: 1,
      payload: {
        transferId: transfer.id,
        pendingIds: pendingIds.map((id) => id.toString()),
        eventIdempotencyKey: input.eventIdempotencyKey,
      },
      idempotencyKey: `tr3:${eventType}:${transfer.id}:${input.eventIdempotencyKey}`,
      postingDate: input.occurredAt,
      transfers: template.transfers,
    });

    await tx
      .update(schema.transferEvents)
      .set({
        ledgerOperationId: entry.operationId,
      })
      .where(
        and(
          eq(schema.transferEvents.transferId, transfer.id),
          eq(schema.transferEvents.eventType, eventType),
          eq(
            schema.transferEvents.eventIdempotencyKey,
            input.eventIdempotencyKey,
          ),
        ),
      );

    const nextStatus: TransferStatus =
      eventType === "settle"
        ? "settle_pending_posting"
        : "void_pending_posting";

    const moved = await tx
      .update(schema.transferOrders)
      .set({
        status: nextStatus,
        ledgerOperationId: entry.operationId,
        lastError: null,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(schema.transferOrders.id, transfer.id),
          eq(schema.transferOrders.status, "pending"),
        ),
      )
      .returning({ id: schema.transferOrders.id });

    if (!moved.length) {
      throw new InvalidStateError(
        `${eventType} race: transfer state changed during transaction`,
      );
    }

    return {
      transferId: transfer.id,
      ledgerOperationId: entry.operationId,
    };
  }

  async function settlePending(
    input: SettlePendingTransferInput,
  ): Promise<TransfersServiceResult> {
    const validated = validateSettlePendingTransferInput(input);

    return db.transaction(async (tx: TransactionClient) => {
      const [transfer] = await tx
        .select()
        .from(schema.transferOrders)
        .where(eq(schema.transferOrders.id, validated.transferId))
        .limit(1);

      if (!transfer) {
        throw new NotFoundError("Transfer", validated.transferId);
      }

      const allowed = await deps.canApprove?.(
        transfer.checkerUserId ?? transfer.makerUserId,
        transfer.sourceCounterpartyId,
        transfer.destinationCounterpartyId,
      );
      if (allowed === false) {
        throw new PermissionError("Not allowed to settle transfer");
      }

      return movePendingTransfer(tx, transfer, validated, "settle");
    });
  }

  async function voidPending(
    input: VoidPendingTransferInput,
  ): Promise<TransfersServiceResult> {
    const validated = validateVoidPendingTransferInput(input);

    return db.transaction(async (tx: TransactionClient) => {
      const [transfer] = await tx
        .select()
        .from(schema.transferOrders)
        .where(eq(schema.transferOrders.id, validated.transferId))
        .limit(1);

      if (!transfer) {
        throw new NotFoundError("Transfer", validated.transferId);
      }

      const allowed = await deps.canApprove?.(
        transfer.checkerUserId ?? transfer.makerUserId,
        transfer.sourceCounterpartyId,
        transfer.destinationCounterpartyId,
      );
      if (allowed === false) {
        throw new PermissionError("Not allowed to void transfer");
      }

      return movePendingTransfer(tx, transfer, validated, "void");
    });
  }

  async function get(transferId: string): Promise<TransferOrderRow> {
    const [transfer] = await db
      .select()
      .from(schema.transferOrders)
      .where(eq(schema.transferOrders.id, transferId))
      .limit(1);

    if (!transfer) {
      throw new NotFoundError("Transfer", transferId);
    }

    return transfer;
  }

  async function list(
    input?: ListTransfersQuery,
  ): Promise<PaginatedList<TransferOrderRow>> {
    const query = ListTransfersQuerySchema.parse(input ?? {});
    const {
      limit,
      offset,
      sortBy,
      sortOrder,
      sourceCounterpartyId,
      destinationCounterpartyId,
      status,
      settlementMode,
      kind,
    } = query;

    const conditions: SQL[] = [];
    if (sourceCounterpartyId) {
      conditions.push(
        eq(schema.transferOrders.sourceCounterpartyId, sourceCounterpartyId),
      );
    }
    if (destinationCounterpartyId) {
      conditions.push(
        eq(
          schema.transferOrders.destinationCounterpartyId,
          destinationCounterpartyId,
        ),
      );
    }

    const statusCondition = inArraySafe(schema.transferOrders.status, status);
    if (statusCondition) conditions.push(statusCondition);

    const settlementModeCondition = inArraySafe(
      schema.transferOrders.settlementMode,
      settlementMode,
    );
    if (settlementModeCondition) conditions.push(settlementModeCondition);

    const kindCondition = inArraySafe(schema.transferOrders.kind, kind);
    if (kindCondition) conditions.push(kindCondition);

    const where = conditions.length ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      sortBy,
      SORT_COLUMN_MAP,
      schema.transferOrders.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(schema.transferOrders)
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.transferOrders)
        .where(where),
    ]);

    return {
      data: rows,
      total: countRows[0]?.total ?? 0,
      limit,
      offset,
    };
  }

  return {
    createDraft,
    approve,
    reject,
    settlePending,
    voidPending,
    get,
    list,
  };
}
