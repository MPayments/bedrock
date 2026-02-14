import { and, eq, sql } from "drizzle-orm";
import { makePlanKey } from "@bedrock/kernel";
import { InvalidStateError } from "@bedrock/kernel/errors";
import { schema } from "@bedrock/db/schema";
import { PlanType } from "@bedrock/ledger";
import { TransferCodes } from "@bedrock/kernel/constants";

import {
    type InitiateFeePaymentInput,
    type SettleFeePaymentInput,
    type VoidFeePaymentInput,
    validateInitiateFeePaymentInput,
    validateSettleFeePaymentInput,
    validateVoidFeePaymentInput,
} from "../validation";
import { SYSTEM_LEDGER_ORG_ID, type TreasuryServiceContext } from "../internal/context";
import { assertInitiateFeePaymentReplayCompatible } from "../internal/fee-payment-idempotency";
import { fetchFeePaymentOrderState } from "../internal/order-state";

export function createFeePaymentHandlers(context: TreasuryServiceContext) {
    const { db, ledger, keys } = context;

    async function initiateFeePayment(rawInput: InitiateFeePaymentInput) {
        const input = validateInitiateFeePaymentInput(rawInput);
        const timeoutSeconds = input.timeoutSeconds ?? 86400;

        return db.transaction(async (tx: any) => {
            const feeOrder = await fetchFeePaymentOrderState(tx, input.feePaymentOrderId);

            if (feeOrder.status !== "reserved") {
                if (
                    feeOrder.status === "initiated_pending_posting"
                    || feeOrder.status === "initiated"
                    || feeOrder.status === "settled_pending_posting"
                    || feeOrder.status === "settled"
                    || feeOrder.status === "voided_pending_posting"
                    || feeOrder.status === "voided"
                ) {
                    assertInitiateFeePaymentReplayCompatible(feeOrder, input);
                    return {
                        entryId: feeOrder.initiateEntryId,
                        pendingTransferId: feeOrder.pendingTransferId,
                    };
                }
                throw new InvalidStateError(`FeePaymentOrder must be reserved, got ${feeOrder.status}`);
            }

            const planKey = makePlanKey("fee_payment_init", {
                feePaymentOrderId: input.feePaymentOrderId,
                railRef: input.railRef,
                currency: feeOrder.currency,
                amount: feeOrder.amountMinor.toString(),
                payoutOrgId: input.payoutOrgId,
                payoutBankStableKey: input.payoutBankStableKey,
            });

            const { entryId, transferIds } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "fee_payment/initiated", id: input.feePaymentOrderId },
                idempotencyKey: `fee_payment:init:${input.feePaymentOrderId}:${input.railRef}`,
                postingDate: input.occurredAt,
                transfers: [
                    {
                        type: PlanType.CREATE,
                        planKey,
                        debitKey: keys.feeClearing(feeOrder.bucket, feeOrder.currency),
                        creditKey: keys.bank(input.payoutOrgId, input.payoutBankStableKey, feeOrder.currency),
                        currency: feeOrder.currency,
                        amount: feeOrder.amountMinor,
                        code: TransferCodes.FEE_PAYMENT_INITIATED,
                        pending: { timeoutSeconds },
                        memo: "Fee payment initiated (pending)",
                    },
                ],
            });

            const pendingTransferId = transferIds.get(1)!;

            const moved = await tx
                .update(schema.feePaymentOrders)
                .set({
                    status: "initiated_pending_posting",
                    initiateEntryId: entryId,
                    pendingTransferId,
                    payoutOrgId: input.payoutOrgId,
                    payoutBankStableKey: input.payoutBankStableKey,
                    railRef: input.railRef,
                    updatedAt: sql`now()`,
                })
                .where(
                    and(
                        eq(schema.feePaymentOrders.id, input.feePaymentOrderId),
                        eq(schema.feePaymentOrders.status, "reserved")
                    )
                )
                .returning({ id: schema.feePaymentOrders.id });

            if (moved.length) {
                return { entryId, pendingTransferId };
            }

            const current = await fetchFeePaymentOrderState(tx, input.feePaymentOrderId);
            if (
                current.initiateEntryId === entryId &&
                (current.status === "initiated_pending_posting" || current.status === "initiated")
            ) {
                if (!current.pendingTransferId) {
                    throw new InvalidStateError("FeePaymentOrder missing pendingTransferId");
                }
                return { entryId, pendingTransferId: current.pendingTransferId };
            }

            throw new InvalidStateError(
                `Failed to update fee payment order status: concurrent modification detected. Current status: ${current.status}`
            );
        });
    }

    async function settleFeePayment(rawInput: SettleFeePaymentInput) {
        const input = validateSettleFeePaymentInput(rawInput);

        return db.transaction(async (tx: any) => {
            const feeOrder = await fetchFeePaymentOrderState(tx, input.feePaymentOrderId);

            if (feeOrder.status !== "initiated") {
                if (feeOrder.status === "settled_pending_posting" || feeOrder.status === "settled") {
                    if (feeOrder.railRef !== input.railRef) {
                        throw new InvalidStateError(
                            `FeePaymentOrder already settled with different railRef (expected ${feeOrder.railRef ?? "null"}, got ${input.railRef})`
                        );
                    }
                    if (!feeOrder.resolveEntryId) {
                        throw new InvalidStateError("FeePaymentOrder missing resolveEntryId");
                    }
                    return feeOrder.resolveEntryId;
                }
                throw new InvalidStateError(`FeePaymentOrder must be initiated, got ${feeOrder.status}`);
            }
            if (!feeOrder.pendingTransferId) {
                throw new InvalidStateError("FeePaymentOrder missing pendingTransferId");
            }

            const planKey = makePlanKey("fee_payment_settle", {
                feePaymentOrderId: input.feePaymentOrderId,
                railRef: input.railRef,
                pendingId: feeOrder.pendingTransferId.toString(),
                currency: feeOrder.currency,
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "fee_payment/settled", id: input.feePaymentOrderId },
                idempotencyKey: `fee_payment:settle:${input.feePaymentOrderId}:${input.railRef}`,
                postingDate: input.occurredAt,
                transfers: [
                    {
                        type: PlanType.POST_PENDING,
                        planKey,
                        currency: feeOrder.currency,
                        pendingId: feeOrder.pendingTransferId,
                        amount: 0n,
                    },
                ],
            });

            const moved = await tx
                .update(schema.feePaymentOrders)
                .set({
                    status: "settled_pending_posting",
                    resolveEntryId: entryId,
                    railRef: input.railRef,
                    updatedAt: sql`now()`,
                })
                .where(
                    and(
                        eq(schema.feePaymentOrders.id, input.feePaymentOrderId),
                        eq(schema.feePaymentOrders.status, "initiated")
                    )
                )
                .returning({ id: schema.feePaymentOrders.id });

            if (moved.length) {
                return entryId;
            }

            const current = await fetchFeePaymentOrderState(tx, input.feePaymentOrderId);
            if (
                current.resolveEntryId === entryId &&
                (current.status === "settled_pending_posting" || current.status === "settled")
            ) {
                return entryId;
            }

            throw new InvalidStateError(
                `Failed to update fee payment order status: concurrent modification detected. Current status: ${current.status}`
            );
        });
    }

    async function voidFeePayment(rawInput: VoidFeePaymentInput) {
        const input = validateVoidFeePaymentInput(rawInput);

        return db.transaction(async (tx: any) => {
            const feeOrder = await fetchFeePaymentOrderState(tx, input.feePaymentOrderId);

            if (feeOrder.status !== "initiated") {
                if (feeOrder.status === "voided_pending_posting" || feeOrder.status === "voided") {
                    if (feeOrder.railRef !== input.railRef) {
                        throw new InvalidStateError(
                            `FeePaymentOrder already voided with different railRef (expected ${feeOrder.railRef ?? "null"}, got ${input.railRef})`
                        );
                    }
                    if (!feeOrder.resolveEntryId) {
                        throw new InvalidStateError("FeePaymentOrder missing resolveEntryId");
                    }
                    return feeOrder.resolveEntryId;
                }
                throw new InvalidStateError(`FeePaymentOrder must be initiated, got ${feeOrder.status}`);
            }
            if (!feeOrder.pendingTransferId) {
                throw new InvalidStateError("FeePaymentOrder missing pendingTransferId");
            }

            const planKey = makePlanKey("fee_payment_void", {
                feePaymentOrderId: input.feePaymentOrderId,
                railRef: input.railRef,
                pendingId: feeOrder.pendingTransferId.toString(),
                currency: feeOrder.currency,
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "fee_payment/voided", id: input.feePaymentOrderId },
                idempotencyKey: `fee_payment:void:${input.feePaymentOrderId}:${input.railRef}`,
                postingDate: input.occurredAt,
                transfers: [
                    {
                        type: PlanType.VOID_PENDING,
                        planKey,
                        currency: feeOrder.currency,
                        pendingId: feeOrder.pendingTransferId,
                    },
                ],
            });

            const moved = await tx
                .update(schema.feePaymentOrders)
                .set({
                    status: "voided_pending_posting",
                    resolveEntryId: entryId,
                    railRef: input.railRef,
                    updatedAt: sql`now()`,
                })
                .where(
                    and(
                        eq(schema.feePaymentOrders.id, input.feePaymentOrderId),
                        eq(schema.feePaymentOrders.status, "initiated")
                    )
                )
                .returning({ id: schema.feePaymentOrders.id });

            if (moved.length) {
                return entryId;
            }

            const current = await fetchFeePaymentOrderState(tx, input.feePaymentOrderId);
            if (
                current.resolveEntryId === entryId &&
                (current.status === "voided_pending_posting" || current.status === "voided")
            ) {
                return entryId;
            }

            throw new InvalidStateError(
                `Failed to update fee payment order status: concurrent modification detected. Current status: ${current.status}`
            );
        });
    }

    return {
        initiateFeePayment,
        settleFeePayment,
        voidFeePayment,
    };
}
