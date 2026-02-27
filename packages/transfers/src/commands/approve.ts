import { and, eq, sql } from "drizzle-orm";

import { buildTransferApproveTemplate } from "@bedrock/accounting";
import type { Transaction } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import { DAY_IN_SECONDS } from "@bedrock/kernel/constants";
import { NotFoundError, PermissionError } from "@bedrock/kernel/errors";

import { InvalidStateError, MakerCheckerViolationError } from "../errors";
import type { TransfersServiceContext } from "../internal/context";
import {
  createResolveTransferBindings,
  SYSTEM_LEDGER_ORG_ID,
} from "../internal/shared";
import type { ActionOptions, TransfersServiceResult } from "../types";
import {
  type ApproveTransferInput,
  validateApproveTransferInput,
} from "../validation";

export function createApproveHandler(context: TransfersServiceContext) {
  const { db, ledger, canApprove, log } = context;
  const resolveTransferBindings = createResolveTransferBindings(context);

  return async function approve(
    input: ApproveTransferInput,
    options?: ActionOptions,
  ): Promise<TransfersServiceResult> {
    const validated = validateApproveTransferInput(input);

    return db.transaction(async (tx: Transaction) => {
      const [transfer] = await tx
        .select()
        .from(schema.transferOrders)
        .where(eq(schema.transferOrders.id, validated.transferId))
        .limit(1);

      if (!transfer) {
        throw new NotFoundError("Transfer", validated.transferId);
      }

      const allowed = await canApprove?.(
        validated.checkerUserId,
        transfer.sourceCounterpartyId,
        transfer.destinationCounterpartyId,
      );
      if (allowed === false) {
        throw new PermissionError("Not allowed to approve transfer");
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

      if (
        transfer.makerUserId === validated.checkerUserId &&
        !options?.skipMakerCheckerValidation
      ) {
        throw new MakerCheckerViolationError();
      }

      const [sourceBinding, destinationBinding] = await resolveTransferBindings(
        transfer.sourceOperationalAccountId,
        transfer.destinationOperationalAccountId,
      );
      const template = buildTransferApproveTemplate({
        transferId: transfer.id,
        kind: transfer.kind,
        settlementMode: transfer.settlementMode,
        amountMinor: transfer.amountMinor,
        timeoutSeconds: transfer.timeoutSeconds || DAY_IN_SECONDS,
        memo: transfer.memo,
        source: {
          accountId: transfer.sourceOperationalAccountId,
          counterpartyId: sourceBinding.counterpartyId,
          currencyCode: sourceBinding.currencyCode,
        },
        destination: {
          accountId: transfer.destinationOperationalAccountId,
          counterpartyId: destinationBinding.counterpartyId,
          currencyCode: destinationBinding.currencyCode,
        },
      });

      const result = await ledger.commit(tx, {
        source: { type: "transfer/v3/approve", id: transfer.id },
        operationCode: template.operationCode,
        operationVersion: 1,
        payload: {
          transferId: transfer.id,
          sourceOperationalAccountId: transfer.sourceOperationalAccountId,
          destinationOperationalAccountId:
            transfer.destinationOperationalAccountId,
          amountMinor: transfer.amountMinor.toString(),
          settlementMode: transfer.settlementMode,
          kind: transfer.kind,
        },
        idempotencyKey: `tr3:approve:${transfer.id}`,
        postingDate: validated.occurredAt,
        bookOrgId: SYSTEM_LEDGER_ORG_ID,
        lines: template.lines,
      });

      const sourcePendingTransferId =
        transfer.settlementMode === "pending"
          ? (result.pendingTransferIdsByRef.get(template.sourcePendingRef) ??
            null)
          : null;
      const destinationPendingTransferId =
        transfer.settlementMode === "pending" &&
        transfer.kind === "cross_org" &&
        template.destinationPendingRef
          ? (result.pendingTransferIdsByRef.get(
              template.destinationPendingRef,
            ) ?? null)
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

      log.info("Transfer approved", {
        transferId: transfer.id,
        ledgerOperationId: result.operationId,
        settlementMode: transfer.settlementMode,
      });

      return {
        transferId: transfer.id,
        ledgerOperationId: result.operationId,
      };
    });
  };
}
