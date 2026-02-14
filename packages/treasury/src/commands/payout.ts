import { and, eq, sql } from "drizzle-orm";
import { makePlanKey } from "@bedrock/kernel";
import { AmountMismatchError, CurrencyMismatchError, InvalidStateError, NotFoundError, ValidationError } from "@bedrock/kernel/errors";
import { schema } from "@bedrock/db/schema";
import { PlanType } from "@bedrock/ledger";
import { TransferCodes } from "@bedrock/kernel/constants";

import {
    type InitiatePayoutInput,
    type SettlePayoutInput,
    type VoidPayoutInput,
    validateInitiatePayoutInput,
    validateSettlePayoutInput,
    validateVoidPayoutInput,
} from "../validation";
import {
    InitiatePayoutAllowedFrom,
    ResolvePendingPayoutAllowedFrom,
    TreasuryOrderStatus,
    isOrderStatusIn,
    isSameEntryInAllowedState,
} from "../state-machine";
import { SYSTEM_LEDGER_ORG_ID, type TreasuryServiceContext } from "../internal/context";
import { fetchOrderState } from "../internal/order-state";

const DAY_IN_SECONDS = 86400;

export function createPayoutHandlers(context: TreasuryServiceContext) {
    const { db, ledger, log, keys } = context;

    async function initiatePayout(rawInput: InitiatePayoutInput) {
        const input = validateInitiatePayoutInput(rawInput);
        const timeoutSeconds = input.timeoutSeconds ?? DAY_IN_SECONDS;
        log.debug("initiatePayout start", { orderId: input.orderId, railRef: input.railRef });

        return db.transaction(async (tx: any) => {
            const [order] = await tx
                .select()
                .from(schema.paymentOrders)
                .where(eq(schema.paymentOrders.id, input.orderId))
                .limit(1);

            if (!order) throw new NotFoundError("Order", input.orderId);

            if (input.payOutCurrency !== order.payOutCurrency) {
                throw new CurrencyMismatchError("payOutCurrency", order.payOutCurrency, input.payOutCurrency);
            }

            if (input.amountMinor !== order.payOutAmountMinor) {
                throw new AmountMismatchError("payOutAmountMinor", order.payOutAmountMinor, input.amountMinor);
            }
            if (input.payoutOrgId !== order.payOutOrgId) {
                throw new ValidationError(`payoutOrgId mismatch: expected ${order.payOutOrgId}, got ${input.payoutOrgId}`);
            }

            if (!isOrderStatusIn(order.status, InitiatePayoutAllowedFrom)) {
                throw new InvalidStateError(`Order must be ${TreasuryOrderStatus.FX_EXECUTED} (posted), got ${order.status}`);
            }

            const planKey = makePlanKey("payout_init", {
                railRef: input.railRef,
                orderId: input.orderId,
                currency: input.payOutCurrency,
                amount: input.amountMinor.toString(),
                payoutOrgId: input.payoutOrgId,
                payoutBankStableKey: input.payoutBankStableKey,
            });

            const { entryId, transferIds } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "order/payout_initiated", id: input.orderId },
                idempotencyKey: `payout:init:${input.railRef}`,
                postingDate: input.occurredAt,
                transfers: [
                    {
                        type: PlanType.CREATE,
                        planKey,
                        debitKey: keys.payoutObligation(input.orderId, input.payOutCurrency),
                        creditKey: keys.bank(input.payoutOrgId, input.payoutBankStableKey, input.payOutCurrency),
                        currency: input.payOutCurrency,
                        amount: input.amountMinor,
                        code: TransferCodes.PAYOUT_INITIATED,
                        pending: {
                            timeoutSeconds,
                        },
                        memo: "Payout initiated (pending)",
                    },
                ],
            });

            const pendingTransferId = transferIds.get(1)!;

            const moved = await tx
                .update(schema.paymentOrders)
                .set({
                    status: TreasuryOrderStatus.PAYOUT_INITIATED_PENDING_POSTING,
                    ledgerEntryId: entryId,
                    payoutPendingTransferId: pendingTransferId,
                    updatedAt: sql`now()`,
                })
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.status, TreasuryOrderStatus.FX_EXECUTED)))
                .returning({ id: schema.paymentOrders.id });

            if (moved.length) {
                log.info("initiatePayout ok", { orderId: input.orderId, entryId, pendingTransferId });
                return { entryId, pendingTransferId };
            }

            const current = await fetchOrderState(tx, input.orderId);
            const st = current.status;

            if (isSameEntryInAllowedState(
                st as string,
                current.ledgerEntryId,
                entryId,
                [TreasuryOrderStatus.PAYOUT_INITIATED_PENDING_POSTING, TreasuryOrderStatus.PAYOUT_INITIATED]
            )) {
                if (!current.payoutPendingTransferId) {
                    throw new InvalidStateError(`Order in state ${st} but payoutPendingTransferId missing`);
                }
                log.debug("initiatePayout idempotent", { orderId: input.orderId, status: st });
                return { entryId, pendingTransferId: current.payoutPendingTransferId };
            }

            throw new InvalidStateError(
                `Failed to update order status: concurrent modification detected. Current status: ${st}`
            );
        });
    }

    async function settlePayout(rawInput: SettlePayoutInput) {
        const input = validateSettlePayoutInput(rawInput);
        log.debug("settlePayout start", { orderId: input.orderId, railRef: input.railRef });

        return db.transaction(async (tx: any) => {
            const [order] = await tx
                .select()
                .from(schema.paymentOrders)
                .where(eq(schema.paymentOrders.id, input.orderId))
                .limit(1);

            if (!order) throw new NotFoundError("Order", input.orderId);

            if (input.payOutCurrency !== order.payOutCurrency) {
                throw new CurrencyMismatchError("payOutCurrency", order.payOutCurrency, input.payOutCurrency);
            }

            if (!isOrderStatusIn(order.status, ResolvePendingPayoutAllowedFrom)) {
                throw new InvalidStateError(`Order must be ${TreasuryOrderStatus.PAYOUT_INITIATED} (posted), got ${order.status}`);
            }
            if (!order.payoutPendingTransferId) throw new InvalidStateError("Missing payoutPendingTransferId - order state is inconsistent");

            const planKey = makePlanKey("payout_settle", {
                railRef: input.railRef,
                orderId: input.orderId,
                currency: input.payOutCurrency,
                pendingId: order.payoutPendingTransferId.toString(),
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "order/payout_settled", id: input.orderId },
                idempotencyKey: `payout:settle:${input.railRef}`,
                postingDate: input.occurredAt,
                transfers: [
                    {
                        type: PlanType.POST_PENDING,
                        planKey,
                        currency: input.payOutCurrency,
                        pendingId: order.payoutPendingTransferId,
                        amount: 0n,
                    },
                ],
            });

            const moved = await tx
                .update(schema.paymentOrders)
                .set({ status: TreasuryOrderStatus.CLOSED_PENDING_POSTING, ledgerEntryId: entryId, updatedAt: sql`now()` })
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.status, TreasuryOrderStatus.PAYOUT_INITIATED)))
                .returning({ id: schema.paymentOrders.id });

            if (moved.length) {
                log.info("settlePayout ok", { orderId: input.orderId, entryId });
                return entryId;
            }

            const current = await fetchOrderState(tx, input.orderId);
            const st = current.status;

            if (isSameEntryInAllowedState(
                st as string,
                current.ledgerEntryId,
                entryId,
                [TreasuryOrderStatus.CLOSED_PENDING_POSTING, TreasuryOrderStatus.CLOSED]
            )) {
                log.debug("settlePayout idempotent", { orderId: input.orderId, status: st });
                return entryId;
            }

            throw new InvalidStateError(
                `Failed to update order status: concurrent modification detected. Current status: ${st}`
            );
        });
    }

    async function voidPayout(rawInput: VoidPayoutInput) {
        const input = validateVoidPayoutInput(rawInput);
        log.debug("voidPayout start", { orderId: input.orderId, railRef: input.railRef });

        return db.transaction(async (tx: any) => {
            const [order] = await tx
                .select()
                .from(schema.paymentOrders)
                .where(eq(schema.paymentOrders.id, input.orderId))
                .limit(1);

            if (!order) throw new NotFoundError("Order", input.orderId);

            if (input.payOutCurrency !== order.payOutCurrency) {
                throw new CurrencyMismatchError("payOutCurrency", order.payOutCurrency, input.payOutCurrency);
            }

            if (!isOrderStatusIn(order.status, ResolvePendingPayoutAllowedFrom)) {
                throw new InvalidStateError(`Order must be ${TreasuryOrderStatus.PAYOUT_INITIATED} (posted), got ${order.status}`);
            }
            if (!order.payoutPendingTransferId) throw new InvalidStateError("Missing payoutPendingTransferId - order state is inconsistent");

            const planKey = makePlanKey("payout_void", {
                railRef: input.railRef,
                orderId: input.orderId,
                currency: input.payOutCurrency,
                pendingId: order.payoutPendingTransferId.toString(),
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "order/payout_failed", id: input.orderId },
                idempotencyKey: `payout:void:${input.railRef}`,
                postingDate: input.occurredAt,
                transfers: [
                    {
                        type: PlanType.VOID_PENDING,
                        planKey,
                        currency: input.payOutCurrency,
                        pendingId: order.payoutPendingTransferId,
                    },
                ],
            });

            const moved = await tx
                .update(schema.paymentOrders)
                .set({ status: TreasuryOrderStatus.FAILED_PENDING_POSTING, ledgerEntryId: entryId, updatedAt: sql`now()` })
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.status, TreasuryOrderStatus.PAYOUT_INITIATED)))
                .returning({ id: schema.paymentOrders.id });

            if (moved.length) {
                log.info("voidPayout ok", { orderId: input.orderId, entryId });
                return entryId;
            }

            const current = await fetchOrderState(tx, input.orderId);
            const st = current.status;

            if (isSameEntryInAllowedState(
                st as string,
                current.ledgerEntryId,
                entryId,
                [TreasuryOrderStatus.FAILED_PENDING_POSTING, TreasuryOrderStatus.FAILED]
            )) {
                log.debug("voidPayout idempotent", { orderId: input.orderId, status: st });
                return entryId;
            }

            throw new InvalidStateError(
                `Failed to update order status: concurrent modification detected. Current status: ${st}`
            );
        });
    }

    return {
        initiatePayout,
        settlePayout,
        voidPayout,
    };
}
