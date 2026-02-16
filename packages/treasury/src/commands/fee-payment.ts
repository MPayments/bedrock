import { and, eq, sql } from "drizzle-orm";
import { makePlanKey } from "@bedrock/kernel";
import { InvalidStateError } from "@bedrock/kernel/errors";
import { schema } from "@bedrock/db/schema";
import { PlanType } from "@bedrock/ledger";
import { DAY_IN_SECONDS, TransferCodes } from "@bedrock/kernel/constants";
import { type Transaction } from "@bedrock/db";

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

    async function initiateFeePayment(input: InitiateFeePaymentInput) {
        const vaildated = validateInitiateFeePaymentInput(input);
        const timeoutSeconds = vaildated.timeoutSeconds ?? DAY_IN_SECONDS;

        return db.transaction(async (tx: Transaction) => {
            const feeOrder = await fetchFeePaymentOrderState(tx, vaildated.feePaymentOrderId);

            if (feeOrder.status !== "reserved") {
                if (
                    feeOrder.status === "initiated_pending_posting"
                    || feeOrder.status === "initiated"
                    || feeOrder.status === "settled_pending_posting"
                    || feeOrder.status === "settled"
                    || feeOrder.status === "voided_pending_posting"
                    || feeOrder.status === "voided"
                ) {
                    assertInitiateFeePaymentReplayCompatible(feeOrder, vaildated);
                    return {
                        entryId: feeOrder.initiateEntryId,
                        pendingTransferId: feeOrder.pendingTransferId,
                    };
                }
                throw new InvalidStateError(`FeePaymentOrder must be reserved, got ${feeOrder.status}`);
            }

            const planKey = makePlanKey("fee_payment_init", {
                feePaymentOrderId: vaildated.feePaymentOrderId,
                railRef: vaildated.railRef,
                currency: feeOrder.currency,
                amount: feeOrder.amountMinor.toString(),
                payoutOrgId: vaildated.payoutOrgId,
                payoutBankStableKey: vaildated.payoutBankStableKey,
            });

            const { entryId, transferIds } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "fee_payment/initiated", id: vaildated.feePaymentOrderId },
                idempotencyKey: `fee_payment:init:${vaildated.feePaymentOrderId}:${vaildated.railRef}`,
                postingDate: vaildated.occurredAt,
                transfers: [
                    {
                        type: PlanType.CREATE,
                        planKey,
                        debitKey: keys.feeClearing(feeOrder.bucket, feeOrder.currency),
                        creditKey: keys.bank(vaildated.payoutOrgId, vaildated.payoutBankStableKey, feeOrder.currency),
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
                    payoutOrgId: vaildated.payoutOrgId,
                    payoutBankStableKey: vaildated.payoutBankStableKey,
                    railRef: input.railRef,
                    updatedAt: sql`now()`,
                })
                .where(
                    and(
                        eq(schema.feePaymentOrders.id, vaildated.feePaymentOrderId),
                        eq(schema.feePaymentOrders.status, "reserved")
                    )
                )
                .returning({ id: schema.feePaymentOrders.id });

            if (moved.length) {
                return { entryId, pendingTransferId };
            }

            const current = await fetchFeePaymentOrderState(tx, vaildated.feePaymentOrderId);
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

    async function settleFeePayment(input: SettleFeePaymentInput) {
        const validated = validateSettleFeePaymentInput(input);

        return db.transaction(async (tx: Transaction) => {
            const feeOrder = await fetchFeePaymentOrderState(tx, validated.feePaymentOrderId);

            if (feeOrder.status !== "initiated") {
                if (feeOrder.status === "settled_pending_posting" || feeOrder.status === "settled") {
                    if (feeOrder.railRef !== validated.railRef) {
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
                feePaymentOrderId: validated.feePaymentOrderId,
                railRef: validated.railRef,
                pendingId: feeOrder.pendingTransferId.toString(),
                currency: feeOrder.currency,
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "fee_payment/settled", id: validated.feePaymentOrderId },
                idempotencyKey: `fee_payment:settle:${validated.feePaymentOrderId}:${validated.railRef}`,
                postingDate: validated.occurredAt,
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
                    railRef: validated.railRef,
                    updatedAt: sql`now()`,
                })
                .where(
                    and(
                        eq(schema.feePaymentOrders.id, validated.feePaymentOrderId),
                        eq(schema.feePaymentOrders.status, "initiated")
                    )
                )
                .returning({ id: schema.feePaymentOrders.id });

            if (moved.length) {
                return entryId;
            }

            const current = await fetchFeePaymentOrderState(tx, validated.feePaymentOrderId);
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

    async function voidFeePayment(input: VoidFeePaymentInput) {
        const validated = validateVoidFeePaymentInput(input);

        return db.transaction(async (tx: Transaction) => {
            const feeOrder = await fetchFeePaymentOrderState(tx, validated.feePaymentOrderId);

            if (feeOrder.status !== "initiated") {
                if (feeOrder.status === "voided_pending_posting" || feeOrder.status === "voided") {
                    if (feeOrder.railRef !== validated.railRef) {
                        throw new InvalidStateError(
                            `FeePaymentOrder already voided with different railRef (expected ${feeOrder.railRef ?? "null"}, got ${validated.railRef})`
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
                feePaymentOrderId: validated.feePaymentOrderId,
                railRef: validated.railRef,
                pendingId: feeOrder.pendingTransferId.toString(),
                currency: feeOrder.currency,
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "fee_payment/voided", id: validated.feePaymentOrderId },
                idempotencyKey: `fee_payment:void:${validated.feePaymentOrderId}:${validated.railRef}`,
                postingDate: validated.occurredAt,
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
                    railRef: validated.railRef,
                    updatedAt: sql`now()`,
                })
                .where(
                    and(
                        eq(schema.feePaymentOrders.id, validated.feePaymentOrderId),
                        eq(schema.feePaymentOrders.status, "initiated")
                    )
                )
                .returning({ id: schema.feePaymentOrders.id });

            if (moved.length) {
                return entryId;
            }

            const current = await fetchFeePaymentOrderState(tx, validated.feePaymentOrderId);
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
