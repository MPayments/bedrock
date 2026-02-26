import { and, eq, sql } from "drizzle-orm";

import { ACCOUNT_NO, OPERATION_CODE, POSTING_CODE } from "@bedrock/accounting";
import { type Transaction } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import { makePlanKey } from "@bedrock/kernel";
import { DAY_IN_SECONDS, TransferCodes } from "@bedrock/kernel/constants";
import { InvalidStateError } from "@bedrock/kernel/errors";
import { OPERATION_TRANSFER_TYPE } from "@bedrock/ledger";

import {
  SYSTEM_LEDGER_ORG_ID,
  type TreasuryServiceContext,
} from "../internal/context";
import { assertInitiateFeePaymentReplayCompatible } from "../internal/fee-payment-idempotency";
import { buildTreasuryIntent } from "../internal/ledger-operation";
import { fetchFeePaymentOrderState } from "../internal/order-state";
import {
  type InitiateFeePaymentInput,
  type SettleFeePaymentInput,
  type VoidFeePaymentInput,
  validateInitiateFeePaymentInput,
  validateSettleFeePaymentInput,
  validateVoidFeePaymentInput,
} from "../validation";

export function createFeePaymentHandlers(context: TreasuryServiceContext) {
  const { db, ledger, currenciesService } = context;

  async function initiateFeePayment(input: InitiateFeePaymentInput) {
    const vaildated = validateInitiateFeePaymentInput(input);
    const timeoutSeconds = vaildated.timeoutSeconds ?? DAY_IN_SECONDS;

    return db.transaction(async (tx: Transaction) => {
      const feeOrder = await fetchFeePaymentOrderState(
        tx,
        vaildated.feePaymentOrderId,
      );
      const { code: feeOrderCurrency } = await currenciesService.findById(
        feeOrder.currencyId,
      );

      if (feeOrder.status !== "reserved") {
        if (
          feeOrder.status === "initiated_pending_posting" ||
          feeOrder.status === "initiated" ||
          feeOrder.status === "settled_pending_posting" ||
          feeOrder.status === "settled" ||
          feeOrder.status === "voided_pending_posting" ||
          feeOrder.status === "voided"
        ) {
          assertInitiateFeePaymentReplayCompatible(feeOrder, vaildated);
          return {
            entryId: feeOrder.initiateOperationId,
            pendingTransferId: feeOrder.pendingTransferId,
          };
        }
        throw new InvalidStateError(
          `FeePaymentOrder must be reserved, got ${feeOrder.status}`,
        );
      }

      const planKey = makePlanKey("fee_payment_init", {
        feePaymentOrderId: vaildated.feePaymentOrderId,
        railRef: vaildated.railRef,
        currency: feeOrderCurrency,
        amount: feeOrder.amountMinor.toString(),
        payoutCounterpartyId: vaildated.payoutCounterpartyId,
        payoutOperationalAccountId: vaildated.payoutOperationalAccountId,
      });
      const pendingRef = `fee_payment:${vaildated.feePaymentOrderId}:init`;

      const { operationId: entryId, pendingTransferIdsByRef } =
        await ledger.commit(
          tx,
          buildTreasuryIntent({
            source: {
              type: "fee_payment/initiated",
              id: vaildated.feePaymentOrderId,
            },
            operationCode: OPERATION_CODE.TREASURY_FEE_PAYMENT_INIT,
            payload: {
              feePaymentOrderId: vaildated.feePaymentOrderId,
              railRef: vaildated.railRef,
              amountMinor: feeOrder.amountMinor.toString(),
              currency: feeOrderCurrency,
            },
            idempotencyKey: `fee_payment:init:${vaildated.feePaymentOrderId}:${vaildated.railRef}`,
            postingDate: vaildated.occurredAt,
            bookOrgId: SYSTEM_LEDGER_ORG_ID,
            lines: [
              {
                type: OPERATION_TRANSFER_TYPE.CREATE,
                planKey,
                postingCode: POSTING_CODE.FEE_PAYMENT_INITIATED,
                debit: {
                  accountNo: ACCOUNT_NO.FEE_CLEARING,
                  currency: feeOrderCurrency,
                  dimensions: {
                    feeBucket: feeOrder.bucket,
                    orderId: feeOrder.parentOrderId,
                    counterpartyId: vaildated.payoutCounterpartyId,
                  },
                },
                credit: {
                  accountNo: ACCOUNT_NO.BANK,
                  currency: feeOrderCurrency,
                  dimensions: {
                    operationalAccountId: vaildated.payoutOperationalAccountId,
                  },
                },
                amountMinor: feeOrder.amountMinor,
                code: TransferCodes.FEE_PAYMENT_INITIATED,
                pending: {
                  timeoutSeconds,
                  ref: pendingRef,
                },
                memo: "Fee payment initiated (pending)",
              },
            ],
          }),
        );

      const pendingTransferId = pendingTransferIdsByRef.get(pendingRef);
      if (!pendingTransferId) {
        throw new InvalidStateError(
          `Missing pending transfer id for ref=${pendingRef}`,
        );
      }

      const moved = await tx
        .update(schema.feePaymentOrders)
        .set({
          status: "initiated_pending_posting",
          initiateOperationId: entryId,
          pendingTransferId,
          payoutCounterpartyId: vaildated.payoutCounterpartyId,
          payoutOperationalAccountId: vaildated.payoutOperationalAccountId,
          railRef: input.railRef,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(schema.feePaymentOrders.id, vaildated.feePaymentOrderId),
            eq(schema.feePaymentOrders.status, "reserved"),
          ),
        )
        .returning({ id: schema.feePaymentOrders.id });

      if (moved.length) {
        return { entryId, pendingTransferId };
      }

      const current = await fetchFeePaymentOrderState(
        tx,
        vaildated.feePaymentOrderId,
      );
      if (
        current.initiateOperationId === entryId &&
        (current.status === "initiated_pending_posting" ||
          current.status === "initiated")
      ) {
        if (!current.pendingTransferId) {
          throw new InvalidStateError(
            "FeePaymentOrder missing pendingTransferId",
          );
        }
        return { entryId, pendingTransferId: current.pendingTransferId };
      }

      throw new InvalidStateError(
        `Failed to update fee payment order status: concurrent modification detected. Current status: ${current.status}`,
      );
    });
  }

  async function settleFeePayment(input: SettleFeePaymentInput) {
    const validated = validateSettleFeePaymentInput(input);

    return db.transaction(async (tx: Transaction) => {
      const feeOrder = await fetchFeePaymentOrderState(
        tx,
        validated.feePaymentOrderId,
      );
      const { code: feeOrderCurrency } = await currenciesService.findById(
        feeOrder.currencyId,
      );

      if (feeOrder.status !== "initiated") {
        if (
          feeOrder.status === "settled_pending_posting" ||
          feeOrder.status === "settled"
        ) {
          if (feeOrder.railRef !== validated.railRef) {
            throw new InvalidStateError(
              `FeePaymentOrder already settled with different railRef (expected ${feeOrder.railRef ?? "null"}, got ${input.railRef})`,
            );
          }
          if (!feeOrder.resolveOperationId) {
            throw new InvalidStateError(
              "FeePaymentOrder missing resolveOperationId",
            );
          }
          return feeOrder.resolveOperationId;
        }
        throw new InvalidStateError(
          `FeePaymentOrder must be initiated, got ${feeOrder.status}`,
        );
      }
      if (!feeOrder.pendingTransferId) {
        throw new InvalidStateError(
          "FeePaymentOrder missing pendingTransferId",
        );
      }

      const planKey = makePlanKey("fee_payment_settle", {
        feePaymentOrderId: validated.feePaymentOrderId,
        railRef: validated.railRef,
        pendingId: feeOrder.pendingTransferId.toString(),
        currency: feeOrderCurrency,
      });

      const { operationId: entryId } = await ledger.commit(
        tx,
        buildTreasuryIntent({
          source: {
            type: "fee_payment/settled",
            id: validated.feePaymentOrderId,
          },
          operationCode: OPERATION_CODE.TREASURY_FEE_PAYMENT_SETTLE,
          payload: {
            feePaymentOrderId: validated.feePaymentOrderId,
            railRef: validated.railRef,
            pendingTransferId: feeOrder.pendingTransferId.toString(),
            currency: feeOrderCurrency,
          },
          idempotencyKey: `fee_payment:settle:${validated.feePaymentOrderId}:${validated.railRef}`,
          postingDate: validated.occurredAt,
          bookOrgId: SYSTEM_LEDGER_ORG_ID,
          lines: [
            {
              type: OPERATION_TRANSFER_TYPE.POST_PENDING,
              planKey,
              currency: feeOrderCurrency,
              pendingId: feeOrder.pendingTransferId,
              amount: 0n,
            },
          ],
        }),
      );

      const moved = await tx
        .update(schema.feePaymentOrders)
        .set({
          status: "settled_pending_posting",
          resolveOperationId: entryId,
          railRef: validated.railRef,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(schema.feePaymentOrders.id, validated.feePaymentOrderId),
            eq(schema.feePaymentOrders.status, "initiated"),
          ),
        )
        .returning({ id: schema.feePaymentOrders.id });

      if (moved.length) {
        return entryId;
      }

      const current = await fetchFeePaymentOrderState(
        tx,
        validated.feePaymentOrderId,
      );
      if (
        current.resolveOperationId === entryId &&
        (current.status === "settled_pending_posting" ||
          current.status === "settled")
      ) {
        return entryId;
      }

      throw new InvalidStateError(
        `Failed to update fee payment order status: concurrent modification detected. Current status: ${current.status}`,
      );
    });
  }

  async function voidFeePayment(input: VoidFeePaymentInput) {
    const validated = validateVoidFeePaymentInput(input);

    return db.transaction(async (tx: Transaction) => {
      const feeOrder = await fetchFeePaymentOrderState(
        tx,
        validated.feePaymentOrderId,
      );
      const { code: feeOrderCurrency } = await currenciesService.findById(
        feeOrder.currencyId,
      );

      if (feeOrder.status !== "initiated") {
        if (
          feeOrder.status === "voided_pending_posting" ||
          feeOrder.status === "voided"
        ) {
          if (feeOrder.railRef !== validated.railRef) {
            throw new InvalidStateError(
              `FeePaymentOrder already voided with different railRef (expected ${feeOrder.railRef ?? "null"}, got ${validated.railRef})`,
            );
          }
          if (!feeOrder.resolveOperationId) {
            throw new InvalidStateError(
              "FeePaymentOrder missing resolveOperationId",
            );
          }
          return feeOrder.resolveOperationId;
        }
        throw new InvalidStateError(
          `FeePaymentOrder must be initiated, got ${feeOrder.status}`,
        );
      }
      if (!feeOrder.pendingTransferId) {
        throw new InvalidStateError(
          "FeePaymentOrder missing pendingTransferId",
        );
      }

      const planKey = makePlanKey("fee_payment_void", {
        feePaymentOrderId: validated.feePaymentOrderId,
        railRef: validated.railRef,
        pendingId: feeOrder.pendingTransferId.toString(),
        currency: feeOrderCurrency,
      });

      const { operationId: entryId } = await ledger.commit(
        tx,
        buildTreasuryIntent({
          source: {
            type: "fee_payment/voided",
            id: validated.feePaymentOrderId,
          },
          operationCode: OPERATION_CODE.TREASURY_FEE_PAYMENT_VOID,
          payload: {
            feePaymentOrderId: validated.feePaymentOrderId,
            railRef: validated.railRef,
            pendingTransferId: feeOrder.pendingTransferId.toString(),
            currency: feeOrderCurrency,
          },
          idempotencyKey: `fee_payment:void:${validated.feePaymentOrderId}:${validated.railRef}`,
          postingDate: validated.occurredAt,
          bookOrgId: SYSTEM_LEDGER_ORG_ID,
          lines: [
            {
              type: OPERATION_TRANSFER_TYPE.VOID_PENDING,
              planKey,
              currency: feeOrderCurrency,
              pendingId: feeOrder.pendingTransferId,
            },
          ],
        }),
      );

      const moved = await tx
        .update(schema.feePaymentOrders)
        .set({
          status: "voided_pending_posting",
          resolveOperationId: entryId,
          railRef: validated.railRef,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(schema.feePaymentOrders.id, validated.feePaymentOrderId),
            eq(schema.feePaymentOrders.status, "initiated"),
          ),
        )
        .returning({ id: schema.feePaymentOrders.id });

      if (moved.length) {
        return entryId;
      }

      const current = await fetchFeePaymentOrderState(
        tx,
        validated.feePaymentOrderId,
      );
      if (
        current.resolveOperationId === entryId &&
        (current.status === "voided_pending_posting" ||
          current.status === "voided")
      ) {
        return entryId;
      }

      throw new InvalidStateError(
        `Failed to update fee payment order status: concurrent modification detected. Current status: ${current.status}`,
      );
    });
  }

  return {
    initiateFeePayment,
    settleFeePayment,
    voidFeePayment,
  };
}
