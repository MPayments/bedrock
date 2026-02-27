import { and, eq, sql } from "drizzle-orm";

import { buildTransferPendingActionTemplate } from "@bedrock/accounting";
import type { Transaction } from "@bedrock/db";
import { schema, type TransferStatus } from "@bedrock/db/schema";
import { NotFoundError, PermissionError } from "@bedrock/kernel/errors";

import type { TransfersServiceResult } from "../contracts";
import { InvalidStateError } from "../errors";
import type { TransfersServiceContext } from "../internal/context";
import {
  SYSTEM_LEDGER_ORG_ID,
  type TransferOrderRow,
} from "../internal/shared";
import {
  type SettlePendingTransferInput,
  type VoidPendingTransferInput,
  validateSettlePendingTransferInput,
  validateVoidPendingTransferInput,
} from "../validation";

type PendingTransferEventType = "settle" | "void";

export function createPendingHandlers(context: TransfersServiceContext) {
  const { db, ledger, canApprove, accountService } = context;

  async function movePendingTransfer(
    tx: Transaction,
    transfer: TransferOrderRow,
    input: SettlePendingTransferInput | VoidPendingTransferInput,
    eventType: PendingTransferEventType,
  ): Promise<TransfersServiceResult> {
    const idempotentStatuses: TransferStatus[] =
      eventType === "settle"
        ? ["settle_pending_posting", "posted"]
        : ["void_pending_posting", "voided"];

    const resolveIdempotentStatusResult = async (
      ledgerOperationId: string,
    ): Promise<TransfersServiceResult | null> => {
      const [current] = await tx
        .select({ status: schema.transferOrders.status })
        .from(schema.transferOrders)
        .where(eq(schema.transferOrders.id, transfer.id))
        .limit(1);

      if (current && idempotentStatuses.includes(current.status)) {
        return { transferId: transfer.id, ledgerOperationId };
      }
      return null;
    };

    const [existingEvent] = await tx
      .select({ ledgerOperationId: schema.transferEvents.ledgerOperationId })
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

    if (existingEvent?.ledgerOperationId) {
      const existingResult = await resolveIdempotentStatusResult(
        existingEvent.ledgerOperationId,
      );
      if (existingResult) {
        return existingResult;
      }
    }

    if (transfer.status !== "pending") {
      if (
        transfer.ledgerOperationId &&
        idempotentStatuses.includes(transfer.status)
      ) {
        return {
          transferId: transfer.id,
          ledgerOperationId: transfer.ledgerOperationId,
        };
      }
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

    const [sourceBinding] = await accountService.resolveTransferBindings({
      accountIds: [transfer.sourceOperationalAccountId],
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

    const entry = await ledger.commit(tx, {
      source: { type: `transfer/v3/${eventType}`, id: transfer.id },
      operationCode: template.operationCode,
      operationVersion: 1,
      payload: {
        transferId: transfer.id,
        pendingIds: pendingIds.map((id) => id.toString()),
        eventIdempotencyKey: input.eventIdempotencyKey,
      },
      idempotencyKey: `tr3:${eventType}:${transfer.id}:${input.eventIdempotencyKey}`,
      postingDate: input.occurredAt,
      bookOrgId: SYSTEM_LEDGER_ORG_ID,
      lines: template.lines,
    });

    await tx
      .insert(schema.transferEvents)
      .values({
        transferId: transfer.id,
        eventType,
        eventIdempotencyKey: input.eventIdempotencyKey,
        externalRef: input.externalRef ?? null,
        ledgerOperationId: entry.operationId,
      })
      .onConflictDoUpdate({
        target: [
          schema.transferEvents.transferId,
          schema.transferEvents.eventType,
          schema.transferEvents.eventIdempotencyKey,
        ],
        set: {
          ledgerOperationId: entry.operationId,
          externalRef: input.externalRef ?? null,
        },
      });

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

    return { transferId: transfer.id, ledgerOperationId: entry.operationId };
  }

  async function settlePending(
    input: SettlePendingTransferInput,
    actorUserId: string,
  ): Promise<TransfersServiceResult> {
    const validated = validateSettlePendingTransferInput(input);

    return db.transaction(async (tx: Transaction) => {
      const [transfer] = await tx
        .select()
        .from(schema.transferOrders)
        .where(eq(schema.transferOrders.id, validated.transferId))
        .for("update")
        .limit(1);

      if (!transfer) {
        throw new NotFoundError("Transfer", validated.transferId);
      }

      const allowed = await canApprove?.(
        actorUserId,
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
    actorUserId: string,
  ): Promise<TransfersServiceResult> {
    const validated = validateVoidPendingTransferInput(input);

    return db.transaction(async (tx: Transaction) => {
      const [transfer] = await tx
        .select()
        .from(schema.transferOrders)
        .where(eq(schema.transferOrders.id, validated.transferId))
        .for("update")
        .limit(1);

      if (!transfer) {
        throw new NotFoundError("Transfer", validated.transferId);
      }

      const allowed = await canApprove?.(
        actorUserId,
        transfer.sourceCounterpartyId,
        transfer.destinationCounterpartyId,
      );
      if (allowed === false) {
        throw new PermissionError("Not allowed to void transfer");
      }

      return movePendingTransfer(tx, transfer, validated, "void");
    });
  }

  return { settlePending, voidPending };
}
